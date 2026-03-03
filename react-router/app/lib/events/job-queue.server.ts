import { prisma } from "~/lib/db/db.server";
import { logger } from "~/lib/monitoring/logger.server";

// --- Types ---

export interface EnqueueOptions {
  maxAttempts?: number;
  delay?: number; // ms from now
}

type JobHandler = (payload: unknown) => Promise<void>;

// --- Handler Registry ---

const handlers = new Map<string, JobHandler>();

export function registerJobHandler(type: string, handler: JobHandler) {
  handlers.set(type, handler);
}

// --- Enqueue ---

export async function enqueueJob(type: string, payload: unknown, opts?: EnqueueOptions) {
  const nextRunAt = opts?.delay ? new Date(Date.now() + opts.delay) : new Date();
  const job = await prisma.job.create({
    data: {
      type,
      payload: payload as any,
      maxAttempts: opts?.maxAttempts ?? 3,
      nextRunAt,
    },
  });
  logger.debug({ jobId: job.id, type }, "Job enqueued");
  return job;
}

// --- Process ---

async function processNextJob(): Promise<boolean> {
  // Atomic claim: find and lock a pending job
  const jobs = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `UPDATE "Job"
     SET status = 'PROCESSING', attempts = attempts + 1
     WHERE id = (
       SELECT id FROM "Job"
       WHERE status = 'PENDING' AND "nextRunAt" <= NOW()
       ORDER BY "nextRunAt" ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING id`,
  );

  if (!jobs.length) return false;

  const jobId = jobs[0].id;
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return false;

  const handler = handlers.get(job.type);
  if (!handler) {
    logger.error({ jobId, type: job.type }, "No handler registered for job type");
    await prisma.job.update({
      where: { id: jobId },
      data: { status: "FAILED", lastError: `No handler for type: ${job.type}` },
    });
    return true;
  }

  try {
    await handler(job.payload);
    await prisma.job.update({
      where: { id: jobId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    logger.debug({ jobId, type: job.type }, "Job completed");
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    if (job.attempts >= job.maxAttempts) {
      await prisma.job.update({
        where: { id: jobId },
        data: { status: "FAILED", lastError: errMsg },
      });
      logger.error({ jobId, type: job.type, error: errMsg }, "Job failed permanently");
    } else {
      // Exponential backoff: 2^attempts * 30s
      const backoffMs = Math.pow(2, job.attempts) * 30_000;
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: "PENDING",
          lastError: errMsg,
          nextRunAt: new Date(Date.now() + backoffMs),
        },
      });
      logger.warn({ jobId, type: job.type, attempt: job.attempts, error: errMsg }, "Job failed, will retry");
    }
  }
  return true;
}

// --- Processor Loop ---

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startJobProcessor(intervalMs = 5000) {
  if (intervalId) return;
  logger.info({ intervalMs }, "Starting job processor");

  intervalId = setInterval(async () => {
    try {
      // Process up to 10 jobs per tick
      for (let i = 0; i < 10; i++) {
        const processed = await processNextJob();
        if (!processed) break;
      }
    } catch (error) {
      logger.error({ error }, "Job processor tick error");
    }
  }, intervalMs);
}

export function stopJobProcessor() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info("Job processor stopped");
  }
}

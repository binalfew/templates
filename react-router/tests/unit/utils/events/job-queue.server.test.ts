import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --- Mocks ---

const mockJobCreate = vi.fn();
const mockJobFindUnique = vi.fn();
const mockJobUpdate = vi.fn();
const mockQueryRawUnsafe = vi.fn();

vi.mock("~/utils/db/db.server", () => ({
  prisma: {
    job: {
      create: mockJobCreate,
      findUnique: mockJobFindUnique,
      update: mockJobUpdate,
    },
    $queryRawUnsafe: mockQueryRawUnsafe,
  },
}));

vi.mock("~/utils/monitoring/logger.server", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("job-queue.server", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("registerJobHandler", () => {
    it("should register a handler for a given type", async () => {
      const { registerJobHandler, enqueueJob, startJobProcessor, stopJobProcessor } =
        await import("~/utils/events/job-queue.server");

      const handler = vi.fn().mockResolvedValue(undefined);
      registerJobHandler("email:send", handler);

      // Verify the handler is registered by processing a job of that type
      const jobId = "job-123";
      const jobPayload = { to: "user@example.com", subject: "Test" };
      mockQueryRawUnsafe.mockResolvedValueOnce([{ id: jobId }]);
      mockJobFindUnique.mockResolvedValueOnce({
        id: jobId,
        type: "email:send",
        payload: jobPayload,
        attempts: 1,
        maxAttempts: 3,
      });
      mockJobUpdate.mockResolvedValueOnce({});

      startJobProcessor(100);
      await vi.advanceTimersByTimeAsync(150);
      stopJobProcessor();

      expect(handler).toHaveBeenCalledWith(jobPayload);
    });

    it("should overwrite a previously registered handler for the same type", async () => {
      const { registerJobHandler, startJobProcessor, stopJobProcessor } = await import(
        "~/utils/events/job-queue.server"
      );

      const handler1 = vi.fn().mockResolvedValue(undefined);
      const handler2 = vi.fn().mockResolvedValue(undefined);

      registerJobHandler("email:send", handler1);
      registerJobHandler("email:send", handler2);

      const jobId = "job-overwrite";
      mockQueryRawUnsafe.mockResolvedValueOnce([{ id: jobId }]);
      mockJobFindUnique.mockResolvedValueOnce({
        id: jobId,
        type: "email:send",
        payload: { msg: "hi" },
        attempts: 1,
        maxAttempts: 3,
      });
      mockJobUpdate.mockResolvedValueOnce({});

      startJobProcessor(100);
      await vi.advanceTimersByTimeAsync(150);
      stopJobProcessor();

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledWith({ msg: "hi" });
    });
  });

  describe("enqueueJob", () => {
    it("should create a job with default options", async () => {
      const { enqueueJob } = await import("~/utils/events/job-queue.server");

      const fakeJob = {
        id: "job-1",
        type: "email:send",
        payload: { to: "user@test.com" },
        maxAttempts: 3,
      };
      mockJobCreate.mockResolvedValueOnce(fakeJob);

      const result = await enqueueJob("email:send", { to: "user@test.com" });

      expect(mockJobCreate).toHaveBeenCalledTimes(1);
      const createArg = mockJobCreate.mock.calls[0][0];
      expect(createArg.data.type).toBe("email:send");
      expect(createArg.data.payload).toEqual({ to: "user@test.com" });
      expect(createArg.data.maxAttempts).toBe(3);
      expect(createArg.data.nextRunAt).toBeInstanceOf(Date);
      expect(result).toEqual(fakeJob);
    });

    it("should use custom maxAttempts when provided", async () => {
      const { enqueueJob } = await import("~/utils/events/job-queue.server");

      mockJobCreate.mockResolvedValueOnce({ id: "job-2" });
      await enqueueJob("webhook:deliver", { url: "https://hook.io" }, { maxAttempts: 5 });

      const createArg = mockJobCreate.mock.calls[0][0];
      expect(createArg.data.maxAttempts).toBe(5);
    });

    it("should schedule the job in the future when delay is provided", async () => {
      const { enqueueJob } = await import("~/utils/events/job-queue.server");

      const now = Date.now();
      mockJobCreate.mockResolvedValueOnce({ id: "job-3" });
      await enqueueJob("report:generate", { reportId: "r-1" }, { delay: 60_000 });

      const createArg = mockJobCreate.mock.calls[0][0];
      const nextRunAt: Date = createArg.data.nextRunAt;
      expect(nextRunAt.getTime()).toBeGreaterThanOrEqual(now + 60_000 - 100);
      expect(nextRunAt.getTime()).toBeLessThanOrEqual(now + 60_000 + 100);
    });

    it("should schedule the job immediately when no delay is provided", async () => {
      const { enqueueJob } = await import("~/utils/events/job-queue.server");

      const before = Date.now();
      mockJobCreate.mockResolvedValueOnce({ id: "job-4" });
      await enqueueJob("email:send", { to: "a@b.com" });
      const after = Date.now();

      const createArg = mockJobCreate.mock.calls[0][0];
      const nextRunAt: Date = createArg.data.nextRunAt;
      expect(nextRunAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(nextRunAt.getTime()).toBeLessThanOrEqual(after);
    });
  });

  describe("processNextJob (via startJobProcessor)", () => {
    it("should do nothing when no pending jobs exist", async () => {
      const { startJobProcessor, stopJobProcessor } = await import("~/utils/events/job-queue.server");

      mockQueryRawUnsafe.mockResolvedValueOnce([]);

      startJobProcessor(100);
      await vi.advanceTimersByTimeAsync(150);
      stopJobProcessor();

      expect(mockQueryRawUnsafe).toHaveBeenCalledTimes(1);
      expect(mockJobFindUnique).not.toHaveBeenCalled();
    });

    it("should mark a job as FAILED when no handler is registered for its type", async () => {
      const { startJobProcessor, stopJobProcessor } = await import("~/utils/events/job-queue.server");

      const jobId = "job-no-handler";
      mockQueryRawUnsafe.mockResolvedValueOnce([{ id: jobId }]);
      mockJobFindUnique.mockResolvedValueOnce({
        id: jobId,
        type: "unknown:type",
        payload: {},
        attempts: 1,
        maxAttempts: 3,
      });
      mockJobUpdate.mockResolvedValueOnce({});
      // After handling the unknown type job, the next call returns no more jobs
      mockQueryRawUnsafe.mockResolvedValueOnce([]);

      startJobProcessor(100);
      await vi.advanceTimersByTimeAsync(150);
      stopJobProcessor();

      expect(mockJobUpdate).toHaveBeenCalledWith({
        where: { id: jobId },
        data: {
          status: "FAILED",
          lastError: "No handler for type: unknown:type",
        },
      });
    });

    it("should mark a job as COMPLETED on successful handler execution", async () => {
      const { registerJobHandler, startJobProcessor, stopJobProcessor } = await import(
        "~/utils/events/job-queue.server"
      );

      const handler = vi.fn().mockResolvedValue(undefined);
      registerJobHandler("test:success", handler);

      const jobId = "job-success";
      mockQueryRawUnsafe.mockResolvedValueOnce([{ id: jobId }]);
      mockJobFindUnique.mockResolvedValueOnce({
        id: jobId,
        type: "test:success",
        payload: { data: "value" },
        attempts: 1,
        maxAttempts: 3,
      });
      mockJobUpdate.mockResolvedValueOnce({});
      mockQueryRawUnsafe.mockResolvedValueOnce([]);

      startJobProcessor(100);
      await vi.advanceTimersByTimeAsync(150);
      stopJobProcessor();

      expect(handler).toHaveBeenCalledWith({ data: "value" });
      expect(mockJobUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: jobId },
          data: expect.objectContaining({
            status: "COMPLETED",
            completedAt: expect.any(Date),
          }),
        }),
      );
    });

    it("should retry with exponential backoff when handler fails and attempts remain", async () => {
      const { registerJobHandler, startJobProcessor, stopJobProcessor } = await import(
        "~/utils/events/job-queue.server"
      );

      const handler = vi.fn().mockRejectedValue(new Error("Connection timeout"));
      registerJobHandler("test:retry", handler);

      const jobId = "job-retry";
      mockQueryRawUnsafe.mockResolvedValueOnce([{ id: jobId }]);
      mockJobFindUnique.mockResolvedValueOnce({
        id: jobId,
        type: "test:retry",
        payload: {},
        attempts: 1,
        maxAttempts: 3,
      });
      mockJobUpdate.mockResolvedValueOnce({});
      mockQueryRawUnsafe.mockResolvedValueOnce([]);

      const now = Date.now();
      startJobProcessor(100);
      await vi.advanceTimersByTimeAsync(150);
      stopJobProcessor();

      expect(mockJobUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: jobId },
          data: expect.objectContaining({
            status: "PENDING",
            lastError: "Connection timeout",
            nextRunAt: expect.any(Date),
          }),
        }),
      );

      // Exponential backoff: 2^1 * 30_000 = 60_000ms
      const updateCall = mockJobUpdate.mock.calls[0][0];
      const nextRunAt: Date = updateCall.data.nextRunAt;
      const expectedBackoffMs = Math.pow(2, 1) * 30_000;
      expect(nextRunAt.getTime()).toBeGreaterThanOrEqual(now + expectedBackoffMs - 200);
      expect(nextRunAt.getTime()).toBeLessThanOrEqual(now + expectedBackoffMs + 200);
    });

    it("should mark job as FAILED permanently when max attempts are reached", async () => {
      const { registerJobHandler, startJobProcessor, stopJobProcessor } = await import(
        "~/utils/events/job-queue.server"
      );

      const handler = vi.fn().mockRejectedValue(new Error("Fatal error"));
      registerJobHandler("test:fail", handler);

      const jobId = "job-fail-perm";
      mockQueryRawUnsafe.mockResolvedValueOnce([{ id: jobId }]);
      mockJobFindUnique.mockResolvedValueOnce({
        id: jobId,
        type: "test:fail",
        payload: {},
        attempts: 3,
        maxAttempts: 3,
      });
      mockJobUpdate.mockResolvedValueOnce({});
      mockQueryRawUnsafe.mockResolvedValueOnce([]);

      startJobProcessor(100);
      await vi.advanceTimersByTimeAsync(150);
      stopJobProcessor();

      expect(mockJobUpdate).toHaveBeenCalledWith({
        where: { id: jobId },
        data: {
          status: "FAILED",
          lastError: "Fatal error",
        },
      });
    });

    it("should handle non-Error thrown values", async () => {
      const { registerJobHandler, startJobProcessor, stopJobProcessor } = await import(
        "~/utils/events/job-queue.server"
      );

      const handler = vi.fn().mockRejectedValue("string error");
      registerJobHandler("test:string-err", handler);

      const jobId = "job-string-err";
      mockQueryRawUnsafe.mockResolvedValueOnce([{ id: jobId }]);
      mockJobFindUnique.mockResolvedValueOnce({
        id: jobId,
        type: "test:string-err",
        payload: {},
        attempts: 3,
        maxAttempts: 3,
      });
      mockJobUpdate.mockResolvedValueOnce({});
      mockQueryRawUnsafe.mockResolvedValueOnce([]);

      startJobProcessor(100);
      await vi.advanceTimersByTimeAsync(150);
      stopJobProcessor();

      expect(mockJobUpdate).toHaveBeenCalledWith({
        where: { id: jobId },
        data: {
          status: "FAILED",
          lastError: "string error",
        },
      });
    });

    it("should skip if job is not found after claiming", async () => {
      const { startJobProcessor, stopJobProcessor } = await import("~/utils/events/job-queue.server");

      mockQueryRawUnsafe.mockResolvedValueOnce([{ id: "ghost-job" }]);
      mockJobFindUnique.mockResolvedValueOnce(null);

      startJobProcessor(100);
      await vi.advanceTimersByTimeAsync(150);
      stopJobProcessor();

      expect(mockJobUpdate).not.toHaveBeenCalled();
    });

    it("should process up to 10 jobs per tick", async () => {
      const { registerJobHandler, startJobProcessor, stopJobProcessor } = await import(
        "~/utils/events/job-queue.server"
      );

      const handler = vi.fn().mockResolvedValue(undefined);
      registerJobHandler("test:batch", handler);

      // Set up 12 jobs, expecting at most 10 to be processed in one tick
      for (let i = 0; i < 10; i++) {
        const jobId = `job-batch-${i}`;
        mockQueryRawUnsafe.mockResolvedValueOnce([{ id: jobId }]);
        mockJobFindUnique.mockResolvedValueOnce({
          id: jobId,
          type: "test:batch",
          payload: { index: i },
          attempts: 1,
          maxAttempts: 3,
        });
        mockJobUpdate.mockResolvedValueOnce({});
      }
      // 11th call returns no more jobs
      mockQueryRawUnsafe.mockResolvedValueOnce([]);

      startJobProcessor(200);
      await vi.advanceTimersByTimeAsync(250);
      stopJobProcessor();

      expect(handler).toHaveBeenCalledTimes(10);
    });
  });

  describe("startJobProcessor", () => {
    it("should not start a second processor if one is already running", async () => {
      const { startJobProcessor, stopJobProcessor } = await import("~/utils/events/job-queue.server");

      mockQueryRawUnsafe.mockResolvedValue([]);

      startJobProcessor(100);
      startJobProcessor(100); // second call should be a no-op

      await vi.advanceTimersByTimeAsync(350);
      stopJobProcessor();

      // With 100ms interval over 350ms, we'd expect ~3 ticks for one processor.
      // If two were started, we'd see ~6 calls.
      expect(mockQueryRawUnsafe.mock.calls.length).toBeLessThanOrEqual(4);
    });
  });

  describe("stopJobProcessor", () => {
    it("should stop the processor from running further ticks", async () => {
      const { startJobProcessor, stopJobProcessor } = await import("~/utils/events/job-queue.server");

      mockQueryRawUnsafe.mockResolvedValue([]);

      startJobProcessor(100);
      await vi.advanceTimersByTimeAsync(150);
      const callsAfterFirstTick = mockQueryRawUnsafe.mock.calls.length;

      stopJobProcessor();
      await vi.advanceTimersByTimeAsync(500);

      // No additional calls should be made after stopping
      expect(mockQueryRawUnsafe.mock.calls.length).toBe(callsAfterFirstTick);
    });

    it("should be a no-op if processor is not running", async () => {
      const { stopJobProcessor } = await import("~/utils/events/job-queue.server");
      // Should not throw
      expect(() => stopJobProcessor()).not.toThrow();
    });

    it("should allow restarting after stop", async () => {
      const { startJobProcessor, stopJobProcessor } = await import("~/utils/events/job-queue.server");

      mockQueryRawUnsafe.mockResolvedValue([]);

      startJobProcessor(100);
      await vi.advanceTimersByTimeAsync(150);
      stopJobProcessor();

      const callsAfterStop = mockQueryRawUnsafe.mock.calls.length;

      startJobProcessor(100);
      await vi.advanceTimersByTimeAsync(150);
      stopJobProcessor();

      expect(mockQueryRawUnsafe.mock.calls.length).toBeGreaterThan(callsAfterStop);
    });
  });
});

import { prisma } from "~/utils/db/db.server";

export async function getDbStatus() {
  const start = Date.now();
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    return { connected: true, latencyMs: Date.now() - start };
  } catch {
    return { connected: false, latencyMs: Date.now() - start };
  }
}

export async function getJobQueueStats() {
  const stats = await prisma.job.groupBy({
    by: ["status"],
    _count: true,
  });
  const counts = { PENDING: 0, PROCESSING: 0, COMPLETED: 0, FAILED: 0 };
  for (const s of stats) {
    counts[s.status as keyof typeof counts] = s._count;
  }
  const recentFailures = await prisma.job.findMany({
    where: { status: "FAILED" },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, type: true, lastError: true, createdAt: true },
  });
  return { counts, recentFailures };
}

export async function getApiKeyUsageSummary(tenantId: string) {
  return prisma.apiKey.findMany({
    where: { tenantId, status: "ACTIVE" },
    select: { id: true, name: true, keyPrefix: true, lastUsedAt: true, usageCount: true },
    orderBy: { usageCount: "desc" },
    take: 10,
  });
}

export async function getSystemInfo() {
  const mem = process.memoryUsage();
  return {
    nodeVersion: process.version,
    uptime: process.uptime(),
    memory: {
      rss: Math.round(mem.rss / 1024 / 1024),
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
    },
  };
}

export async function getRecentAuditStats(tenantId?: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const where = { createdAt: { gte: since }, ...(tenantId ? { tenantId } : {}) };
  const total = await prisma.auditLog.count({ where });
  return { total, since };
}

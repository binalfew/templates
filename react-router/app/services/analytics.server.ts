import { prisma } from "~/utils/db/db.server";
import { logger } from "~/utils/monitoring/logger.server";

// ─── Types ────────────────────────────────────────────────

export interface SnapshotInput {
  tenantId: string;
  metric: string;
  value: number;
  dimensions?: Record<string, unknown>;
  period: string;
  timestamp: Date;
}

export interface MetricQuery {
  tenantId: string;
  metric: string;
  period?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}

export interface DashboardMetrics {
  totalUsers: number;
  activeUsers: number;
  totalRoles: number;
  totalPermissions: number;
  recentAuditLogs: number;
  activeSessions: number;
  usersByStatus: { status: string; count: number }[];
  recentActivity: { date: string; logins: number; actions: number }[];
}

// ─── Snapshot CRUD ────────────────────────────────────────

export async function recordSnapshot(input: SnapshotInput) {
  const snapshot = await prisma.analyticsSnapshot.create({
    data: {
      tenantId: input.tenantId,
      metric: input.metric,
      value: input.value,
      dimensions: (input.dimensions as object) ?? {},
      period: input.period,
      timestamp: input.timestamp,
    },
  });

  logger.info(
    { snapshotId: snapshot.id, metric: input.metric, value: input.value },
    "Analytics snapshot recorded",
  );
  return snapshot;
}

export async function querySnapshots(query: MetricQuery) {
  return prisma.analyticsSnapshot.findMany({
    where: {
      tenantId: query.tenantId,
      metric: query.metric,
      ...(query.period && { period: query.period }),
      ...(query.from || query.to
        ? {
            timestamp: {
              ...(query.from && { gte: query.from }),
              ...(query.to && { lte: query.to }),
            },
          }
        : {}),
    },
    orderBy: { timestamp: "asc" },
    ...(query.limit && { take: query.limit }),
  });
}

export async function deleteSnapshots(tenantId: string, metric?: string) {
  const result = await prisma.analyticsSnapshot.deleteMany({
    where: {
      tenantId,
      ...(metric && { metric }),
    },
  });

  logger.info({ tenantId, metric, count: result.count }, "Analytics snapshots deleted");
  return result.count;
}

// ─── Live Dashboard Metrics ───────────────────────────────

export async function getDashboardMetrics(tenantId: string): Promise<DashboardMetrics> {
  const tenantFilter = { tenantId };

  const [
    totalUsers,
    activeUsers,
    totalRoles,
    totalPermissions,
    recentAuditLogs,
    activeSessions,
    statusGroups,
  ] = await Promise.all([
    prisma.user.count({ where: { ...tenantFilter, deletedAt: null } }),
    prisma.user.count({ where: { ...tenantFilter, status: "ACTIVE", deletedAt: null } }),
    prisma.role.count({ where: tenantFilter }),
    prisma.permission.count(),
    prisma.auditLog.count({
      where: {
        tenantId,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.session.count({
      where: {
        expirationDate: { gt: new Date() },
        user: { tenantId },
      },
    }),
    prisma.user.groupBy({
      by: ["status"],
      where: { ...tenantFilter, deletedAt: null },
      _count: true,
    }),
  ]);

  const usersByStatus = statusGroups.map((g) => ({
    status: g.status ?? "UNKNOWN",
    count: g._count,
  }));

  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const recentSnapshots = await prisma.analyticsSnapshot.findMany({
    where: {
      tenantId,
      metric: { in: ["logins", "actions"] },
      period: "daily",
      timestamp: { gte: twoWeeksAgo },
    },
    orderBy: { timestamp: "asc" },
  });

  const activityMap = new Map<string, { logins: number; actions: number }>();
  for (const snap of recentSnapshots) {
    const date = snap.timestamp.toISOString().split("T")[0];
    const entry = activityMap.get(date) ?? { logins: 0, actions: 0 };
    if (snap.metric === "logins") entry.logins = snap.value;
    if (snap.metric === "actions") entry.actions = snap.value;
    activityMap.set(date, entry);
  }

  const recentActivity = Array.from(activityMap.entries()).map(([date, d]) => ({
    date,
    ...d,
  }));

  return {
    totalUsers,
    activeUsers,
    totalRoles,
    totalPermissions,
    recentAuditLogs,
    activeSessions,
    usersByStatus,
    recentActivity,
  };
}

// ─── Time-Series Queries ────────────────────────────────────

export interface TimeSeriesPoint {
  date: string;
  count: number;
}

function aggregateByDay(dates: Date[], days: number): TimeSeriesPoint[] {
  const map = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    map.set(d.toISOString().split("T")[0], 0);
  }
  for (const date of dates) {
    const key = date.toISOString().split("T")[0];
    if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([date, count]) => ({ date, count }));
}

export async function getUserGrowth(tenantId: string, days = 30): Promise<TimeSeriesPoint[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const users = await prisma.user.findMany({
    where: { tenantId, deletedAt: null, createdAt: { gte: since } },
    select: { createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return aggregateByDay(users.map((u) => u.createdAt), days);
}

export async function getLoginActivity(tenantId: string, days = 30): Promise<TimeSeriesPoint[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const logs = await prisma.auditLog.findMany({
    where: { tenantId, action: "LOGIN", createdAt: { gte: since } },
    select: { createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return aggregateByDay(logs.map((l) => l.createdAt), days);
}

export async function getRoleDistribution(tenantId: string): Promise<Array<{ name: string; value: number }>> {
  const roles = await prisma.role.findMany({
    where: { tenantId, deletedAt: null },
    select: { name: true, _count: { select: { userRoles: true } } },
  });
  return roles
    .map((r) => ({ name: r.name, value: r._count.userRoles }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);
}

export async function getSessionActivity(tenantId: string, days = 30): Promise<TimeSeriesPoint[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const sessions = await prisma.session.findMany({
    where: { createdAt: { gte: since }, user: { tenantId } },
    select: { createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return aggregateByDay(sessions.map((s) => s.createdAt), days);
}

// ─── CSV Export ────────────────────────────────────────────

export function metricsToCSV(metrics: DashboardMetrics): string {
  const lines: string[] = [];

  lines.push("Metric,Value");
  lines.push(`Total Users,${metrics.totalUsers}`);
  lines.push(`Active Users,${metrics.activeUsers}`);
  lines.push(`Total Roles,${metrics.totalRoles}`);
  lines.push(`Total Permissions,${metrics.totalPermissions}`);
  lines.push(`Recent Audit Logs,${metrics.recentAuditLogs}`);
  lines.push(`Active Sessions,${metrics.activeSessions}`);
  lines.push("");

  lines.push("Status,Count");
  for (const s of metrics.usersByStatus) {
    lines.push(`${s.status},${s.count}`);
  }
  lines.push("");

  lines.push("Date,Logins,Actions");
  for (const a of metrics.recentActivity) {
    lines.push(`${a.date},${a.logins},${a.actions}`);
  }

  return lines.join("\n");
}

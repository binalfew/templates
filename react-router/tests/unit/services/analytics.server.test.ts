import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock functions per Prisma model/method ─────────────────
const mockSnapshotCreate = vi.fn();
const mockSnapshotFindMany = vi.fn();
const mockSnapshotDeleteMany = vi.fn();
const mockUserCount = vi.fn();
const mockUserFindMany = vi.fn();
const mockUserGroupBy = vi.fn();
const mockRoleCount = vi.fn();
const mockRoleFindMany = vi.fn();
const mockPermissionCount = vi.fn();
const mockAuditLogCount = vi.fn();
const mockAuditLogFindMany = vi.fn();
const mockSessionCount = vi.fn();
const mockSessionFindMany = vi.fn();

vi.mock("~/utils/db/db.server", () => ({
  prisma: {
    analyticsSnapshot: {
      create: (...args: unknown[]) => mockSnapshotCreate(...args),
      findMany: (...args: unknown[]) => mockSnapshotFindMany(...args),
      deleteMany: (...args: unknown[]) => mockSnapshotDeleteMany(...args),
    },
    user: {
      count: (...args: unknown[]) => mockUserCount(...args),
      findMany: (...args: unknown[]) => mockUserFindMany(...args),
      groupBy: (...args: unknown[]) => mockUserGroupBy(...args),
    },
    role: {
      count: (...args: unknown[]) => mockRoleCount(...args),
      findMany: (...args: unknown[]) => mockRoleFindMany(...args),
    },
    permission: {
      count: (...args: unknown[]) => mockPermissionCount(...args),
    },
    auditLog: {
      count: (...args: unknown[]) => mockAuditLogCount(...args),
      findMany: (...args: unknown[]) => mockAuditLogFindMany(...args),
    },
    session: {
      count: (...args: unknown[]) => mockSessionCount(...args),
      findMany: (...args: unknown[]) => mockSessionFindMany(...args),
    },
  },
}));

vi.mock("~/utils/monitoring/logger.server", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("analytics.server", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ─── recordSnapshot ──────────────────────────────────────

  describe("recordSnapshot", () => {
    it("creates a snapshot and returns it", async () => {
      const { recordSnapshot } = await import("~/services/analytics.server");
      const now = new Date("2026-03-01T12:00:00Z");
      const input = {
        tenantId: "t-1",
        metric: "logins",
        value: 42,
        dimensions: { browser: "chrome" },
        period: "daily",
        timestamp: now,
      };
      mockSnapshotCreate.mockResolvedValue({ id: "snap-1", ...input });

      const result = await recordSnapshot(input);

      expect(result.id).toBe("snap-1");
      expect(result.metric).toBe("logins");
      expect(result.value).toBe(42);
      expect(mockSnapshotCreate).toHaveBeenCalledWith({
        data: {
          tenantId: "t-1",
          metric: "logins",
          value: 42,
          dimensions: { browser: "chrome" },
          period: "daily",
          timestamp: now,
        },
      });
    });

    it("defaults dimensions to empty object when not provided", async () => {
      const { recordSnapshot } = await import("~/services/analytics.server");
      const now = new Date("2026-03-01T12:00:00Z");
      mockSnapshotCreate.mockResolvedValue({ id: "snap-2" });

      await recordSnapshot({
        tenantId: "t-1",
        metric: "actions",
        value: 10,
        period: "daily",
        timestamp: now,
      });

      expect(mockSnapshotCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          dimensions: {},
        }),
      });
    });
  });

  // ─── querySnapshots ──────────────────────────────────────

  describe("querySnapshots", () => {
    it("queries snapshots with tenantId and metric", async () => {
      const { querySnapshots } = await import("~/services/analytics.server");
      mockSnapshotFindMany.mockResolvedValue([
        { id: "snap-1", metric: "logins", value: 10 },
        { id: "snap-2", metric: "logins", value: 20 },
      ]);

      const result = await querySnapshots({ tenantId: "t-1", metric: "logins" });

      expect(result).toHaveLength(2);
      expect(mockSnapshotFindMany).toHaveBeenCalledWith({
        where: { tenantId: "t-1", metric: "logins" },
        orderBy: { timestamp: "asc" },
      });
    });

    it("includes period filter when provided", async () => {
      const { querySnapshots } = await import("~/services/analytics.server");
      mockSnapshotFindMany.mockResolvedValue([]);

      await querySnapshots({ tenantId: "t-1", metric: "logins", period: "daily" });

      expect(mockSnapshotFindMany).toHaveBeenCalledWith({
        where: { tenantId: "t-1", metric: "logins", period: "daily" },
        orderBy: { timestamp: "asc" },
      });
    });

    it("includes date range filters when from and to are provided", async () => {
      const { querySnapshots } = await import("~/services/analytics.server");
      const from = new Date("2026-01-01");
      const to = new Date("2026-01-31");
      mockSnapshotFindMany.mockResolvedValue([]);

      await querySnapshots({ tenantId: "t-1", metric: "logins", from, to });

      expect(mockSnapshotFindMany).toHaveBeenCalledWith({
        where: {
          tenantId: "t-1",
          metric: "logins",
          timestamp: { gte: from, lte: to },
        },
        orderBy: { timestamp: "asc" },
      });
    });

    it("includes only from date when to is not provided", async () => {
      const { querySnapshots } = await import("~/services/analytics.server");
      const from = new Date("2026-01-01");
      mockSnapshotFindMany.mockResolvedValue([]);

      await querySnapshots({ tenantId: "t-1", metric: "logins", from });

      expect(mockSnapshotFindMany).toHaveBeenCalledWith({
        where: {
          tenantId: "t-1",
          metric: "logins",
          timestamp: { gte: from },
        },
        orderBy: { timestamp: "asc" },
      });
    });

    it("includes only to date when from is not provided", async () => {
      const { querySnapshots } = await import("~/services/analytics.server");
      const to = new Date("2026-01-31");
      mockSnapshotFindMany.mockResolvedValue([]);

      await querySnapshots({ tenantId: "t-1", metric: "logins", to });

      expect(mockSnapshotFindMany).toHaveBeenCalledWith({
        where: {
          tenantId: "t-1",
          metric: "logins",
          timestamp: { lte: to },
        },
        orderBy: { timestamp: "asc" },
      });
    });

    it("applies limit as take parameter", async () => {
      const { querySnapshots } = await import("~/services/analytics.server");
      mockSnapshotFindMany.mockResolvedValue([]);

      await querySnapshots({ tenantId: "t-1", metric: "logins", limit: 5 });

      expect(mockSnapshotFindMany).toHaveBeenCalledWith({
        where: { tenantId: "t-1", metric: "logins" },
        orderBy: { timestamp: "asc" },
        take: 5,
      });
    });
  });

  // ─── deleteSnapshots ─────────────────────────────────────

  describe("deleteSnapshots", () => {
    it("deletes all snapshots for a tenant", async () => {
      const { deleteSnapshots } = await import("~/services/analytics.server");
      mockSnapshotDeleteMany.mockResolvedValue({ count: 15 });

      const count = await deleteSnapshots("t-1");

      expect(count).toBe(15);
      expect(mockSnapshotDeleteMany).toHaveBeenCalledWith({
        where: { tenantId: "t-1" },
      });
    });

    it("deletes snapshots filtered by metric when provided", async () => {
      const { deleteSnapshots } = await import("~/services/analytics.server");
      mockSnapshotDeleteMany.mockResolvedValue({ count: 3 });

      const count = await deleteSnapshots("t-1", "logins");

      expect(count).toBe(3);
      expect(mockSnapshotDeleteMany).toHaveBeenCalledWith({
        where: { tenantId: "t-1", metric: "logins" },
      });
    });

    it("returns 0 when no snapshots match", async () => {
      const { deleteSnapshots } = await import("~/services/analytics.server");
      mockSnapshotDeleteMany.mockResolvedValue({ count: 0 });

      const count = await deleteSnapshots("t-1", "nonexistent");

      expect(count).toBe(0);
    });
  });

  // ─── getDashboardMetrics ─────────────────────────────────

  describe("getDashboardMetrics", () => {
    it("returns aggregated dashboard metrics", async () => {
      const { getDashboardMetrics } = await import("~/services/analytics.server");

      mockUserCount
        .mockResolvedValueOnce(100) // totalUsers
        .mockResolvedValueOnce(80); // activeUsers
      mockRoleCount.mockResolvedValue(5);
      mockPermissionCount.mockResolvedValue(20);
      mockAuditLogCount.mockResolvedValue(150);
      mockSessionCount.mockResolvedValue(30);
      mockUserGroupBy.mockResolvedValue([
        { status: "ACTIVE", _count: 80 },
        { status: "INACTIVE", _count: 15 },
        { status: "PENDING", _count: 5 },
      ]);
      mockSnapshotFindMany.mockResolvedValue([
        {
          metric: "logins",
          value: 10,
          timestamp: new Date("2026-03-01T00:00:00Z"),
        },
        {
          metric: "actions",
          value: 25,
          timestamp: new Date("2026-03-01T00:00:00Z"),
        },
        {
          metric: "logins",
          value: 15,
          timestamp: new Date("2026-03-02T00:00:00Z"),
        },
      ]);

      const result = await getDashboardMetrics("t-1");

      expect(result.totalUsers).toBe(100);
      expect(result.activeUsers).toBe(80);
      expect(result.totalRoles).toBe(5);
      expect(result.totalPermissions).toBe(20);
      expect(result.recentAuditLogs).toBe(150);
      expect(result.activeSessions).toBe(30);
      expect(result.usersByStatus).toEqual([
        { status: "ACTIVE", count: 80 },
        { status: "INACTIVE", count: 15 },
        { status: "PENDING", count: 5 },
      ]);
      expect(result.recentActivity).toHaveLength(2);
      expect(result.recentActivity[0]).toEqual({
        date: "2026-03-01",
        logins: 10,
        actions: 25,
      });
      expect(result.recentActivity[1]).toEqual({
        date: "2026-03-02",
        logins: 15,
        actions: 0,
      });
    });

    it("handles null status in groupBy as UNKNOWN", async () => {
      const { getDashboardMetrics } = await import("~/services/analytics.server");

      mockUserCount.mockResolvedValue(0).mockResolvedValueOnce(1).mockResolvedValueOnce(0);
      mockRoleCount.mockResolvedValue(0);
      mockPermissionCount.mockResolvedValue(0);
      mockAuditLogCount.mockResolvedValue(0);
      mockSessionCount.mockResolvedValue(0);
      mockUserGroupBy.mockResolvedValue([{ status: null, _count: 1 }]);
      mockSnapshotFindMany.mockResolvedValue([]);

      const result = await getDashboardMetrics("t-1");

      expect(result.usersByStatus).toEqual([{ status: "UNKNOWN", count: 1 }]);
    });

    it("returns empty recentActivity when no snapshots exist", async () => {
      const { getDashboardMetrics } = await import("~/services/analytics.server");

      mockUserCount.mockResolvedValue(0);
      mockRoleCount.mockResolvedValue(0);
      mockPermissionCount.mockResolvedValue(0);
      mockAuditLogCount.mockResolvedValue(0);
      mockSessionCount.mockResolvedValue(0);
      mockUserGroupBy.mockResolvedValue([]);
      mockSnapshotFindMany.mockResolvedValue([]);

      const result = await getDashboardMetrics("t-1");

      expect(result.recentActivity).toEqual([]);
    });
  });

  // ─── getUserGrowth ───────────────────────────────────────

  describe("getUserGrowth", () => {
    it("returns time series of user creation over the default 30 days", async () => {
      const { getUserGrowth } = await import("~/services/analytics.server");
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];

      mockUserFindMany.mockResolvedValue([{ createdAt: today }]);

      const result = await getUserGrowth("t-1");

      expect(result).toHaveLength(30);
      expect(mockUserFindMany).toHaveBeenCalledWith({
        where: {
          tenantId: "t-1",
          deletedAt: null,
          createdAt: { gte: expect.any(Date) },
        },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      });
      // The last entry should be today with count 1
      const todayEntry = result.find((p) => p.date === todayStr);
      expect(todayEntry?.count).toBe(1);
    });

    it("returns time series for a custom number of days", async () => {
      const { getUserGrowth } = await import("~/services/analytics.server");
      mockUserFindMany.mockResolvedValue([]);

      const result = await getUserGrowth("t-1", 7);

      expect(result).toHaveLength(7);
      // All entries should have count 0
      for (const point of result) {
        expect(point.count).toBe(0);
      }
    });

    it("aggregates multiple users on the same day", async () => {
      const { getUserGrowth } = await import("~/services/analytics.server");
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];

      mockUserFindMany.mockResolvedValue([
        { createdAt: today },
        { createdAt: today },
        { createdAt: today },
      ]);

      const result = await getUserGrowth("t-1", 7);
      const todayEntry = result.find((p) => p.date === todayStr);
      expect(todayEntry?.count).toBe(3);
    });
  });

  // ─── getLoginActivity ────────────────────────────────────

  describe("getLoginActivity", () => {
    it("returns time series of login audit logs", async () => {
      const { getLoginActivity } = await import("~/services/analytics.server");
      mockAuditLogFindMany.mockResolvedValue([]);

      const result = await getLoginActivity("t-1", 14);

      expect(result).toHaveLength(14);
      expect(mockAuditLogFindMany).toHaveBeenCalledWith({
        where: {
          tenantId: "t-1",
          action: "LOGIN",
          createdAt: { gte: expect.any(Date) },
        },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      });
    });

    it("counts login entries per day", async () => {
      const { getLoginActivity } = await import("~/services/analytics.server");
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];

      mockAuditLogFindMany.mockResolvedValue([
        { createdAt: today },
        { createdAt: today },
      ]);

      const result = await getLoginActivity("t-1");
      const todayEntry = result.find((p) => p.date === todayStr);
      expect(todayEntry?.count).toBe(2);
    });
  });

  // ─── getRoleDistribution ─────────────────────────────────

  describe("getRoleDistribution", () => {
    it("returns roles sorted by user count descending", async () => {
      const { getRoleDistribution } = await import("~/services/analytics.server");
      mockRoleFindMany.mockResolvedValue([
        { name: "Admin", _count: { userRoles: 5 } },
        { name: "Editor", _count: { userRoles: 12 } },
        { name: "Viewer", _count: { userRoles: 3 } },
      ]);

      const result = await getRoleDistribution("t-1");

      expect(result).toEqual([
        { name: "Editor", value: 12 },
        { name: "Admin", value: 5 },
        { name: "Viewer", value: 3 },
      ]);
    });

    it("filters out roles with zero users", async () => {
      const { getRoleDistribution } = await import("~/services/analytics.server");
      mockRoleFindMany.mockResolvedValue([
        { name: "Admin", _count: { userRoles: 5 } },
        { name: "Unused", _count: { userRoles: 0 } },
      ]);

      const result = await getRoleDistribution("t-1");

      expect(result).toEqual([{ name: "Admin", value: 5 }]);
    });

    it("returns empty array when no roles exist", async () => {
      const { getRoleDistribution } = await import("~/services/analytics.server");
      mockRoleFindMany.mockResolvedValue([]);

      const result = await getRoleDistribution("t-1");

      expect(result).toEqual([]);
    });

    it("queries only non-deleted roles for the tenant", async () => {
      const { getRoleDistribution } = await import("~/services/analytics.server");
      mockRoleFindMany.mockResolvedValue([]);

      await getRoleDistribution("t-1");

      expect(mockRoleFindMany).toHaveBeenCalledWith({
        where: { tenantId: "t-1", deletedAt: null },
        select: { name: true, _count: { select: { userRoles: true } } },
      });
    });
  });

  // ─── getSessionActivity ──────────────────────────────────

  describe("getSessionActivity", () => {
    it("returns time series of session creation", async () => {
      const { getSessionActivity } = await import("~/services/analytics.server");
      mockSessionFindMany.mockResolvedValue([]);

      const result = await getSessionActivity("t-1", 7);

      expect(result).toHaveLength(7);
      expect(mockSessionFindMany).toHaveBeenCalledWith({
        where: {
          createdAt: { gte: expect.any(Date) },
          user: { tenantId: "t-1" },
        },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      });
    });

    it("aggregates sessions per day", async () => {
      const { getSessionActivity } = await import("~/services/analytics.server");
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];

      mockSessionFindMany.mockResolvedValue([
        { createdAt: today },
        { createdAt: today },
        { createdAt: today },
        { createdAt: today },
      ]);

      const result = await getSessionActivity("t-1", 7);
      const todayEntry = result.find((p) => p.date === todayStr);
      expect(todayEntry?.count).toBe(4);
    });

    it("uses default 30 days when no days argument provided", async () => {
      const { getSessionActivity } = await import("~/services/analytics.server");
      mockSessionFindMany.mockResolvedValue([]);

      const result = await getSessionActivity("t-1");

      expect(result).toHaveLength(30);
    });
  });

  // ─── metricsToCSV ────────────────────────────────────────

  describe("metricsToCSV", () => {
    it("converts full dashboard metrics to CSV format", async () => {
      const { metricsToCSV } = await import("~/services/analytics.server");

      const csv = metricsToCSV({
        totalUsers: 100,
        activeUsers: 80,
        totalRoles: 5,
        totalPermissions: 20,
        recentAuditLogs: 150,
        activeSessions: 30,
        usersByStatus: [
          { status: "ACTIVE", count: 80 },
          { status: "INACTIVE", count: 20 },
        ],
        recentActivity: [
          { date: "2026-03-01", logins: 10, actions: 25 },
          { date: "2026-03-02", logins: 15, actions: 30 },
        ],
      });

      const lines = csv.split("\n");
      expect(lines[0]).toBe("Metric,Value");
      expect(lines[1]).toBe("Total Users,100");
      expect(lines[2]).toBe("Active Users,80");
      expect(lines[3]).toBe("Total Roles,5");
      expect(lines[4]).toBe("Total Permissions,20");
      expect(lines[5]).toBe("Recent Audit Logs,150");
      expect(lines[6]).toBe("Active Sessions,30");
      expect(lines[7]).toBe("");
      expect(lines[8]).toBe("Status,Count");
      expect(lines[9]).toBe("ACTIVE,80");
      expect(lines[10]).toBe("INACTIVE,20");
      expect(lines[11]).toBe("");
      expect(lines[12]).toBe("Date,Logins,Actions");
      expect(lines[13]).toBe("2026-03-01,10,25");
      expect(lines[14]).toBe("2026-03-02,15,30");
    });

    it("handles empty usersByStatus and recentActivity", async () => {
      const { metricsToCSV } = await import("~/services/analytics.server");

      const csv = metricsToCSV({
        totalUsers: 0,
        activeUsers: 0,
        totalRoles: 0,
        totalPermissions: 0,
        recentAuditLogs: 0,
        activeSessions: 0,
        usersByStatus: [],
        recentActivity: [],
      });

      const lines = csv.split("\n");
      expect(lines).toContain("Metric,Value");
      expect(lines).toContain("Total Users,0");
      expect(lines).toContain("Status,Count");
      expect(lines).toContain("Date,Logins,Actions");
    });
  });
});

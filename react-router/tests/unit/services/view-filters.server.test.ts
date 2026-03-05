import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── saved-views mocks ──────────────────────────────────
const mockGetView = vi.fn();
const mockGetDefaultView = vi.fn();
const mockListViews = vi.fn();

vi.mock("~/services/saved-views.server", () => ({
  getView: (...args: unknown[]) => mockGetView(...args),
  getDefaultView: (...args: unknown[]) => mockGetDefaultView(...args),
  listViews: (...args: unknown[]) => mockListViews(...args),
}));

// ─── feature-flags mocks ────────────────────────────────
const mockIsFeatureEnabled = vi.fn();

vi.mock("~/lib/config/feature-flags.server", () => ({
  isFeatureEnabled: (...args: unknown[]) => mockIsFeatureEnabled(...args),
  FEATURE_FLAG_KEYS: {
    SAVED_VIEWS: "FF_SAVED_VIEWS",
  },
}));

vi.mock("~/lib/monitoring/logger.server", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ─── Shared helpers ─────────────────────────────────────

function makeRequest(url: string): Request {
  return new Request(url);
}

const sampleFieldMap = {
  name: "name",
  status: "status",
  email: "user.email",
  createdAt: "createdAt",
};

function makeSavedView(overrides: Record<string, unknown> = {}) {
  return {
    id: "v-1",
    tenantId: "t-1",
    userId: "u-1",
    name: "Active Users",
    entityType: "User",
    viewType: "TABLE",
    filters: [{ field: "status", operator: "eq", value: "ACTIVE" }],
    sorts: [{ field: "name", direction: "asc" }],
    columns: ["name", "email"],
    config: {},
    isShared: false,
    isDefault: true,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════
// Tests
// ═════════════════════════════════════════════════════════

describe("view-filters.server", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ─────────────────────────────────────────────────────
  // buildPrismaWhere
  // ─────────────────────────────────────────────────────

  describe("buildPrismaWhere", () => {
    it("returns empty object for no filters", async () => {
      const { buildPrismaWhere } = await import("~/services/view-filters.server");

      const result = buildPrismaWhere([], sampleFieldMap);

      expect(result).toEqual({});
    });

    it("handles eq operator", async () => {
      const { buildPrismaWhere } = await import("~/services/view-filters.server");

      const result = buildPrismaWhere(
        [{ field: "status", operator: "eq", value: "ACTIVE" }],
        sampleFieldMap,
      );

      expect(result).toEqual({ status: "ACTIVE" });
    });

    it("handles neq operator", async () => {
      const { buildPrismaWhere } = await import("~/services/view-filters.server");

      const result = buildPrismaWhere(
        [{ field: "status", operator: "neq", value: "INACTIVE" }],
        sampleFieldMap,
      );

      expect(result).toEqual({ status: { not: "INACTIVE" } });
    });

    it("handles contains operator with case insensitive mode", async () => {
      const { buildPrismaWhere } = await import("~/services/view-filters.server");

      const result = buildPrismaWhere(
        [{ field: "name", operator: "contains", value: "john" }],
        sampleFieldMap,
      );

      expect(result).toEqual({ name: { contains: "john", mode: "insensitive" } });
    });

    it("handles gt operator", async () => {
      const { buildPrismaWhere } = await import("~/services/view-filters.server");

      const result = buildPrismaWhere(
        [{ field: "createdAt", operator: "gt", value: "2025-01-01" }],
        sampleFieldMap,
      );

      expect(result).toEqual({ createdAt: { gt: "2025-01-01" } });
    });

    it("handles lt operator", async () => {
      const { buildPrismaWhere } = await import("~/services/view-filters.server");

      const result = buildPrismaWhere(
        [{ field: "createdAt", operator: "lt", value: "2025-12-31" }],
        sampleFieldMap,
      );

      expect(result).toEqual({ createdAt: { lt: "2025-12-31" } });
    });

    it("handles gte operator", async () => {
      const { buildPrismaWhere } = await import("~/services/view-filters.server");

      const result = buildPrismaWhere(
        [{ field: "createdAt", operator: "gte", value: "2025-06-01" }],
        sampleFieldMap,
      );

      expect(result).toEqual({ createdAt: { gte: "2025-06-01" } });
    });

    it("handles lte operator", async () => {
      const { buildPrismaWhere } = await import("~/services/view-filters.server");

      const result = buildPrismaWhere(
        [{ field: "createdAt", operator: "lte", value: "2025-06-30" }],
        sampleFieldMap,
      );

      expect(result).toEqual({ createdAt: { lte: "2025-06-30" } });
    });

    it("handles in operator with array value", async () => {
      const { buildPrismaWhere } = await import("~/services/view-filters.server");

      const result = buildPrismaWhere(
        [{ field: "status", operator: "in", value: ["ACTIVE", "PENDING"] }],
        sampleFieldMap,
      );

      expect(result).toEqual({ status: { in: ["ACTIVE", "PENDING"] } });
    });

    it("handles in operator with scalar value by wrapping in array", async () => {
      const { buildPrismaWhere } = await import("~/services/view-filters.server");

      const result = buildPrismaWhere(
        [{ field: "status", operator: "in", value: "ACTIVE" }],
        sampleFieldMap,
      );

      expect(result).toEqual({ status: { in: ["ACTIVE"] } });
    });

    it("falls back to equality for unknown operator", async () => {
      const { buildPrismaWhere } = await import("~/services/view-filters.server");

      const result = buildPrismaWhere(
        [{ field: "status", operator: "unknown_op", value: "test" }],
        sampleFieldMap,
      );

      expect(result).toEqual({ status: "test" });
    });

    it("maps field names through fieldMap", async () => {
      const { buildPrismaWhere } = await import("~/services/view-filters.server");

      const result = buildPrismaWhere(
        [{ field: "email", operator: "contains", value: "@example.com" }],
        sampleFieldMap,
      );

      expect(result).toEqual({
        "user.email": { contains: "@example.com", mode: "insensitive" },
      });
    });

    it("uses raw field name when not in fieldMap", async () => {
      const { buildPrismaWhere } = await import("~/services/view-filters.server");

      const result = buildPrismaWhere(
        [{ field: "customField", operator: "eq", value: "abc" }],
        sampleFieldMap,
      );

      expect(result).toEqual({ customField: "abc" });
    });

    it("handles multiple filters", async () => {
      const { buildPrismaWhere } = await import("~/services/view-filters.server");

      const result = buildPrismaWhere(
        [
          { field: "status", operator: "eq", value: "ACTIVE" },
          { field: "name", operator: "contains", value: "John" },
          { field: "createdAt", operator: "gte", value: "2025-01-01" },
        ],
        sampleFieldMap,
      );

      expect(result).toEqual({
        status: "ACTIVE",
        name: { contains: "John", mode: "insensitive" },
        createdAt: { gte: "2025-01-01" },
      });
    });
  });

  // ─────────────────────────────────────────────────────
  // buildPrismaOrderBy
  // ─────────────────────────────────────────────────────

  describe("buildPrismaOrderBy", () => {
    it("returns empty array for no sorts", async () => {
      const { buildPrismaOrderBy } = await import("~/services/view-filters.server");

      const result = buildPrismaOrderBy([], sampleFieldMap);

      expect(result).toEqual([]);
    });

    it("maps a single sort", async () => {
      const { buildPrismaOrderBy } = await import("~/services/view-filters.server");

      const result = buildPrismaOrderBy(
        [{ field: "name", direction: "asc" }],
        sampleFieldMap,
      );

      expect(result).toEqual([{ name: "asc" }]);
    });

    it("maps a desc sort", async () => {
      const { buildPrismaOrderBy } = await import("~/services/view-filters.server");

      const result = buildPrismaOrderBy(
        [{ field: "createdAt", direction: "desc" }],
        sampleFieldMap,
      );

      expect(result).toEqual([{ createdAt: "desc" }]);
    });

    it("maps field names through fieldMap", async () => {
      const { buildPrismaOrderBy } = await import("~/services/view-filters.server");

      const result = buildPrismaOrderBy(
        [{ field: "email", direction: "asc" }],
        sampleFieldMap,
      );

      expect(result).toEqual([{ "user.email": "asc" }]);
    });

    it("uses raw field name when not in fieldMap", async () => {
      const { buildPrismaOrderBy } = await import("~/services/view-filters.server");

      const result = buildPrismaOrderBy(
        [{ field: "unknownField", direction: "desc" }],
        sampleFieldMap,
      );

      expect(result).toEqual([{ unknownField: "desc" }]);
    });

    it("handles multiple sorts preserving order", async () => {
      const { buildPrismaOrderBy } = await import("~/services/view-filters.server");

      const result = buildPrismaOrderBy(
        [
          { field: "name", direction: "asc" },
          { field: "createdAt", direction: "desc" },
        ],
        sampleFieldMap,
      );

      expect(result).toEqual([{ name: "asc" }, { createdAt: "desc" }]);
    });
  });

  // ─────────────────────────────────────────────────────
  // resolveActiveView
  // ─────────────────────────────────────────────────────

  describe("resolveActiveView", () => {
    it("uses viewId from URL search params when present", async () => {
      const { resolveActiveView } = await import("~/services/view-filters.server");
      const view = makeSavedView();
      mockListViews.mockResolvedValue([view]);
      mockGetView.mockResolvedValue(view);

      const result = await resolveActiveView(
        makeRequest("https://app.test/users?viewId=v-1"),
        "t-1",
        "u-1",
        "User",
      );

      expect(result.activeView).toEqual(view);
      expect(mockGetView).toHaveBeenCalledWith("v-1", "t-1");
    });

    it("falls back to default view when viewId is not provided", async () => {
      const { resolveActiveView } = await import("~/services/view-filters.server");
      const defaultView = makeSavedView({ id: "v-default", isDefault: true });
      mockListViews.mockResolvedValue([defaultView]);
      mockGetDefaultView.mockResolvedValue(defaultView);

      const result = await resolveActiveView(
        makeRequest("https://app.test/users"),
        "t-1",
        "u-1",
        "User",
      );

      expect(result.activeView).toEqual(defaultView);
      expect(mockGetView).not.toHaveBeenCalled();
      expect(mockGetDefaultView).toHaveBeenCalledWith("t-1", "u-1", "User");
    });

    it("falls back to default view when viewId is invalid", async () => {
      const { resolveActiveView } = await import("~/services/view-filters.server");
      const defaultView = makeSavedView({ id: "v-default" });
      mockListViews.mockResolvedValue([defaultView]);
      mockGetView.mockRejectedValue(new Error("View not found"));
      mockGetDefaultView.mockResolvedValue(defaultView);

      const result = await resolveActiveView(
        makeRequest("https://app.test/users?viewId=nonexistent"),
        "t-1",
        "u-1",
        "User",
      );

      expect(result.activeView).toEqual(defaultView);
      expect(mockGetView).toHaveBeenCalledWith("nonexistent", "t-1");
      expect(mockGetDefaultView).toHaveBeenCalled();
    });

    it("returns null activeView when no views exist", async () => {
      const { resolveActiveView } = await import("~/services/view-filters.server");
      mockListViews.mockResolvedValue([]);
      mockGetDefaultView.mockResolvedValue(null);

      const result = await resolveActiveView(
        makeRequest("https://app.test/users"),
        "t-1",
        "u-1",
        "User",
      );

      expect(result.activeView).toBeNull();
      expect(result.availableViews).toEqual([]);
    });

    it("returns available views from listViews", async () => {
      const { resolveActiveView } = await import("~/services/view-filters.server");
      const views = [
        makeSavedView({ id: "v-1", name: "Active" }),
        makeSavedView({ id: "v-2", name: "Inactive", isShared: true }),
      ];
      mockListViews.mockResolvedValue(views);
      mockGetDefaultView.mockResolvedValue(views[0]);

      const result = await resolveActiveView(
        makeRequest("https://app.test/users"),
        "t-1",
        "u-1",
        "User",
      );

      expect(result.availableViews).toHaveLength(2);
      expect(mockListViews).toHaveBeenCalledWith("t-1", "u-1", "User");
    });
  });

  // ─────────────────────────────────────────────────────
  // resolveViewContext
  // ─────────────────────────────────────────────────────

  describe("resolveViewContext", () => {
    it("returns empty context when saved views feature is disabled", async () => {
      const { resolveViewContext } = await import("~/services/view-filters.server");
      mockIsFeatureEnabled.mockResolvedValue(false);

      const result = await resolveViewContext(
        makeRequest("https://app.test/users"),
        "t-1",
        "u-1",
        "User",
        sampleFieldMap,
      );

      expect(result).toEqual({
        savedViewsEnabled: false,
        activeViewId: null,
        activeViewType: null,
        availableViews: [],
        viewWhere: {},
        viewOrderBy: [],
      });
      expect(mockListViews).not.toHaveBeenCalled();
    });

    it("checks the SAVED_VIEWS feature flag with correct context", async () => {
      const { resolveViewContext } = await import("~/services/view-filters.server");
      mockIsFeatureEnabled.mockResolvedValue(false);

      await resolveViewContext(
        makeRequest("https://app.test/users"),
        "t-1",
        "u-1",
        "User",
        sampleFieldMap,
      );

      expect(mockIsFeatureEnabled).toHaveBeenCalledWith("FF_SAVED_VIEWS", {
        tenantId: "t-1",
        userId: "u-1",
      });
    });

    it("returns full context when saved views is enabled and active view exists", async () => {
      const { resolveViewContext } = await import("~/services/view-filters.server");
      mockIsFeatureEnabled.mockResolvedValue(true);

      const view = makeSavedView({
        filters: [
          { field: "status", operator: "eq", value: "ACTIVE" },
          { field: "name", operator: "contains", value: "John" },
        ],
        sorts: [{ field: "name", direction: "asc" }],
      });
      const views = [
        { ...view },
        {
          id: "v-2",
          name: "Shared View",
          viewType: "KANBAN",
          isDefault: false,
          isShared: true,
          userId: "u-other",
        },
      ];
      mockListViews.mockResolvedValue(views);
      mockGetDefaultView.mockResolvedValue(view);

      const result = await resolveViewContext(
        makeRequest("https://app.test/users"),
        "t-1",
        "u-1",
        "User",
        sampleFieldMap,
      );

      expect(result.savedViewsEnabled).toBe(true);
      expect(result.activeViewId).toBe("v-1");
      expect(result.activeViewType).toBe("TABLE");
      expect(result.viewWhere).toEqual({
        status: "ACTIVE",
        name: { contains: "John", mode: "insensitive" },
      });
      expect(result.viewOrderBy).toEqual([{ name: "asc" }]);
      expect(result.availableViews).toHaveLength(2);
      expect(result.availableViews[0]).toEqual({
        id: "v-1",
        name: "Active Users",
        viewType: "TABLE",
        isDefault: true,
        isShared: false,
      });
      expect(result.availableViews[1]).toEqual({
        id: "v-2",
        name: "Shared View",
        viewType: "KANBAN",
        isDefault: false,
        isShared: true,
      });
    });

    it("returns empty where/orderBy when no active view", async () => {
      const { resolveViewContext } = await import("~/services/view-filters.server");
      mockIsFeatureEnabled.mockResolvedValue(true);
      mockListViews.mockResolvedValue([]);
      mockGetDefaultView.mockResolvedValue(null);

      const result = await resolveViewContext(
        makeRequest("https://app.test/users"),
        "t-1",
        "u-1",
        "User",
        sampleFieldMap,
      );

      expect(result.savedViewsEnabled).toBe(true);
      expect(result.activeViewId).toBeNull();
      expect(result.activeViewType).toBeNull();
      expect(result.viewWhere).toEqual({});
      expect(result.viewOrderBy).toEqual([]);
    });

    it("uses viewId from URL when provided", async () => {
      const { resolveViewContext } = await import("~/services/view-filters.server");
      mockIsFeatureEnabled.mockResolvedValue(true);

      const view = makeSavedView({
        id: "v-specific",
        filters: [{ field: "status", operator: "neq", value: "DELETED" }],
        sorts: [{ field: "createdAt", direction: "desc" }],
      });
      mockListViews.mockResolvedValue([view]);
      mockGetView.mockResolvedValue(view);

      const result = await resolveViewContext(
        makeRequest("https://app.test/users?viewId=v-specific"),
        "t-1",
        "u-1",
        "User",
        sampleFieldMap,
      );

      expect(result.activeViewId).toBe("v-specific");
      expect(result.viewWhere).toEqual({ status: { not: "DELETED" } });
      expect(result.viewOrderBy).toEqual([{ createdAt: "desc" }]);
      expect(mockGetView).toHaveBeenCalledWith("v-specific", "t-1");
    });

    it("maps available views to the AvailableView shape", async () => {
      const { resolveViewContext } = await import("~/services/view-filters.server");
      mockIsFeatureEnabled.mockResolvedValue(true);
      mockListViews.mockResolvedValue([
        {
          id: "v-1",
          name: "My Table",
          viewType: "TABLE",
          isDefault: true,
          isShared: false,
          userId: "u-1",
          tenantId: "t-1",
          entityType: "User",
          filters: [],
          sorts: [],
          columns: [],
          config: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      mockGetDefaultView.mockResolvedValue({
        id: "v-1",
        filters: [],
        sorts: [],
        viewType: "TABLE",
      });

      const result = await resolveViewContext(
        makeRequest("https://app.test/users"),
        "t-1",
        "u-1",
        "User",
        sampleFieldMap,
      );

      expect(result.availableViews).toEqual([
        {
          id: "v-1",
          name: "My Table",
          viewType: "TABLE",
          isDefault: true,
          isShared: false,
        },
      ]);
    });

    it("builds where with fieldMap translations for active view filters", async () => {
      const { resolveViewContext } = await import("~/services/view-filters.server");
      mockIsFeatureEnabled.mockResolvedValue(true);

      const view = makeSavedView({
        filters: [{ field: "email", operator: "contains", value: "@test.com" }],
        sorts: [{ field: "email", direction: "asc" }],
      });
      mockListViews.mockResolvedValue([view]);
      mockGetDefaultView.mockResolvedValue(view);

      const result = await resolveViewContext(
        makeRequest("https://app.test/users"),
        "t-1",
        "u-1",
        "User",
        sampleFieldMap,
      );

      // email maps to user.email in sampleFieldMap
      expect(result.viewWhere).toEqual({
        "user.email": { contains: "@test.com", mode: "insensitive" },
      });
      expect(result.viewOrderBy).toEqual([{ "user.email": "asc" }]);
    });

    it("handles view with empty filters and sorts", async () => {
      const { resolveViewContext } = await import("~/services/view-filters.server");
      mockIsFeatureEnabled.mockResolvedValue(true);

      const view = makeSavedView({
        filters: [],
        sorts: [],
      });
      mockListViews.mockResolvedValue([view]);
      mockGetDefaultView.mockResolvedValue(view);

      const result = await resolveViewContext(
        makeRequest("https://app.test/users"),
        "t-1",
        "u-1",
        "User",
        sampleFieldMap,
      );

      expect(result.viewWhere).toEqual({});
      expect(result.viewOrderBy).toEqual([]);
    });
  });
});

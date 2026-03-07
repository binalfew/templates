import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateMany = vi.fn();
const mockDelete = vi.fn();
const mockFindUniqueOrThrow = vi.fn();
const mockFindMany = vi.fn();
const mockFindFirst = vi.fn();

vi.mock("~/utils/db/db.server", () => ({
  prisma: {
    savedView: {
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
      findUniqueOrThrow: (...args: unknown[]) => mockFindUniqueOrThrow(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}));

vi.mock("~/utils/monitoring/logger.server", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("saved-views.server", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("createView", () => {
    it("creates a view with defaults", async () => {
      const { createView } = await import("~/services/saved-views.server");
      mockCreate.mockResolvedValue({
        id: "v-1",
        tenantId: "t-1",
        userId: "u-1",
        name: "My View",
        entityType: "Participant",
        viewType: "TABLE",
        filters: [],
        sorts: [],
        columns: [],
        config: {},
        isShared: false,
        isDefault: false,
      });

      const result = await createView({
        tenantId: "t-1",
        userId: "u-1",
        name: "My View",
        entityType: "Participant",
      });

      expect(result.id).toBe("v-1");
      expect(result.viewType).toBe("TABLE");
      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: "t-1",
          userId: "u-1",
          name: "My View",
          entityType: "Participant",
          viewType: "TABLE",
        }),
      });
    });
  });

  describe("updateView", () => {
    it("updates a view owned by the user", async () => {
      const { updateView } = await import("~/services/saved-views.server");
      mockFindFirst.mockResolvedValue({
        id: "v-1",
        userId: "u-1",
        tenantId: "t-1",
        entityType: "Participant",
      });
      mockUpdate.mockResolvedValue({ id: "v-1", name: "Renamed" });

      const result = await updateView("v-1", "u-1", "t-1", { name: "Renamed" });

      expect(result.name).toBe("Renamed");
    });

    it("throws when updating another user's view", async () => {
      const { updateView, SavedViewError } = await import("~/services/saved-views.server");
      mockFindFirst.mockResolvedValue({
        id: "v-1",
        userId: "u-other",
        tenantId: "t-1",
      });

      await expect(updateView("v-1", "u-1", "t-1", { name: "Hack" })).rejects.toThrow(SavedViewError);
    });

    it("unsets other defaults when setting a view as default", async () => {
      const { updateView } = await import("~/services/saved-views.server");
      mockFindFirst.mockResolvedValue({
        id: "v-1",
        userId: "u-1",
        tenantId: "t-1",
        entityType: "Participant",
      });
      mockUpdateMany.mockResolvedValue({ count: 1 });
      mockUpdate.mockResolvedValue({ id: "v-1", isDefault: true });

      await updateView("v-1", "u-1", "t-1", { isDefault: true });

      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: {
          tenantId: "t-1",
          userId: "u-1",
          entityType: "Participant",
          isDefault: true,
          id: { not: "v-1" },
        },
        data: { isDefault: false },
      });
    });
  });

  describe("deleteView", () => {
    it("deletes a view owned by the user", async () => {
      const { deleteView } = await import("~/services/saved-views.server");
      mockFindFirst.mockResolvedValue({ id: "v-1", userId: "u-1" });
      mockDelete.mockResolvedValue({});

      await deleteView("v-1", "u-1", "t-1");

      expect(mockDelete).toHaveBeenCalledWith({ where: { id: "v-1" } });
    });

    it("throws when deleting another user's view", async () => {
      const { deleteView, SavedViewError } = await import("~/services/saved-views.server");
      mockFindFirst.mockResolvedValue({ id: "v-1", userId: "u-other" });

      await expect(deleteView("v-1", "u-1", "t-1")).rejects.toThrow(SavedViewError);
    });
  });

  describe("listViews", () => {
    it("returns personal and shared views", async () => {
      const { listViews } = await import("~/services/saved-views.server");
      mockFindMany.mockResolvedValue([
        { id: "v-1", name: "My View", userId: "u-1", isShared: false },
        { id: "v-2", name: "Team View", userId: "u-other", isShared: true },
      ]);

      const result = await listViews("t-1", "u-1", "Participant");

      expect(result).toHaveLength(2);
      expect(mockFindMany).toHaveBeenCalledWith({
        where: {
          tenantId: "t-1",
          entityType: "Participant",
          OR: [{ userId: "u-1" }, { isShared: true }],
        },
        include: { owner: { select: { id: true, name: true } } },
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      });
    });
  });

  describe("getDefaultView", () => {
    it("returns the default view", async () => {
      const { getDefaultView } = await import("~/services/saved-views.server");
      mockFindFirst.mockResolvedValue({ id: "v-1", isDefault: true });

      const result = await getDefaultView("t-1", "u-1", "Participant");

      expect(result?.id).toBe("v-1");
    });

    it("returns null when no default exists", async () => {
      const { getDefaultView } = await import("~/services/saved-views.server");
      mockFindFirst.mockResolvedValue(null);

      const result = await getDefaultView("t-1", "u-1", "Participant");

      expect(result).toBeNull();
    });
  });

  describe("duplicateView", () => {
    it("creates a copy of the view", async () => {
      const { duplicateView } = await import("~/services/saved-views.server");
      mockFindFirst.mockResolvedValue({
        id: "v-source",
        name: "Original",
        entityType: "Participant",
        viewType: "TABLE",
        filters: [{ field: "status", operator: "eq", value: "ACTIVE" }],
        sorts: [],
        columns: ["name", "email"],
        config: {},
      });
      mockCreate.mockResolvedValue({
        id: "v-copy",
        name: "Original (copy)",
        viewType: "TABLE",
      });

      const result = await duplicateView("v-source", "u-1", "t-1");

      expect(result.name).toBe("Original (copy)");
      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "Original (copy)",
          userId: "u-1",
          tenantId: "t-1",
          isShared: false,
          isDefault: false,
        }),
      });
    });
  });
});

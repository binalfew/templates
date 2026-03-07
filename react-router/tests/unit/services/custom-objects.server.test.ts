import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDefCreate = vi.fn();
const mockDefUpdate = vi.fn();
const mockDefDelete = vi.fn();
const mockDefFindFirst = vi.fn();
const mockDefFindUniqueOrThrow = vi.fn();
const mockDefFindMany = vi.fn();
const mockRecCreate = vi.fn();
const mockRecUpdate = vi.fn();
const mockRecDelete = vi.fn();
const mockRecFindFirst = vi.fn();
const mockRecFindMany = vi.fn();

vi.mock("~/utils/db/db.server", () => ({
  prisma: {
    customObjectDefinition: {
      create: (...args: unknown[]) => mockDefCreate(...args),
      update: (...args: unknown[]) => mockDefUpdate(...args),
      delete: (...args: unknown[]) => mockDefDelete(...args),
      findFirst: (...args: unknown[]) => mockDefFindFirst(...args),
      findUniqueOrThrow: (...args: unknown[]) => mockDefFindUniqueOrThrow(...args),
      findMany: (...args: unknown[]) => mockDefFindMany(...args),
    },
    customObjectRecord: {
      create: (...args: unknown[]) => mockRecCreate(...args),
      update: (...args: unknown[]) => mockRecUpdate(...args),
      delete: (...args: unknown[]) => mockRecDelete(...args),
      findFirst: (...args: unknown[]) => mockRecFindFirst(...args),
      findMany: (...args: unknown[]) => mockRecFindMany(...args),
    },
  },
}));

vi.mock("~/utils/monitoring/logger.server", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("custom-objects.server", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("createDefinition", () => {
    it("creates a definition with valid slug", async () => {
      const { createDefinition } = await import("~/services/custom-objects.server");
      mockDefCreate.mockResolvedValue({
        id: "def-1",
        name: "Vehicles",
        slug: "vehicles",
      });

      const result = await createDefinition({
        tenantId: "t-1",
        name: "Vehicles",
        slug: "vehicles",
        fields: [{ name: "plate", label: "License Plate", dataType: "TEXT" }],
      });

      expect(result.id).toBe("def-1");
      expect(mockDefCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: "t-1",
          name: "Vehicles",
          slug: "vehicles",
        }),
      });
    });

    it("throws for invalid slug", async () => {
      const { createDefinition, CustomObjectError } = await import("~/services/custom-objects.server");

      await expect(
        createDefinition({
          tenantId: "t-1",
          name: "Bad Slug",
          slug: "Bad Slug!",
          fields: [],
        }),
      ).rejects.toThrow(CustomObjectError);
    });

    it("throws for slug starting with a number", async () => {
      const { createDefinition, CustomObjectError } = await import("~/services/custom-objects.server");

      await expect(
        createDefinition({
          tenantId: "t-1",
          name: "123",
          slug: "123abc",
          fields: [],
        }),
      ).rejects.toThrow(CustomObjectError);
    });
  });

  describe("deleteDefinition", () => {
    it("deletes a definition with no records", async () => {
      const { deleteDefinition } = await import("~/services/custom-objects.server");
      mockDefFindFirst.mockResolvedValue({
        id: "def-1",
        _count: { records: 0 },
      });
      mockDefUpdate.mockResolvedValue({});

      await deleteDefinition("def-1", "t-1");

      expect(mockDefUpdate).toHaveBeenCalledWith({
        where: { id: "def-1" },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it("throws when definition has records", async () => {
      const { deleteDefinition, CustomObjectError } = await import("~/services/custom-objects.server");
      mockDefFindFirst.mockResolvedValue({
        id: "def-1",
        _count: { records: 5 },
      });

      await expect(deleteDefinition("def-1", "t-1")).rejects.toThrow(CustomObjectError);
    });
  });

  describe("listDefinitions", () => {
    it("lists active definitions by default", async () => {
      const { listDefinitions } = await import("~/services/custom-objects.server");
      mockDefFindMany.mockResolvedValue([
        { id: "def-1", name: "A", isActive: true },
        { id: "def-2", name: "B", isActive: true },
      ]);

      const result = await listDefinitions("t-1");

      expect(result).toHaveLength(2);
      expect(mockDefFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: "t-1", isActive: true },
        }),
      );
    });

    it("includes inactive when requested", async () => {
      const { listDefinitions } = await import("~/services/custom-objects.server");
      mockDefFindMany.mockResolvedValue([]);

      await listDefinitions("t-1", true);

      expect(mockDefFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: "t-1" },
        }),
      );
    });
  });

  describe("createRecord", () => {
    it("creates a record for an active definition", async () => {
      const { createRecord } = await import("~/services/custom-objects.server");
      mockDefFindFirst.mockResolvedValue({
        id: "def-1",
        isActive: true,
        fields: [{ name: "plate", label: "License Plate", dataType: "TEXT", required: false }],
      });
      mockRecCreate.mockResolvedValue({
        id: "rec-1",
        definitionId: "def-1",
        data: { plate: "ABC-123" },
      });

      const result = await createRecord({
        definitionId: "def-1",
        tenantId: "t-1",
        data: { plate: "ABC-123" },
      });

      expect(result.id).toBe("rec-1");
    });

    it("throws for inactive definition", async () => {
      const { createRecord, CustomObjectError } = await import("~/services/custom-objects.server");
      mockDefFindFirst.mockResolvedValue({
        id: "def-1",
        isActive: false,
        fields: [],
      });

      await expect(
        createRecord({ definitionId: "def-1", tenantId: "t-1", data: {} }),
      ).rejects.toThrow(CustomObjectError);
    });

    it("throws when required field is missing", async () => {
      const { createRecord, CustomObjectError } = await import("~/services/custom-objects.server");
      mockDefFindFirst.mockResolvedValue({
        id: "def-1",
        isActive: true,
        fields: [{ name: "plate", label: "License Plate", dataType: "TEXT", required: true }],
      });

      await expect(
        createRecord({ definitionId: "def-1", tenantId: "t-1", data: {} }),
      ).rejects.toThrow(CustomObjectError);
    });
  });

  describe("deleteRecord", () => {
    it("deletes a record", async () => {
      const { deleteRecord } = await import("~/services/custom-objects.server");
      mockRecFindFirst.mockResolvedValue({ id: "rec-1" });
      mockRecDelete.mockResolvedValue({});

      await deleteRecord("rec-1", "t-1");

      expect(mockRecDelete).toHaveBeenCalledWith({ where: { id: "rec-1" } });
    });
  });

  describe("listRecords", () => {
    it("lists records for a definition", async () => {
      const { listRecords } = await import("~/services/custom-objects.server");
      mockRecFindMany.mockResolvedValue([
        { id: "rec-1", data: { plate: "ABC" } },
        { id: "rec-2", data: { plate: "XYZ" } },
      ]);

      const result = await listRecords("def-1", "t-1");

      expect(result).toHaveLength(2);
      expect(mockRecFindMany).toHaveBeenCalledWith({
        where: { definitionId: "def-1", tenantId: "t-1" },
        orderBy: { createdAt: "desc" },
      });
    });
  });
});

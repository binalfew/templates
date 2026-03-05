import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock functions for each Prisma method ────────────────
const mockFieldFindMany = vi.fn();
const mockFieldFindFirst = vi.fn();
const mockFieldCount = vi.fn();
const mockFieldCreate = vi.fn();
const mockFieldUpdate = vi.fn();
const mockFieldDelete = vi.fn();
const mockAuditLogCreate = vi.fn();
const mockQueryRawUnsafe = vi.fn();
const mockTransaction = vi.fn();

vi.mock("~/lib/db/db.server", () => ({
  prisma: {
    fieldDefinition: {
      findMany: (...args: unknown[]) => mockFieldFindMany(...args),
      findFirst: (...args: unknown[]) => mockFieldFindFirst(...args),
      count: (...args: unknown[]) => mockFieldCount(...args),
      create: (...args: unknown[]) => mockFieldCreate(...args),
      update: (...args: unknown[]) => mockFieldUpdate(...args),
      delete: (...args: unknown[]) => mockFieldDelete(...args),
    },
    auditLog: {
      create: (...args: unknown[]) => mockAuditLogCreate(...args),
    },
    $queryRawUnsafe: (...args: unknown[]) => mockQueryRawUnsafe(...args),
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

vi.mock("~/lib/monitoring/logger.server", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ─── Shared test data ─────────────────────────────────────
const tenantId = "tenant-1";
const userId = "user-1";
const ctx = {
  tenantId,
  userId,
  ipAddress: "127.0.0.1",
  userAgent: "test-agent",
};

const sampleField = {
  id: "field-1",
  tenantId,
  entityType: "Generic",
  name: "first_name",
  label: "First Name",
  description: "User first name",
  dataType: "TEXT",
  sortOrder: 0,
  isRequired: true,
  isUnique: false,
  isSearchable: true,
  isFilterable: false,
  defaultValue: null,
  config: {},
  validation: [],
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  updatedAt: new Date("2025-01-01T00:00:00.000Z"),
};

describe("fields.server", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ═══════════════════════════════════════════════════════════
  // listFields
  // ═══════════════════════════════════════════════════════════
  describe("listFields", () => {
    it("lists all fields for a tenant with no filters", async () => {
      const { listFields } = await import("../fields.server");
      mockFieldFindMany.mockResolvedValue([sampleField]);

      const result = await listFields(tenantId);

      expect(result).toEqual([sampleField]);
      expect(mockFieldFindMany).toHaveBeenCalledWith({
        where: { tenantId },
        orderBy: { sortOrder: "asc" },
      });
    });

    it("filters by entityType", async () => {
      const { listFields } = await import("../fields.server");
      mockFieldFindMany.mockResolvedValue([]);

      await listFields(tenantId, { entityType: "User" });

      expect(mockFieldFindMany).toHaveBeenCalledWith({
        where: { tenantId, entityType: "User" },
        orderBy: { sortOrder: "asc" },
      });
    });

    it("filters by dataType", async () => {
      const { listFields } = await import("../fields.server");
      mockFieldFindMany.mockResolvedValue([]);

      await listFields(tenantId, { dataType: "NUMBER" });

      expect(mockFieldFindMany).toHaveBeenCalledWith({
        where: { tenantId, dataType: "NUMBER" },
        orderBy: { sortOrder: "asc" },
      });
    });

    it("filters by search term across name and label", async () => {
      const { listFields } = await import("../fields.server");
      mockFieldFindMany.mockResolvedValue([sampleField]);

      await listFields(tenantId, { search: "first" });

      expect(mockFieldFindMany).toHaveBeenCalledWith({
        where: {
          tenantId,
          OR: [
            { name: { contains: "first", mode: "insensitive" } },
            { label: { contains: "first", mode: "insensitive" } },
          ],
        },
        orderBy: { sortOrder: "asc" },
      });
    });

    it("applies multiple filters at once", async () => {
      const { listFields } = await import("../fields.server");
      mockFieldFindMany.mockResolvedValue([]);

      await listFields(tenantId, { entityType: "User", dataType: "TEXT", search: "name" });

      expect(mockFieldFindMany).toHaveBeenCalledWith({
        where: {
          tenantId,
          entityType: "User",
          dataType: "TEXT",
          OR: [
            { name: { contains: "name", mode: "insensitive" } },
            { label: { contains: "name", mode: "insensitive" } },
          ],
        },
        orderBy: { sortOrder: "asc" },
      });
    });
  });

  // ═══════════════════════════════════════════════════════════
  // listFieldsPaginated
  // ═══════════════════════════════════════════════════════════
  describe("listFieldsPaginated", () => {
    it("returns paginated items and totalCount", async () => {
      const { listFieldsPaginated } = await import("../fields.server");
      mockFieldFindMany.mockResolvedValue([sampleField]);
      mockFieldCount.mockResolvedValue(25);

      const result = await listFieldsPaginated(tenantId, {
        page: 1,
        pageSize: 10,
      });

      expect(result).toEqual({ items: [sampleField], totalCount: 25 });
      expect(mockFieldFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
          orderBy: { sortOrder: "asc" },
        }),
      );
    });

    it("calculates correct skip for page 3", async () => {
      const { listFieldsPaginated } = await import("../fields.server");
      mockFieldFindMany.mockResolvedValue([]);
      mockFieldCount.mockResolvedValue(0);

      await listFieldsPaginated(tenantId, { page: 3, pageSize: 20 });

      expect(mockFieldFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 40, take: 20 }),
      );
    });

    it("applies dataType filter", async () => {
      const { listFieldsPaginated } = await import("../fields.server");
      mockFieldFindMany.mockResolvedValue([]);
      mockFieldCount.mockResolvedValue(0);

      await listFieldsPaginated(tenantId, { page: 1, pageSize: 10, dataType: "BOOLEAN" });

      expect(mockFieldFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId, dataType: "BOOLEAN" }),
        }),
      );
    });

    it("applies search filter", async () => {
      const { listFieldsPaginated } = await import("../fields.server");
      mockFieldFindMany.mockResolvedValue([]);
      mockFieldCount.mockResolvedValue(0);

      await listFieldsPaginated(tenantId, { page: 1, pageSize: 10, search: "email" });

      expect(mockFieldFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId,
            OR: [
              { name: { contains: "email", mode: "insensitive" } },
              { label: { contains: "email", mode: "insensitive" } },
            ],
          }),
        }),
      );
    });

    it("merges options.where into the query", async () => {
      const { listFieldsPaginated } = await import("../fields.server");
      mockFieldFindMany.mockResolvedValue([]);
      mockFieldCount.mockResolvedValue(0);

      await listFieldsPaginated(tenantId, {
        page: 1,
        pageSize: 10,
        where: { entityType: "User" },
      });

      expect(mockFieldFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId, entityType: "User" }),
        }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════
  // createField
  // ═══════════════════════════════════════════════════════════
  describe("createField", () => {
    const createInput = {
      name: "email_address",
      label: "Email Address",
      description: "Primary email",
      dataType: "EMAIL" as const,
      isRequired: true,
      isUnique: true,
      isSearchable: true,
      isFilterable: false,
      defaultValue: undefined,
      config: {},
      validation: [],
    };

    it("creates a field with auto-calculated sortOrder", async () => {
      const { createField } = await import("../fields.server");

      // Tenant count check
      mockFieldCount.mockResolvedValueOnce(10);
      // Entity count check
      mockFieldCount.mockResolvedValueOnce(5);
      // Max sortOrder
      mockFieldFindFirst.mockResolvedValue({ sortOrder: 4 });
      // Create
      mockFieldCreate.mockResolvedValue({ id: "field-new", ...createInput, sortOrder: 5 });
      // Audit log
      mockAuditLogCreate.mockResolvedValue({});

      const result = await createField(createInput, ctx);

      expect(result.id).toBe("field-new");
      expect(mockFieldCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          name: "email_address",
          label: "Email Address",
          sortOrder: 5,
          isRequired: true,
          isUnique: true,
        }),
      });
    });

    it("uses sortOrder 0 when no existing fields", async () => {
      const { createField } = await import("../fields.server");

      mockFieldCount.mockResolvedValueOnce(0);
      mockFieldCount.mockResolvedValueOnce(0);
      mockFieldFindFirst.mockResolvedValue(null);
      mockFieldCreate.mockResolvedValue({ id: "field-new", sortOrder: 0 });
      mockAuditLogCreate.mockResolvedValue({});

      await createField(createInput, ctx);

      expect(mockFieldCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ sortOrder: 0 }),
      });
    });

    it("defaults entityType to Generic", async () => {
      const { createField } = await import("../fields.server");

      mockFieldCount.mockResolvedValueOnce(0);
      mockFieldCount.mockResolvedValueOnce(0);
      mockFieldFindFirst.mockResolvedValue(null);
      mockFieldCreate.mockResolvedValue({ id: "field-new" });
      mockAuditLogCreate.mockResolvedValue({});

      await createField({ ...createInput, entityType: undefined }, ctx);

      expect(mockFieldCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ entityType: "Generic" }),
      });
    });

    it("throws FieldError when tenant limit is reached", async () => {
      const { createField, FieldError } = await import("../fields.server");

      mockFieldCount.mockResolvedValue(500); // maxPerTenant = 500

      const error = await createField(createInput, ctx).catch((e) => e);
      expect(error).toBeInstanceOf(FieldError);
      expect(error.message).toMatch("Tenant limit reached");
    });

    it("throws FieldError when entity limit is reached", async () => {
      const { createField, FieldError } = await import("../fields.server");

      mockFieldCount
        .mockResolvedValueOnce(10) // under tenant limit
        .mockResolvedValueOnce(100); // maxPerEntity = 100

      const error = await createField(createInput, ctx).catch((e) => e);
      expect(error).toBeInstanceOf(FieldError);
      expect(error.message).toMatch("Entity limit reached");
    });

    it("throws FieldError with 409 on unique constraint violation", async () => {
      const { createField, FieldError } = await import("../fields.server");

      mockFieldCount.mockResolvedValueOnce(0);
      mockFieldCount.mockResolvedValueOnce(0);
      mockFieldFindFirst.mockResolvedValue(null);
      mockFieldCreate.mockRejectedValue({ code: "P2002" });

      await expect(createField(createInput, ctx)).rejects.toThrow(FieldError);
      await expect(createField(createInput, ctx)).rejects.toThrow("already exists");
    });

    it("re-throws non-unique-constraint errors", async () => {
      const { createField } = await import("../fields.server");

      mockFieldCount.mockResolvedValueOnce(0);
      mockFieldCount.mockResolvedValueOnce(0);
      mockFieldFindFirst.mockResolvedValue(null);
      const genericError = new Error("DB connection lost");
      mockFieldCreate.mockRejectedValue(genericError);

      await expect(createField(createInput, ctx)).rejects.toThrow("DB connection lost");
    });

    it("creates an audit log entry", async () => {
      const { createField } = await import("../fields.server");

      mockFieldCount.mockResolvedValueOnce(0);
      mockFieldCount.mockResolvedValueOnce(0);
      mockFieldFindFirst.mockResolvedValue(null);
      mockFieldCreate.mockResolvedValue({ id: "field-new", ...createInput });
      mockAuditLogCreate.mockResolvedValue({});

      await createField(createInput, ctx);

      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          userId,
          action: "CREATE",
          entityType: "FieldDefinition",
          entityId: "field-new",
          ipAddress: "127.0.0.1",
          userAgent: "test-agent",
        }),
      });
    });
  });

  // ═══════════════════════════════════════════════════════════
  // updateField
  // ═══════════════════════════════════════════════════════════
  describe("updateField", () => {
    const updateInput = {
      label: "Updated Label",
      name: "updated_name",
    };

    it("updates a field successfully", async () => {
      const { updateField } = await import("../fields.server");

      mockFieldFindFirst.mockResolvedValue(sampleField);
      mockFieldUpdate.mockResolvedValue({
        ...sampleField,
        label: "Updated Label",
        name: "updated_name",
      });
      mockAuditLogCreate.mockResolvedValue({});

      const result = await updateField("field-1", updateInput, ctx);

      expect(result.label).toBe("Updated Label");
      expect(mockFieldUpdate).toHaveBeenCalledWith({
        where: { id: "field-1" },
        data: expect.objectContaining({
          label: "Updated Label",
          name: "updated_name",
        }),
      });
    });

    it("throws FieldError when field not found", async () => {
      const { updateField, FieldError } = await import("../fields.server");

      mockFieldFindFirst.mockResolvedValue(null);

      await expect(updateField("nonexistent", updateInput, ctx)).rejects.toThrow(FieldError);
      await expect(updateField("nonexistent", updateInput, ctx)).rejects.toThrow("Field not found");
    });

    it("throws ConflictError when version mismatch", async () => {
      const { updateField } = await import("../fields.server");
      const { ConflictError } = await import("../optimistic-lock.server");

      mockFieldFindFirst.mockResolvedValue(sampleField);

      await expect(
        updateField("field-1", updateInput, ctx, "2024-01-01T00:00:00.000Z"),
      ).rejects.toThrow(ConflictError);
    });

    it("includes updatedAt in where clause when expectedVersion provided", async () => {
      const { updateField } = await import("../fields.server");

      const version = sampleField.updatedAt.toISOString();
      mockFieldFindFirst.mockResolvedValue(sampleField);
      mockFieldUpdate.mockResolvedValue({ ...sampleField, label: "Updated Label" });
      mockAuditLogCreate.mockResolvedValue({});

      await updateField("field-1", updateInput, ctx, version);

      expect(mockFieldUpdate).toHaveBeenCalledWith({
        where: { id: "field-1", updatedAt: new Date(version) },
        data: expect.objectContaining({ label: "Updated Label" }),
      });
    });

    it("throws ConflictError on Prisma P2025 with expectedVersion", async () => {
      const { updateField } = await import("../fields.server");
      const { ConflictError } = await import("../optimistic-lock.server");

      const version = sampleField.updatedAt.toISOString();
      mockFieldFindFirst
        .mockResolvedValueOnce(sampleField) // first find
        .mockResolvedValueOnce(sampleField); // re-fetch after P2025
      mockFieldUpdate.mockRejectedValue({ code: "P2025" });

      await expect(updateField("field-1", updateInput, ctx, version)).rejects.toThrow(
        ConflictError,
      );
    });

    it("throws FieldError on unique constraint violation during update", async () => {
      const { updateField, FieldError } = await import("../fields.server");

      mockFieldFindFirst.mockResolvedValue(sampleField);
      mockFieldUpdate.mockRejectedValue({ code: "P2002" });

      await expect(updateField("field-1", { name: "duplicate_name" }, ctx)).rejects.toThrow(
        FieldError,
      );
      await expect(updateField("field-1", { name: "duplicate_name" }, ctx)).rejects.toThrow(
        "already exists",
      );
    });

    it("creates an audit log with before/after metadata", async () => {
      const { updateField } = await import("../fields.server");

      mockFieldFindFirst.mockResolvedValue(sampleField);
      mockFieldUpdate.mockResolvedValue({
        ...sampleField,
        name: "updated_name",
        label: "Updated Label",
      });
      mockAuditLogCreate.mockResolvedValue({});

      await updateField("field-1", updateInput, ctx);

      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "UPDATE",
          entityType: "FieldDefinition",
          metadata: {
            before: { name: "first_name", label: "First Name", dataType: "TEXT" },
            after: { name: "updated_name", label: "Updated Label", dataType: "TEXT" },
          },
        }),
      });
    });

    it("only includes defined properties in the update data", async () => {
      const { updateField } = await import("../fields.server");

      mockFieldFindFirst.mockResolvedValue(sampleField);
      mockFieldUpdate.mockResolvedValue({ ...sampleField, label: "New Label" });
      mockAuditLogCreate.mockResolvedValue({});

      await updateField("field-1", { label: "New Label" }, ctx);

      expect(mockFieldUpdate).toHaveBeenCalledWith({
        where: { id: "field-1" },
        data: { label: "New Label" },
      });
    });
  });

  // ═══════════════════════════════════════════════════════════
  // deleteField
  // ═══════════════════════════════════════════════════════════
  describe("deleteField", () => {
    it("deletes a field with no data", async () => {
      const { deleteField } = await import("../fields.server");

      mockFieldFindFirst.mockResolvedValue(sampleField);
      mockQueryRawUnsafe.mockResolvedValue([{ count: BigInt(0) }]);
      mockFieldDelete.mockResolvedValue({});
      mockAuditLogCreate.mockResolvedValue({});

      const result = await deleteField("field-1", ctx);

      expect(result).toEqual({ success: true });
      expect(mockFieldDelete).toHaveBeenCalledWith({ where: { id: "field-1" } });
    });

    it("throws FieldError when field not found", async () => {
      const { deleteField, FieldError } = await import("../fields.server");

      mockFieldFindFirst.mockResolvedValue(null);

      await expect(deleteField("nonexistent", ctx)).rejects.toThrow(FieldError);
      await expect(deleteField("nonexistent", ctx)).rejects.toThrow("Field not found");
    });

    it("throws FieldError when field has data and force is not set", async () => {
      const { deleteField, FieldError } = await import("../fields.server");

      mockFieldFindFirst.mockResolvedValue(sampleField);
      mockQueryRawUnsafe.mockResolvedValue([{ count: BigInt(5) }]);

      await expect(deleteField("field-1", ctx)).rejects.toThrow(FieldError);
      await expect(deleteField("field-1", ctx)).rejects.toThrow("Cannot delete");
    });

    it("deletes even with data when force=true", async () => {
      const { deleteField } = await import("../fields.server");

      mockFieldFindFirst.mockResolvedValue(sampleField);
      mockFieldDelete.mockResolvedValue({});
      mockAuditLogCreate.mockResolvedValue({});

      const result = await deleteField("field-1", ctx, { force: true });

      expect(result).toEqual({ success: true });
      // Should not call $queryRawUnsafe because force skips the check
      expect(mockQueryRawUnsafe).not.toHaveBeenCalled();
    });

    it("creates a DELETE audit log entry", async () => {
      const { deleteField } = await import("../fields.server");

      mockFieldFindFirst.mockResolvedValue(sampleField);
      mockQueryRawUnsafe.mockResolvedValue([{ count: BigInt(0) }]);
      mockFieldDelete.mockResolvedValue({});
      mockAuditLogCreate.mockResolvedValue({});

      await deleteField("field-1", ctx);

      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "DELETE",
          entityType: "FieldDefinition",
          entityId: "field-1",
          description: expect.stringContaining("First Name"),
          metadata: { name: "first_name", dataType: "TEXT" },
        }),
      });
    });
  });

  // ═══════════════════════════════════════════════════════════
  // reorderFields
  // ═══════════════════════════════════════════════════════════
  describe("reorderFields", () => {
    it("reorders fields in a transaction", async () => {
      const { reorderFields } = await import("../fields.server");

      const fieldIds = ["field-a", "field-b", "field-c"];
      mockFieldFindMany.mockResolvedValue(
        fieldIds.map((id) => ({ id })),
      );
      mockTransaction.mockResolvedValue([]);
      mockAuditLogCreate.mockResolvedValue({});

      const result = await reorderFields({ fieldIds }, ctx);

      expect(result).toEqual({ success: true });
      expect(mockFieldFindMany).toHaveBeenCalledWith({
        where: { id: { in: fieldIds }, tenantId },
        select: { id: true },
      });
      expect(mockTransaction).toHaveBeenCalled();
    });

    it("throws FieldError when some fields are not found", async () => {
      const { reorderFields, FieldError } = await import("../fields.server");

      const fieldIds = ["field-a", "field-b", "field-missing"];
      mockFieldFindMany.mockResolvedValue([{ id: "field-a" }, { id: "field-b" }]);

      await expect(reorderFields({ fieldIds }, ctx)).rejects.toThrow(FieldError);
      await expect(reorderFields({ fieldIds }, ctx)).rejects.toThrow("field-missing");
    });

    it("creates an audit log entry for reorder", async () => {
      const { reorderFields } = await import("../fields.server");

      const fieldIds = ["field-a", "field-b"];
      mockFieldFindMany.mockResolvedValue([{ id: "field-a" }, { id: "field-b" }]);
      mockTransaction.mockResolvedValue([]);
      mockAuditLogCreate.mockResolvedValue({});

      await reorderFields({ fieldIds }, ctx);

      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "UPDATE",
          entityType: "FieldDefinition",
          description: "Reordered 2 fields",
          metadata: { fieldIds },
        }),
      });
    });
  });

  // ═══════════════════════════════════════════════════════════
  // getField
  // ═══════════════════════════════════════════════════════════
  describe("getField", () => {
    it("returns the field when found", async () => {
      const { getField } = await import("../fields.server");

      mockFieldFindFirst.mockResolvedValue(sampleField);

      const result = await getField("field-1", tenantId);

      expect(result).toEqual(sampleField);
      expect(mockFieldFindFirst).toHaveBeenCalledWith({
        where: { id: "field-1", tenantId },
      });
    });

    it("throws FieldError when not found", async () => {
      const { getField, FieldError } = await import("../fields.server");

      mockFieldFindFirst.mockResolvedValue(null);

      await expect(getField("nonexistent", tenantId)).rejects.toThrow(FieldError);
      await expect(getField("nonexistent", tenantId)).rejects.toThrow("Field not found");
    });
  });

  // ═══════════════════════════════════════════════════════════
  // getFieldDataCount
  // ═══════════════════════════════════════════════════════════
  describe("getFieldDataCount", () => {
    it("returns count from raw query", async () => {
      const { getFieldDataCount } = await import("../fields.server");

      mockQueryRawUnsafe.mockResolvedValue([{ count: BigInt(42) }]);

      const result = await getFieldDataCount("first_name", tenantId);

      expect(result).toBe(42);
      expect(mockQueryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("SELECT COUNT"),
        tenantId,
        "first_name",
      );
    });

    it("returns 0 when result is empty", async () => {
      const { getFieldDataCount } = await import("../fields.server");

      mockQueryRawUnsafe.mockResolvedValue([]);

      const result = await getFieldDataCount("missing_field", tenantId);

      expect(result).toBe(0);
    });

    it("returns 0 on query error", async () => {
      const { getFieldDataCount } = await import("../fields.server");

      mockQueryRawUnsafe.mockRejectedValue(new Error("SQL error"));

      const result = await getFieldDataCount("broken_field", tenantId);

      expect(result).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // getEffectiveFields
  // ═══════════════════════════════════════════════════════════
  describe("getEffectiveFields", () => {
    it("returns fields for a given tenant and entity type", async () => {
      const { getEffectiveFields } = await import("../fields.server");

      mockFieldFindMany.mockResolvedValue([sampleField]);

      const result = await getEffectiveFields(tenantId, "User");

      expect(result).toEqual([sampleField]);
      expect(mockFieldFindMany).toHaveBeenCalledWith({
        where: { tenantId, entityType: "User" },
        orderBy: { sortOrder: "asc" },
      });
    });

    it("defaults entity type to Generic", async () => {
      const { getEffectiveFields } = await import("../fields.server");

      mockFieldFindMany.mockResolvedValue([]);

      await getEffectiveFields(tenantId);

      expect(mockFieldFindMany).toHaveBeenCalledWith({
        where: { tenantId, entityType: "Generic" },
        orderBy: { sortOrder: "asc" },
      });
    });
  });

  // ═══════════════════════════════════════════════════════════
  // FieldError
  // ═══════════════════════════════════════════════════════════
  describe("FieldError", () => {
    it("extends ServiceError with correct name and status", async () => {
      const { FieldError } = await import("../fields.server");
      const { ServiceError } = await import("~/lib/errors/service-error.server");

      const err = new FieldError("Something went wrong", 422);

      expect(err).toBeInstanceOf(ServiceError);
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe("FieldError");
      expect(err.message).toBe("Something went wrong");
      expect(err.status).toBe(422);
    });
  });
});

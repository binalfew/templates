import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUserFindMany = vi.fn();
const mockRoleFindMany = vi.fn();
const mockCountryFindMany = vi.fn();
const mockTitleFindMany = vi.fn();
const mockLanguageFindMany = vi.fn();
const mockCurrencyFindMany = vi.fn();
const mockDocumentTypeFindMany = vi.fn();
const mockCustomObjectRecordFindMany = vi.fn();

vi.mock("~/utils/db/db.server", () => ({
  prisma: {
    user: {
      findMany: (...args: unknown[]) => mockUserFindMany(...args),
    },
    role: {
      findMany: (...args: unknown[]) => mockRoleFindMany(...args),
    },
    country: {
      findMany: (...args: unknown[]) => mockCountryFindMany(...args),
    },
    title: {
      findMany: (...args: unknown[]) => mockTitleFindMany(...args),
    },
    language: {
      findMany: (...args: unknown[]) => mockLanguageFindMany(...args),
    },
    currency: {
      findMany: (...args: unknown[]) => mockCurrencyFindMany(...args),
    },
    documentType: {
      findMany: (...args: unknown[]) => mockDocumentTypeFindMany(...args),
    },
    customObjectRecord: {
      findMany: (...args: unknown[]) => mockCustomObjectRecordFindMany(...args),
    },
  },
}));

vi.mock("~/utils/monitoring/logger.server", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("data-export.server", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ---------- exportData: users ----------

  describe("exportData - users", () => {
    const baseOptions = { entity: "users", tenantId: "tenant-1", format: "json" as const };

    it("exports users as JSON", async () => {
      const { exportData } = await import("~/services/data-export.server");
      mockUserFindMany.mockResolvedValue([
        {
          id: "u-1",
          email: "alice@test.com",
          username: "alice",
          name: "Alice",
          status: "ACTIVE",
          createdAt: new Date("2025-01-15T10:00:00Z"),
        },
      ]);

      const result = await exportData(baseOptions);

      expect(result.contentType).toBe("application/json");
      expect(result.filename).toBe("users-export.json");
      const parsed = JSON.parse(result.content);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toEqual({
        id: "u-1",
        email: "alice@test.com",
        username: "alice",
        name: "Alice",
        status: "ACTIVE",
        createdAt: "2025-01-15T10:00:00.000Z",
      });
    });

    it("exports users as CSV", async () => {
      const { exportData } = await import("~/services/data-export.server");
      mockUserFindMany.mockResolvedValue([
        {
          id: "u-1",
          email: "alice@test.com",
          username: null,
          name: null,
          status: "ACTIVE",
          createdAt: new Date("2025-01-15T10:00:00Z"),
        },
      ]);

      const result = await exportData({ ...baseOptions, format: "csv" });

      expect(result.contentType).toBe("text/csv");
      expect(result.filename).toBe("users-export.csv");
      const lines = result.content.split("\n");
      expect(lines[0]).toBe("id,email,username,name,status,createdAt");
      expect(lines[1]).toContain("u-1");
      expect(lines[1]).toContain("alice@test.com");
    });

    it("handles null username and name as empty strings", async () => {
      const { exportData } = await import("~/services/data-export.server");
      mockUserFindMany.mockResolvedValue([
        {
          id: "u-1",
          email: "test@test.com",
          username: null,
          name: null,
          status: "ACTIVE",
          createdAt: new Date("2025-01-01"),
        },
      ]);

      const result = await exportData(baseOptions);
      const parsed = JSON.parse(result.content);
      expect(parsed[0].username).toBe("");
      expect(parsed[0].name).toBe("");
    });

    it("queries with correct tenant and deletedAt filter", async () => {
      const { exportData } = await import("~/services/data-export.server");
      mockUserFindMany.mockResolvedValue([]);

      await exportData(baseOptions);

      expect(mockUserFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: "tenant-1", deletedAt: null },
          orderBy: { createdAt: "desc" },
        }),
      );
    });
  });

  // ---------- exportData: roles ----------

  describe("exportData - roles", () => {
    const baseOptions = { entity: "roles", tenantId: "tenant-1", format: "json" as const };

    it("exports roles as JSON", async () => {
      const { exportData } = await import("~/services/data-export.server");
      mockRoleFindMany.mockResolvedValue([
        {
          id: "r-1",
          name: "Admin",
          description: "Administrator role",
          scope: "TENANT",
          createdAt: new Date("2025-02-01T12:00:00Z"),
        },
        {
          id: "r-2",
          name: "Viewer",
          description: null,
          scope: "GLOBAL",
          createdAt: new Date("2025-02-02T12:00:00Z"),
        },
      ]);

      const result = await exportData(baseOptions);
      const parsed = JSON.parse(result.content);

      expect(parsed).toHaveLength(2);
      expect(parsed[0].name).toBe("Admin");
      expect(parsed[1].description).toBe("");
    });

    it("exports roles as CSV", async () => {
      const { exportData } = await import("~/services/data-export.server");
      mockRoleFindMany.mockResolvedValue([
        {
          id: "r-1",
          name: "Admin",
          description: "Has, all permissions",
          scope: "TENANT",
          createdAt: new Date("2025-02-01"),
        },
      ]);

      const result = await exportData({ ...baseOptions, format: "csv" });
      const lines = result.content.split("\n");

      expect(lines[0]).toBe("id,name,description,scope,createdAt");
      // description contains comma, should be quoted
      expect(lines[1]).toContain('"Has, all permissions"');
    });

    it("queries with correct tenant and deletedAt filter", async () => {
      const { exportData } = await import("~/services/data-export.server");
      mockRoleFindMany.mockResolvedValue([]);

      await exportData(baseOptions);

      expect(mockRoleFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: "tenant-1", deletedAt: null },
          orderBy: { name: "asc" },
        }),
      );
    });
  });

  // ---------- exportData: countries ----------

  describe("exportData - countries", () => {
    const baseOptions = { entity: "countries", tenantId: "tenant-1", format: "json" as const };

    it("exports countries as JSON", async () => {
      const { exportData } = await import("~/services/data-export.server");
      mockCountryFindMany.mockResolvedValue([
        {
          id: "c-1",
          code: "US",
          name: "United States",
          alpha3: "USA",
          numericCode: "840",
          phoneCode: "+1",
          flag: "🇺🇸",
          sortOrder: 1,
          isActive: true,
        },
      ]);

      const result = await exportData(baseOptions);
      const parsed = JSON.parse(result.content);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].code).toBe("US");
      expect(parsed[0].alpha3).toBe("USA");
      expect(parsed[0].sortOrder).toBe(1);
      expect(parsed[0].isActive).toBe(true);
    });

    it("handles null optional fields as empty strings", async () => {
      const { exportData } = await import("~/services/data-export.server");
      mockCountryFindMany.mockResolvedValue([
        {
          id: "c-1",
          code: "XX",
          name: "Test",
          alpha3: null,
          numericCode: null,
          phoneCode: null,
          flag: null,
          sortOrder: 0,
          isActive: true,
        },
      ]);

      const result = await exportData(baseOptions);
      const parsed = JSON.parse(result.content);

      expect(parsed[0].alpha3).toBe("");
      expect(parsed[0].numericCode).toBe("");
      expect(parsed[0].phoneCode).toBe("");
      expect(parsed[0].flag).toBe("");
    });

    it("does not filter by tenant (countries are global)", async () => {
      const { exportData } = await import("~/services/data-export.server");
      mockCountryFindMany.mockResolvedValue([]);

      await exportData(baseOptions);

      expect(mockCountryFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { sortOrder: "asc" },
        }),
      );
      // countries query has no where clause with tenantId
      const callArgs = mockCountryFindMany.mock.calls[0][0];
      expect(callArgs.where).toBeUndefined();
    });
  });

  // ---------- exportData: titles ----------

  describe("exportData - titles", () => {
    const baseOptions = { entity: "titles", tenantId: "tenant-1", format: "json" as const };

    it("exports titles as JSON", async () => {
      const { exportData } = await import("~/services/data-export.server");
      mockTitleFindMany.mockResolvedValue([
        { id: "t-1", code: "MR", name: "Mr.", sortOrder: 1, isActive: true },
        { id: "t-2", code: "MRS", name: "Mrs.", sortOrder: 2, isActive: true },
      ]);

      const result = await exportData(baseOptions);
      const parsed = JSON.parse(result.content);

      expect(parsed).toHaveLength(2);
      expect(parsed[0].code).toBe("MR");
      expect(parsed[1].code).toBe("MRS");
    });

    it("exports titles as CSV", async () => {
      const { exportData } = await import("~/services/data-export.server");
      mockTitleFindMany.mockResolvedValue([
        { id: "t-1", code: "DR", name: "Dr.", sortOrder: 3, isActive: true },
      ]);

      const result = await exportData({ ...baseOptions, format: "csv" });
      const lines = result.content.split("\n");

      expect(lines[0]).toBe("id,code,name,sortOrder,isActive");
      expect(lines[1]).toContain("DR");
    });
  });

  // ---------- exportData: languages ----------

  describe("exportData - languages", () => {
    const baseOptions = { entity: "languages", tenantId: "tenant-1", format: "json" as const };

    it("exports languages as JSON", async () => {
      const { exportData } = await import("~/services/data-export.server");
      mockLanguageFindMany.mockResolvedValue([
        { id: "l-1", code: "en", name: "English", nativeName: "English", sortOrder: 1, isActive: true },
        { id: "l-2", code: "fr", name: "French", nativeName: null, sortOrder: 2, isActive: true },
      ]);

      const result = await exportData(baseOptions);
      const parsed = JSON.parse(result.content);

      expect(parsed).toHaveLength(2);
      expect(parsed[0].nativeName).toBe("English");
      expect(parsed[1].nativeName).toBe("");
    });
  });

  // ---------- exportData: currencies ----------

  describe("exportData - currencies", () => {
    const baseOptions = { entity: "currencies", tenantId: "tenant-1", format: "json" as const };

    it("exports currencies as JSON", async () => {
      const { exportData } = await import("~/services/data-export.server");
      mockCurrencyFindMany.mockResolvedValue([
        {
          id: "cur-1",
          code: "USD",
          name: "US Dollar",
          symbol: "$",
          decimalDigits: 2,
          sortOrder: 1,
          isActive: true,
        },
        {
          id: "cur-2",
          code: "ETB",
          name: "Ethiopian Birr",
          symbol: null,
          decimalDigits: 2,
          sortOrder: 2,
          isActive: true,
        },
      ]);

      const result = await exportData(baseOptions);
      const parsed = JSON.parse(result.content);

      expect(parsed).toHaveLength(2);
      expect(parsed[0].symbol).toBe("$");
      expect(parsed[1].symbol).toBe("");
    });

    it("exports currencies as CSV with proper headers", async () => {
      const { exportData } = await import("~/services/data-export.server");
      mockCurrencyFindMany.mockResolvedValue([
        {
          id: "cur-1",
          code: "USD",
          name: "US Dollar",
          symbol: "$",
          decimalDigits: 2,
          sortOrder: 1,
          isActive: true,
        },
      ]);

      const result = await exportData({ ...baseOptions, format: "csv" });
      const lines = result.content.split("\n");

      expect(lines[0]).toBe("id,code,name,symbol,decimalDigits,sortOrder,isActive");
    });
  });

  // ---------- exportData: document-types ----------

  describe("exportData - document-types", () => {
    const baseOptions = { entity: "document-types", tenantId: "tenant-1", format: "json" as const };

    it("exports document types as JSON", async () => {
      const { exportData } = await import("~/services/data-export.server");
      mockDocumentTypeFindMany.mockResolvedValue([
        {
          id: "dt-1",
          code: "PASSPORT",
          name: "Passport",
          description: "Travel document",
          category: "IDENTITY",
          sortOrder: 1,
          isActive: true,
        },
        {
          id: "dt-2",
          code: "VISA",
          name: "Visa",
          description: null,
          category: null,
          sortOrder: 2,
          isActive: true,
        },
      ]);

      const result = await exportData(baseOptions);
      const parsed = JSON.parse(result.content);

      expect(parsed).toHaveLength(2);
      expect(parsed[0].description).toBe("Travel document");
      expect(parsed[1].description).toBe("");
      expect(parsed[1].category).toBe("");
    });
  });

  // ---------- exportData: custom-object-records ----------

  describe("exportData - custom-object-records", () => {
    it("exports custom object records as JSON", async () => {
      const { exportData } = await import("~/services/data-export.server");
      mockCustomObjectRecordFindMany.mockResolvedValue([
        {
          id: "rec-1",
          data: { plate: "ABC-123", color: "red" },
          createdBy: "user-1",
          createdAt: new Date("2025-03-01T08:00:00Z"),
        },
      ]);

      const result = await exportData({
        entity: "custom-object-records",
        tenantId: "tenant-1",
        format: "json",
        objectId: "obj-1",
      });

      const parsed = JSON.parse(result.content);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe("rec-1");
      expect(parsed[0].data).toBe(JSON.stringify({ plate: "ABC-123", color: "red" }));
      expect(parsed[0].createdBy).toBe("user-1");
    });

    it("throws when objectId is missing", async () => {
      const { exportData } = await import("~/services/data-export.server");

      await expect(
        exportData({
          entity: "custom-object-records",
          tenantId: "tenant-1",
          format: "json",
        }),
      ).rejects.toThrow("objectId is required for custom object records");
    });

    it("queries with correct definitionId and tenantId", async () => {
      const { exportData } = await import("~/services/data-export.server");
      mockCustomObjectRecordFindMany.mockResolvedValue([]);

      await exportData({
        entity: "custom-object-records",
        tenantId: "tenant-1",
        format: "json",
        objectId: "obj-1",
      });

      expect(mockCustomObjectRecordFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { definitionId: "obj-1", tenantId: "tenant-1" },
          orderBy: { createdAt: "desc" },
        }),
      );
    });

    it("handles null createdBy as empty string", async () => {
      const { exportData } = await import("~/services/data-export.server");
      mockCustomObjectRecordFindMany.mockResolvedValue([
        {
          id: "rec-1",
          data: {},
          createdBy: null,
          createdAt: new Date("2025-03-01"),
        },
      ]);

      const result = await exportData({
        entity: "custom-object-records",
        tenantId: "tenant-1",
        format: "json",
        objectId: "obj-1",
      });

      const parsed = JSON.parse(result.content);
      expect(parsed[0].createdBy).toBe("");
    });
  });

  // ---------- exportData: unsupported entity ----------

  describe("exportData - unsupported entity", () => {
    it("throws for unsupported entity type", async () => {
      const { exportData } = await import("~/services/data-export.server");

      await expect(
        exportData({
          entity: "widgets",
          tenantId: "tenant-1",
          format: "json",
        }),
      ).rejects.toThrow("Unsupported entity: widgets");
    });
  });

  // ---------- CSV format edge cases ----------

  describe("CSV format edge cases", () => {
    it("returns empty content for CSV with no rows", async () => {
      const { exportData } = await import("~/services/data-export.server");
      mockUserFindMany.mockResolvedValue([]);

      const result = await exportData({
        entity: "users",
        tenantId: "tenant-1",
        format: "csv",
      });

      expect(result.content).toBe("");
      expect(result.filename).toBe("users-export.csv");
      expect(result.contentType).toBe("text/csv");
    });

    it("returns formatted JSON for empty array", async () => {
      const { exportData } = await import("~/services/data-export.server");
      mockRoleFindMany.mockResolvedValue([]);

      const result = await exportData({
        entity: "roles",
        tenantId: "tenant-1",
        format: "json",
      });

      expect(JSON.parse(result.content)).toEqual([]);
      expect(result.filename).toBe("roles-export.json");
    });

    it("escapes double quotes in CSV values", async () => {
      const { exportData } = await import("~/services/data-export.server");
      mockRoleFindMany.mockResolvedValue([
        {
          id: "r-1",
          name: 'Role with "quotes"',
          description: "Normal",
          scope: "TENANT",
          createdAt: new Date("2025-01-01"),
        },
      ]);

      const result = await exportData({
        entity: "roles",
        tenantId: "tenant-1",
        format: "csv",
      });

      const lines = result.content.split("\n");
      // The name field should have escaped quotes
      expect(lines[1]).toContain('"Role with ""quotes"""');
    });

    it("wraps values containing newlines in quotes", async () => {
      const { exportData } = await import("~/services/data-export.server");
      mockRoleFindMany.mockResolvedValue([
        {
          id: "r-1",
          name: "Role",
          description: "Line1\nLine2",
          scope: "TENANT",
          createdAt: new Date("2025-01-01"),
        },
      ]);

      const result = await exportData({
        entity: "roles",
        tenantId: "tenant-1",
        format: "csv",
      });

      expect(result.content).toContain('"Line1\nLine2"');
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUserFindFirst = vi.fn();
const mockUserCreate = vi.fn();
const mockRoleCreate = vi.fn();
const mockCountryFindUnique = vi.fn();
const mockCountryCreate = vi.fn();
const mockTitleFindUnique = vi.fn();
const mockTitleCreate = vi.fn();
const mockLanguageFindUnique = vi.fn();
const mockLanguageCreate = vi.fn();
const mockCurrencyFindUnique = vi.fn();
const mockCurrencyCreate = vi.fn();
const mockDocumentTypeFindUnique = vi.fn();
const mockDocumentTypeCreate = vi.fn();
const mockCustomObjectRecordCreate = vi.fn();
const mockHashPassword = vi.fn();

vi.mock("~/utils/db/db.server", () => ({
  prisma: {
    user: {
      findFirst: (...args: unknown[]) => mockUserFindFirst(...args),
      create: (...args: unknown[]) => mockUserCreate(...args),
    },
    role: {
      create: (...args: unknown[]) => mockRoleCreate(...args),
    },
    country: {
      findUnique: (...args: unknown[]) => mockCountryFindUnique(...args),
      create: (...args: unknown[]) => mockCountryCreate(...args),
    },
    title: {
      findUnique: (...args: unknown[]) => mockTitleFindUnique(...args),
      create: (...args: unknown[]) => mockTitleCreate(...args),
    },
    language: {
      findUnique: (...args: unknown[]) => mockLanguageFindUnique(...args),
      create: (...args: unknown[]) => mockLanguageCreate(...args),
    },
    currency: {
      findUnique: (...args: unknown[]) => mockCurrencyFindUnique(...args),
      create: (...args: unknown[]) => mockCurrencyCreate(...args),
    },
    documentType: {
      findUnique: (...args: unknown[]) => mockDocumentTypeFindUnique(...args),
      create: (...args: unknown[]) => mockDocumentTypeCreate(...args),
    },
    customObjectRecord: {
      create: (...args: unknown[]) => mockCustomObjectRecordCreate(...args),
    },
  },
}));

vi.mock("~/utils/auth/auth.server", () => ({
  hashPassword: (...args: unknown[]) => mockHashPassword(...args),
}));

vi.mock("~/utils/monitoring/logger.server", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("data-import.server", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ---------- parseCsv ----------

  describe("parseCsv", () => {
    it("parses a simple CSV string into rows", async () => {
      const { parseCsv } = await import("~/services/data-import.server");

      const csv = "name,email\nAlice,alice@example.com\nBob,bob@example.com";
      const rows = parseCsv(csv);

      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({ name: "Alice", email: "alice@example.com" });
      expect(rows[1]).toEqual({ name: "Bob", email: "bob@example.com" });
    });

    it("returns empty array when content has no data rows", async () => {
      const { parseCsv } = await import("~/services/data-import.server");

      expect(parseCsv("")).toEqual([]);
      expect(parseCsv("header_only")).toEqual([]);
    });

    it("handles quoted values containing commas", async () => {
      const { parseCsv } = await import("~/services/data-import.server");

      const csv = 'name,address\nAlice,"123 Main St, Apt 4"';
      const rows = parseCsv(csv);

      expect(rows).toHaveLength(1);
      expect(rows[0].address).toBe("123 Main St, Apt 4");
    });

    it("handles escaped double quotes inside quoted fields", async () => {
      const { parseCsv } = await import("~/services/data-import.server");

      const csv = 'name,note\nAlice,"She said ""hello"""';
      const rows = parseCsv(csv);

      expect(rows).toHaveLength(1);
      expect(rows[0].note).toBe('She said "hello"');
    });

    it("trims header names and removes surrounding quotes", async () => {
      const { parseCsv } = await import("~/services/data-import.server");

      const csv = '"name" , "email"\nAlice,alice@test.com';
      const rows = parseCsv(csv);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toHaveProperty("name");
      expect(rows[0]).toHaveProperty("email");
    });

    it("handles missing trailing values gracefully", async () => {
      const { parseCsv } = await import("~/services/data-import.server");

      const csv = "name,email,phone\nAlice,alice@test.com";
      const rows = parseCsv(csv);

      expect(rows).toHaveLength(1);
      expect(rows[0].phone).toBe("");
    });

    it("filters out blank lines", async () => {
      const { parseCsv } = await import("~/services/data-import.server");

      const csv = "name,email\n\nAlice,alice@test.com\n\n";
      const rows = parseCsv(csv);

      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe("Alice");
    });
  });

  // ---------- parseJson ----------

  describe("parseJson", () => {
    it("parses valid JSON array", async () => {
      const { parseJson } = await import("~/services/data-import.server");

      const data = parseJson('[{"name":"Alice"},{"name":"Bob"}]');
      expect(data).toHaveLength(2);
      expect(data[0].name).toBe("Alice");
    });

    it("throws when JSON is not an array", async () => {
      const { parseJson } = await import("~/services/data-import.server");

      expect(() => parseJson('{"name":"Alice"}')).toThrow("JSON must be an array");
    });

    it("throws on invalid JSON", async () => {
      const { parseJson } = await import("~/services/data-import.server");

      expect(() => parseJson("not json")).toThrow();
    });
  });

  // ---------- importData: users ----------

  describe("importData - users", () => {
    const baseOptions = {
      entity: "users",
      tenantId: "tenant-1",
      userId: "user-1",
      dryRun: false,
    };

    it("validates rows in dry run mode without creating records", async () => {
      const { importData } = await import("~/services/data-import.server");
      mockUserFindFirst.mockResolvedValue(null);

      const result = await importData({
        ...baseOptions,
        dryRun: true,
        rows: [
          { email: "alice@test.com", name: "Alice" },
          { email: "bob@test.com", name: "Bob" },
        ],
      });

      expect(result.totalRows).toBe(2);
      expect(result.validRows).toBe(2);
      expect(result.errorRows).toBe(0);
      expect(result.imported).toBe(0);
      expect(mockUserCreate).not.toHaveBeenCalled();
    });

    it("reports error when email is missing", async () => {
      const { importData } = await import("~/services/data-import.server");

      const result = await importData({
        ...baseOptions,
        dryRun: true,
        rows: [{ name: "No Email", email: "" }],
      });

      expect(result.errorRows).toBe(1);
      expect(result.errors[0].message).toBe("email is required");
    });

    it("reports error when email already exists", async () => {
      const { importData } = await import("~/services/data-import.server");
      mockUserFindFirst.mockResolvedValue({ id: "existing-user" });

      const result = await importData({
        ...baseOptions,
        dryRun: true,
        rows: [{ email: "existing@test.com", name: "Existing" }],
      });

      expect(result.errorRows).toBe(1);
      expect(result.errors[0].message).toContain("already exists");
    });

    it("creates users when not in dry run", async () => {
      const { importData } = await import("~/services/data-import.server");
      mockUserFindFirst.mockResolvedValue(null);
      mockHashPassword.mockResolvedValue("hashed-pw");
      mockUserCreate.mockResolvedValue({ id: "new-user" });

      const result = await importData({
        ...baseOptions,
        dryRun: false,
        rows: [{ email: "alice@test.com", name: "Alice", username: "alice" }],
      });

      expect(result.imported).toBe(1);
      expect(mockHashPassword).toHaveBeenCalledWith("Changeme1!");
      expect(mockUserCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: "alice@test.com",
          name: "Alice",
          username: "alice",
          tenantId: "tenant-1",
        }),
      });
    });

    it("uses provided password instead of default", async () => {
      const { importData } = await import("~/services/data-import.server");
      mockUserFindFirst.mockResolvedValue(null);
      mockHashPassword.mockResolvedValue("hashed-custom");
      mockUserCreate.mockResolvedValue({ id: "new-user" });

      await importData({
        ...baseOptions,
        dryRun: false,
        rows: [{ email: "alice@test.com", password: "MyP@ss123" }],
      });

      expect(mockHashPassword).toHaveBeenCalledWith("MyP@ss123");
    });

    it("skips duplicate emails during actual import", async () => {
      const { importData } = await import("~/services/data-import.server");
      // First call in validation: null. Second in actual import: existing
      mockUserFindFirst
        .mockResolvedValueOnce(null) // validation pass
        .mockResolvedValueOnce({ id: "exists" }); // import pass - duplicate found

      const result = await importData({
        ...baseOptions,
        dryRun: false,
        rows: [{ email: "dup@test.com" }],
      });

      expect(result.validRows).toBe(1);
      expect(result.imported).toBe(0);
      expect(mockUserCreate).not.toHaveBeenCalled();
    });

    it("handles create failure gracefully and logs error", async () => {
      const { importData } = await import("~/services/data-import.server");
      mockUserFindFirst.mockResolvedValue(null);
      mockHashPassword.mockResolvedValue("hashed");
      mockUserCreate.mockRejectedValue(new Error("DB error"));

      const result = await importData({
        ...baseOptions,
        dryRun: false,
        rows: [{ email: "fail@test.com" }],
      });

      expect(result.imported).toBe(0);
    });
  });

  // ---------- importData: roles ----------

  describe("importData - roles", () => {
    const baseOptions = {
      entity: "roles",
      tenantId: "tenant-1",
      userId: "user-1",
      dryRun: false,
    };

    it("validates role rows in dry run", async () => {
      const { importData } = await import("~/services/data-import.server");

      const result = await importData({
        ...baseOptions,
        dryRun: true,
        rows: [{ name: "Admin", description: "Administrator", scope: "TENANT" }],
      });

      expect(result.validRows).toBe(1);
      expect(result.errorRows).toBe(0);
      expect(result.imported).toBe(0);
    });

    it("reports error when name is missing", async () => {
      const { importData } = await import("~/services/data-import.server");

      const result = await importData({
        ...baseOptions,
        dryRun: true,
        rows: [{ name: "", description: "No name" }],
      });

      expect(result.errorRows).toBe(1);
      expect(result.errors[0].message).toBe("name is required");
    });

    it("creates roles when not in dry run", async () => {
      const { importData } = await import("~/services/data-import.server");
      mockRoleCreate.mockResolvedValue({ id: "role-1" });

      const result = await importData({
        ...baseOptions,
        dryRun: false,
        rows: [{ name: "Editor", description: "Can edit", scope: "GLOBAL" }],
      });

      expect(result.imported).toBe(1);
      expect(mockRoleCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: "tenant-1",
          name: "Editor",
          description: "Can edit",
          scope: "GLOBAL",
        }),
      });
    });

    it("uses TENANT as default scope when not specified", async () => {
      const { importData } = await import("~/services/data-import.server");
      mockRoleCreate.mockResolvedValue({ id: "role-1" });

      await importData({
        ...baseOptions,
        dryRun: false,
        rows: [{ name: "Viewer" }],
      });

      expect(mockRoleCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          scope: "TENANT",
        }),
      });
    });

    it("handles create failure gracefully", async () => {
      const { importData } = await import("~/services/data-import.server");
      mockRoleCreate.mockRejectedValue(new Error("DB error"));

      const result = await importData({
        ...baseOptions,
        dryRun: false,
        rows: [{ name: "FailRole" }],
      });

      expect(result.imported).toBe(0);
    });
  });

  // ---------- importData: countries ----------

  describe("importData - countries", () => {
    const baseOptions = {
      entity: "countries",
      tenantId: "tenant-1",
      userId: "user-1",
      dryRun: false,
    };

    it("validates country rows in dry run", async () => {
      const { importData } = await import("~/services/data-import.server");
      mockCountryFindUnique.mockResolvedValue(null);

      const result = await importData({
        ...baseOptions,
        dryRun: true,
        rows: [{ code: "US", name: "United States" }],
      });

      expect(result.validRows).toBe(1);
      expect(result.errorRows).toBe(0);
    });

    it("reports error when code or name is missing", async () => {
      const { importData } = await import("~/services/data-import.server");

      const result = await importData({
        ...baseOptions,
        dryRun: true,
        rows: [
          { code: "", name: "No Code" },
          { code: "XX", name: "" },
        ],
      });

      expect(result.errorRows).toBe(2);
    });

    it("reports error when code already exists", async () => {
      const { importData } = await import("~/services/data-import.server");
      mockCountryFindUnique.mockResolvedValue({ id: "c-1", code: "US" });

      const result = await importData({
        ...baseOptions,
        dryRun: true,
        rows: [{ code: "US", name: "United States" }],
      });

      expect(result.errorRows).toBe(1);
      expect(result.errors[0].message).toContain("US");
      expect(result.errors[0].message).toContain("already exists");
    });

    it("creates countries when not in dry run", async () => {
      const { importData } = await import("~/services/data-import.server");
      mockCountryFindUnique.mockResolvedValue(null);
      mockCountryCreate.mockResolvedValue({ id: "c-1" });

      const result = await importData({
        ...baseOptions,
        dryRun: false,
        rows: [
          {
            code: "ET",
            name: "Ethiopia",
            alpha3: "ETH",
            numericCode: "231",
            phoneCode: "+251",
            flag: "🇪🇹",
            sortOrder: "5",
          },
        ],
      });

      expect(result.imported).toBe(1);
      expect(mockCountryCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          code: "ET",
          name: "Ethiopia",
          alpha3: "ETH",
          numericCode: "231",
          phoneCode: "+251",
          flag: "🇪🇹",
          sortOrder: 5,
        }),
      });
    });

    it("defaults sortOrder to 0 when not provided", async () => {
      const { importData } = await import("~/services/data-import.server");
      mockCountryFindUnique.mockResolvedValue(null);
      mockCountryCreate.mockResolvedValue({ id: "c-1" });

      await importData({
        ...baseOptions,
        dryRun: false,
        rows: [{ code: "XX", name: "Test" }],
      });

      expect(mockCountryCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ sortOrder: 0 }),
      });
    });
  });

  // ---------- importData: titles ----------

  describe("importData - titles", () => {
    const baseOptions = {
      entity: "titles",
      tenantId: "tenant-1",
      userId: "user-1",
      dryRun: false,
    };

    it("validates title rows in dry run", async () => {
      const { importData } = await import("~/services/data-import.server");
      mockTitleFindUnique.mockResolvedValue(null);

      const result = await importData({
        ...baseOptions,
        dryRun: true,
        rows: [{ code: "MR", name: "Mr." }],
      });

      expect(result.validRows).toBe(1);
    });

    it("reports error when code or name is missing", async () => {
      const { importData } = await import("~/services/data-import.server");

      const result = await importData({
        ...baseOptions,
        dryRun: true,
        rows: [{ code: "", name: "" }],
      });

      expect(result.errorRows).toBe(1);
      expect(result.errors[0].message).toBe("code and name are required");
    });

    it("reports error when code already exists", async () => {
      const { importData } = await import("~/services/data-import.server");
      mockTitleFindUnique.mockResolvedValue({ id: "t-1", code: "MR" });

      const result = await importData({
        ...baseOptions,
        dryRun: true,
        rows: [{ code: "MR", name: "Mr." }],
      });

      expect(result.errorRows).toBe(1);
    });

    it("creates titles when not in dry run", async () => {
      const { importData } = await import("~/services/data-import.server");
      mockTitleFindUnique.mockResolvedValue(null);
      mockTitleCreate.mockResolvedValue({ id: "t-1" });

      const result = await importData({
        ...baseOptions,
        dryRun: false,
        rows: [{ code: "MRS", name: "Mrs.", sortOrder: "2" }],
      });

      expect(result.imported).toBe(1);
      expect(mockTitleCreate).toHaveBeenCalledWith({
        data: { code: "MRS", name: "Mrs.", sortOrder: 2 },
      });
    });
  });

  // ---------- importData: languages ----------

  describe("importData - languages", () => {
    const baseOptions = {
      entity: "languages",
      tenantId: "tenant-1",
      userId: "user-1",
      dryRun: false,
    };

    it("validates language rows in dry run", async () => {
      const { importData } = await import("~/services/data-import.server");
      mockLanguageFindUnique.mockResolvedValue(null);

      const result = await importData({
        ...baseOptions,
        dryRun: true,
        rows: [{ code: "en", name: "English" }],
      });

      expect(result.validRows).toBe(1);
    });

    it("reports error when code or name is missing", async () => {
      const { importData } = await import("~/services/data-import.server");

      const result = await importData({
        ...baseOptions,
        dryRun: true,
        rows: [{ code: "en", name: "" }],
      });

      expect(result.errorRows).toBe(1);
    });

    it("reports error when code already exists", async () => {
      const { importData } = await import("~/services/data-import.server");
      mockLanguageFindUnique.mockResolvedValue({ id: "l-1", code: "en" });

      const result = await importData({
        ...baseOptions,
        dryRun: true,
        rows: [{ code: "en", name: "English" }],
      });

      expect(result.errorRows).toBe(1);
      expect(result.errors[0].message).toContain("already exists");
    });

    it("creates languages when not in dry run", async () => {
      const { importData } = await import("~/services/data-import.server");
      mockLanguageFindUnique.mockResolvedValue(null);
      mockLanguageCreate.mockResolvedValue({ id: "l-1" });

      const result = await importData({
        ...baseOptions,
        dryRun: false,
        rows: [{ code: "am", name: "Amharic", nativeName: "አማርኛ", sortOrder: "3" }],
      });

      expect(result.imported).toBe(1);
      expect(mockLanguageCreate).toHaveBeenCalledWith({
        data: {
          code: "am",
          name: "Amharic",
          nativeName: "አማርኛ",
          sortOrder: 3,
        },
      });
    });
  });

  // ---------- importData: currencies ----------

  describe("importData - currencies", () => {
    const baseOptions = {
      entity: "currencies",
      tenantId: "tenant-1",
      userId: "user-1",
      dryRun: false,
    };

    it("validates currency rows in dry run", async () => {
      const { importData } = await import("~/services/data-import.server");
      mockCurrencyFindUnique.mockResolvedValue(null);

      const result = await importData({
        ...baseOptions,
        dryRun: true,
        rows: [{ code: "USD", name: "US Dollar" }],
      });

      expect(result.validRows).toBe(1);
    });

    it("reports error when code or name is missing", async () => {
      const { importData } = await import("~/services/data-import.server");

      const result = await importData({
        ...baseOptions,
        dryRun: true,
        rows: [{ code: "", name: "No Code" }],
      });

      expect(result.errorRows).toBe(1);
    });

    it("reports error when code already exists", async () => {
      const { importData } = await import("~/services/data-import.server");
      mockCurrencyFindUnique.mockResolvedValue({ id: "cur-1", code: "USD" });

      const result = await importData({
        ...baseOptions,
        dryRun: true,
        rows: [{ code: "USD", name: "US Dollar" }],
      });

      expect(result.errorRows).toBe(1);
    });

    it("creates currencies when not in dry run", async () => {
      const { importData } = await import("~/services/data-import.server");
      mockCurrencyFindUnique.mockResolvedValue(null);
      mockCurrencyCreate.mockResolvedValue({ id: "cur-1" });

      const result = await importData({
        ...baseOptions,
        dryRun: false,
        rows: [{ code: "ETB", name: "Ethiopian Birr", symbol: "Br", decimalDigits: "2", sortOrder: "1" }],
      });

      expect(result.imported).toBe(1);
      expect(mockCurrencyCreate).toHaveBeenCalledWith({
        data: {
          code: "ETB",
          name: "Ethiopian Birr",
          symbol: "Br",
          decimalDigits: 2,
          sortOrder: 1,
        },
      });
    });

    it("defaults decimalDigits to 2 and sortOrder to 0", async () => {
      const { importData } = await import("~/services/data-import.server");
      mockCurrencyFindUnique.mockResolvedValue(null);
      mockCurrencyCreate.mockResolvedValue({ id: "cur-1" });

      await importData({
        ...baseOptions,
        dryRun: false,
        rows: [{ code: "JPY", name: "Japanese Yen" }],
      });

      expect(mockCurrencyCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ decimalDigits: 2, sortOrder: 0 }),
      });
    });
  });

  // ---------- importData: document-types ----------

  describe("importData - document-types", () => {
    const baseOptions = {
      entity: "document-types",
      tenantId: "tenant-1",
      userId: "user-1",
      dryRun: false,
    };

    it("validates document type rows in dry run", async () => {
      const { importData } = await import("~/services/data-import.server");
      mockDocumentTypeFindUnique.mockResolvedValue(null);

      const result = await importData({
        ...baseOptions,
        dryRun: true,
        rows: [{ code: "PASSPORT", name: "Passport" }],
      });

      expect(result.validRows).toBe(1);
    });

    it("reports error when code or name is missing", async () => {
      const { importData } = await import("~/services/data-import.server");

      const result = await importData({
        ...baseOptions,
        dryRun: true,
        rows: [{ code: "", name: "" }],
      });

      expect(result.errorRows).toBe(1);
    });

    it("reports error when code already exists", async () => {
      const { importData } = await import("~/services/data-import.server");
      mockDocumentTypeFindUnique.mockResolvedValue({ id: "dt-1", code: "PASSPORT" });

      const result = await importData({
        ...baseOptions,
        dryRun: true,
        rows: [{ code: "PASSPORT", name: "Passport" }],
      });

      expect(result.errorRows).toBe(1);
    });

    it("creates document types when not in dry run", async () => {
      const { importData } = await import("~/services/data-import.server");
      mockDocumentTypeFindUnique.mockResolvedValue(null);
      mockDocumentTypeCreate.mockResolvedValue({ id: "dt-1" });

      const result = await importData({
        ...baseOptions,
        dryRun: false,
        rows: [
          {
            code: "VISA",
            name: "Visa",
            description: "Travel visa",
            category: "TRAVEL",
            sortOrder: "10",
          },
        ],
      });

      expect(result.imported).toBe(1);
      expect(mockDocumentTypeCreate).toHaveBeenCalledWith({
        data: {
          code: "VISA",
          name: "Visa",
          description: "Travel visa",
          category: "TRAVEL",
          sortOrder: 10,
        },
      });
    });
  });

  // ---------- importData: custom-object-records ----------

  describe("importData - custom-object-records", () => {
    const baseOptions = {
      entity: "custom-object-records",
      tenantId: "tenant-1",
      userId: "user-1",
      objectId: "obj-1",
      dryRun: false,
    };

    it("throws when objectId is missing", async () => {
      const { importData } = await import("~/services/data-import.server");

      await expect(
        importData({
          entity: "custom-object-records",
          tenantId: "tenant-1",
          userId: "user-1",
          dryRun: false,
          rows: [{ data: '{"key":"val"}' }],
        }),
      ).rejects.toThrow("objectId required");
    });

    it("validates rows in dry run (all rows are valid)", async () => {
      const { importData } = await import("~/services/data-import.server");

      const result = await importData({
        ...baseOptions,
        dryRun: true,
        rows: [{ data: '{"key":"val"}' }, { plate: "ABC-123" }],
      });

      expect(result.validRows).toBe(2);
      expect(result.errorRows).toBe(0);
      expect(result.imported).toBe(0);
    });

    it("creates records with parsed JSON data field", async () => {
      const { importData } = await import("~/services/data-import.server");
      mockCustomObjectRecordCreate.mockResolvedValue({ id: "rec-1" });

      const result = await importData({
        ...baseOptions,
        dryRun: false,
        rows: [{ data: '{"plate":"XYZ-789"}' }],
      });

      expect(result.imported).toBe(1);
      expect(mockCustomObjectRecordCreate).toHaveBeenCalledWith({
        data: {
          definitionId: "obj-1",
          tenantId: "tenant-1",
          data: { plate: "XYZ-789" },
          createdBy: "user-1",
        },
      });
    });

    it("uses row directly when no data field is present", async () => {
      const { importData } = await import("~/services/data-import.server");
      mockCustomObjectRecordCreate.mockResolvedValue({ id: "rec-1" });

      await importData({
        ...baseOptions,
        dryRun: false,
        rows: [{ plate: "ABC-123", color: "red" }],
      });

      expect(mockCustomObjectRecordCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          data: { plate: "ABC-123", color: "red" },
        }),
      });
    });

    it("handles create failure gracefully", async () => {
      const { importData } = await import("~/services/data-import.server");
      mockCustomObjectRecordCreate.mockRejectedValue(new Error("DB error"));

      const result = await importData({
        ...baseOptions,
        dryRun: false,
        rows: [{ data: '{"key":"val"}' }],
      });

      expect(result.imported).toBe(0);
    });
  });

  // ---------- importData: unsupported entity ----------

  describe("importData - unsupported entity", () => {
    it("throws for unsupported entity type", async () => {
      const { importData } = await import("~/services/data-import.server");

      await expect(
        importData({
          entity: "widgets",
          tenantId: "tenant-1",
          userId: "user-1",
          dryRun: false,
          rows: [{ name: "test" }],
        }),
      ).rejects.toThrow("Unsupported entity: widgets");
    });
  });

  // ---------- importData: batching ----------

  describe("importData - batching", () => {
    it("processes large batches of users correctly", async () => {
      const { importData } = await import("~/services/data-import.server");
      mockUserFindFirst.mockResolvedValue(null);
      mockHashPassword.mockResolvedValue("hashed");
      mockUserCreate.mockResolvedValue({ id: "new" });

      const rows = Array.from({ length: 150 }, (_, i) => ({
        email: `user${i}@test.com`,
        name: `User ${i}`,
      }));

      const result = await importData({
        entity: "users",
        tenantId: "tenant-1",
        userId: "user-1",
        dryRun: false,
        rows,
      });

      expect(result.totalRows).toBe(150);
      expect(result.validRows).toBe(150);
      expect(result.imported).toBe(150);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Country mocks ───────────────────────────────────────
const mockCountryFindMany = vi.fn();
const mockCountryFindFirst = vi.fn();
const mockCountryCreate = vi.fn();
const mockCountryUpdate = vi.fn();
const mockCountryDelete = vi.fn();
const mockCountryCount = vi.fn();

// ─── Title mocks ─────────────────────────────────────────
const mockTitleFindMany = vi.fn();
const mockTitleFindFirst = vi.fn();
const mockTitleCreate = vi.fn();
const mockTitleUpdate = vi.fn();
const mockTitleDelete = vi.fn();
const mockTitleCount = vi.fn();

// ─── Language mocks ──────────────────────────────────────
const mockLanguageFindMany = vi.fn();
const mockLanguageFindFirst = vi.fn();
const mockLanguageCreate = vi.fn();
const mockLanguageUpdate = vi.fn();
const mockLanguageDelete = vi.fn();
const mockLanguageCount = vi.fn();

// ─── Currency mocks ──────────────────────────────────────
const mockCurrencyFindMany = vi.fn();
const mockCurrencyFindFirst = vi.fn();
const mockCurrencyCreate = vi.fn();
const mockCurrencyUpdate = vi.fn();
const mockCurrencyDelete = vi.fn();
const mockCurrencyCount = vi.fn();

// ─── DocumentType mocks ──────────────────────────────────
const mockDocTypeFindMany = vi.fn();
const mockDocTypeFindFirst = vi.fn();
const mockDocTypeCreate = vi.fn();
const mockDocTypeUpdate = vi.fn();
const mockDocTypeDelete = vi.fn();
const mockDocTypeCount = vi.fn();

// ─── AuditLog mock ──────────────────────────────────────
const mockAuditLogCreate = vi.fn();

vi.mock("~/lib/db/db.server", () => ({
  prisma: {
    country: {
      findMany: (...args: unknown[]) => mockCountryFindMany(...args),
      findFirst: (...args: unknown[]) => mockCountryFindFirst(...args),
      create: (...args: unknown[]) => mockCountryCreate(...args),
      update: (...args: unknown[]) => mockCountryUpdate(...args),
      delete: (...args: unknown[]) => mockCountryDelete(...args),
      count: (...args: unknown[]) => mockCountryCount(...args),
    },
    title: {
      findMany: (...args: unknown[]) => mockTitleFindMany(...args),
      findFirst: (...args: unknown[]) => mockTitleFindFirst(...args),
      create: (...args: unknown[]) => mockTitleCreate(...args),
      update: (...args: unknown[]) => mockTitleUpdate(...args),
      delete: (...args: unknown[]) => mockTitleDelete(...args),
      count: (...args: unknown[]) => mockTitleCount(...args),
    },
    language: {
      findMany: (...args: unknown[]) => mockLanguageFindMany(...args),
      findFirst: (...args: unknown[]) => mockLanguageFindFirst(...args),
      create: (...args: unknown[]) => mockLanguageCreate(...args),
      update: (...args: unknown[]) => mockLanguageUpdate(...args),
      delete: (...args: unknown[]) => mockLanguageDelete(...args),
      count: (...args: unknown[]) => mockLanguageCount(...args),
    },
    currency: {
      findMany: (...args: unknown[]) => mockCurrencyFindMany(...args),
      findFirst: (...args: unknown[]) => mockCurrencyFindFirst(...args),
      create: (...args: unknown[]) => mockCurrencyCreate(...args),
      update: (...args: unknown[]) => mockCurrencyUpdate(...args),
      delete: (...args: unknown[]) => mockCurrencyDelete(...args),
      count: (...args: unknown[]) => mockCurrencyCount(...args),
    },
    documentType: {
      findMany: (...args: unknown[]) => mockDocTypeFindMany(...args),
      findFirst: (...args: unknown[]) => mockDocTypeFindFirst(...args),
      create: (...args: unknown[]) => mockDocTypeCreate(...args),
      update: (...args: unknown[]) => mockDocTypeUpdate(...args),
      delete: (...args: unknown[]) => mockDocTypeDelete(...args),
      count: (...args: unknown[]) => mockDocTypeCount(...args),
    },
    auditLog: {
      create: (...args: unknown[]) => mockAuditLogCreate(...args),
    },
  },
}));

vi.mock("~/lib/monitoring/logger.server", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ─── Shared helpers ──────────────────────────────────────

const ctx = {
  userId: "u-1",
  tenantId: "t-1",
  ipAddress: "127.0.0.1",
  userAgent: "test-agent",
};

function makePrismaUniqueError() {
  const err = new Error("Unique constraint failed") as Error & { code: string };
  err.code = "P2002";
  return err;
}

// ═════════════════════════════════════════════════════════
// Tests
// ═════════════════════════════════════════════════════════

describe("reference-data.server", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAuditLogCreate.mockResolvedValue({});
  });

  // ─────────────────────────────────────────────────────
  // Country
  // ─────────────────────────────────────────────────────

  describe("listCountries", () => {
    it("returns all countries without filter", async () => {
      const { listCountries } = await import("../reference-data.server");
      const countries = [
        { id: "c-1", code: "US", name: "United States", isActive: true },
        { id: "c-2", code: "CA", name: "Canada", isActive: true },
      ];
      mockCountryFindMany.mockResolvedValue(countries);

      const result = await listCountries();

      expect(result).toHaveLength(2);
      expect(mockCountryFindMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
    });

    it("filters by isActive", async () => {
      const { listCountries } = await import("../reference-data.server");
      mockCountryFindMany.mockResolvedValue([]);

      await listCountries({ isActive: true });

      expect(mockCountryFindMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
    });

    it("filters by search text", async () => {
      const { listCountries } = await import("../reference-data.server");
      mockCountryFindMany.mockResolvedValue([]);

      await listCountries({ search: "united" });

      expect(mockCountryFindMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: "united", mode: "insensitive" } },
            { code: { contains: "united", mode: "insensitive" } },
          ],
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
    });

    it("combines isActive and search filters", async () => {
      const { listCountries } = await import("../reference-data.server");
      mockCountryFindMany.mockResolvedValue([]);

      await listCountries({ isActive: false, search: "can" });

      expect(mockCountryFindMany).toHaveBeenCalledWith({
        where: {
          isActive: false,
          OR: [
            { name: { contains: "can", mode: "insensitive" } },
            { code: { contains: "can", mode: "insensitive" } },
          ],
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
    });
  });

  describe("listCountriesPaginated", () => {
    it("returns paginated results with defaults", async () => {
      const { listCountriesPaginated } = await import("../reference-data.server");
      const items = [{ id: "c-1", code: "US", name: "United States" }];
      mockCountryFindMany.mockResolvedValue(items);
      mockCountryCount.mockResolvedValue(25);

      const result = await listCountriesPaginated({ page: 2, pageSize: 10 });

      expect(result).toEqual({ items, totalCount: 25 });
      expect(mockCountryFindMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        skip: 10,
        take: 10,
      });
    });

    it("respects custom where and orderBy", async () => {
      const { listCountriesPaginated } = await import("../reference-data.server");
      mockCountryFindMany.mockResolvedValue([]);
      mockCountryCount.mockResolvedValue(0);

      await listCountriesPaginated({
        page: 1,
        pageSize: 5,
        where: { isActive: true },
        orderBy: [{ name: "desc" }],
      });

      expect(mockCountryFindMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: [{ name: "desc" }],
        skip: 0,
        take: 5,
      });
    });
  });

  describe("getCountry", () => {
    it("returns a country by id", async () => {
      const { getCountry } = await import("../reference-data.server");
      const country = { id: "c-1", code: "US", name: "United States" };
      mockCountryFindFirst.mockResolvedValue(country);

      const result = await getCountry("c-1");

      expect(result).toEqual(country);
      expect(mockCountryFindFirst).toHaveBeenCalledWith({ where: { id: "c-1" } });
    });

    it("throws ReferenceDataError when not found", async () => {
      const { getCountry, ReferenceDataError } = await import("../reference-data.server");
      mockCountryFindFirst.mockResolvedValue(null);

      await expect(getCountry("nonexistent")).rejects.toThrow(ReferenceDataError);
      await expect(getCountry("nonexistent")).rejects.toThrow("Country not found");
    });
  });

  describe("createCountry", () => {
    it("creates a country and writes audit log", async () => {
      const { createCountry } = await import("../reference-data.server");
      const created = { id: "c-1", code: "ET", name: "Ethiopia" };
      mockCountryCreate.mockResolvedValue(created);

      const result = await createCountry(
        { code: "et", name: "Ethiopia", alpha3: "ETH", numericCode: "231", phoneCode: "+251", flag: "", sortOrder: 0, isActive: true },
        ctx,
      );

      expect(result.id).toBe("c-1");
      expect(mockCountryCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          code: "ET",
          name: "Ethiopia",
          alpha3: "ETH",
          numericCode: "231",
          phoneCode: "+251",
          flag: null,
        }),
      });
      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: "t-1",
          userId: "u-1",
          action: "CREATE",
          entityType: "Country",
          entityId: "c-1",
        }),
      });
    });

    it("uppercases the code", async () => {
      const { createCountry } = await import("../reference-data.server");
      mockCountryCreate.mockResolvedValue({ id: "c-1", code: "US", name: "United States" });

      await createCountry(
        { code: "us", name: "United States", alpha3: "", numericCode: "", phoneCode: "", flag: "", sortOrder: 0, isActive: true },
        ctx,
      );

      expect(mockCountryCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ code: "US" }),
      });
    });

    it("throws 409 on duplicate code", async () => {
      const { createCountry, ReferenceDataError } = await import("../reference-data.server");
      mockCountryCreate.mockRejectedValue(makePrismaUniqueError());

      await expect(
        createCountry(
          { code: "US", name: "United States", alpha3: "", numericCode: "", phoneCode: "", flag: "", sortOrder: 0, isActive: true },
          ctx,
        ),
      ).rejects.toThrow(ReferenceDataError);

      await expect(
        createCountry(
          { code: "US", name: "United States", alpha3: "", numericCode: "", phoneCode: "", flag: "", sortOrder: 0, isActive: true },
          ctx,
        ),
      ).rejects.toThrow("A country with this code already exists");
    });

    it("rethrows non-P2002 errors", async () => {
      const { createCountry } = await import("../reference-data.server");
      const dbError = new Error("Connection lost");
      mockCountryCreate.mockRejectedValue(dbError);

      await expect(
        createCountry(
          { code: "US", name: "United States", alpha3: "", numericCode: "", phoneCode: "", flag: "", sortOrder: 0, isActive: true },
          ctx,
        ),
      ).rejects.toThrow("Connection lost");
    });

    it("sets optional fields to null when empty", async () => {
      const { createCountry } = await import("../reference-data.server");
      mockCountryCreate.mockResolvedValue({ id: "c-1", code: "US", name: "United States" });

      await createCountry(
        { code: "US", name: "United States", alpha3: "", numericCode: "", phoneCode: "", flag: "", sortOrder: 0, isActive: true },
        ctx,
      );

      expect(mockCountryCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          alpha3: null,
          numericCode: null,
          phoneCode: null,
          flag: null,
        }),
      });
    });
  });

  describe("updateCountry", () => {
    it("updates an existing country and writes audit", async () => {
      const { updateCountry } = await import("../reference-data.server");
      mockCountryFindFirst.mockResolvedValue({ id: "c-1", code: "US", name: "United States" });
      mockCountryUpdate.mockResolvedValue({ id: "c-1", code: "US", name: "USA" });

      const result = await updateCountry(
        "c-1",
        { code: "us", name: "USA", alpha3: "USA", numericCode: "840", phoneCode: "+1", flag: "", sortOrder: 1, isActive: true },
        ctx,
      );

      expect(result.name).toBe("USA");
      expect(mockCountryUpdate).toHaveBeenCalledWith({
        where: { id: "c-1" },
        data: expect.objectContaining({ code: "US", name: "USA" }),
      });
      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "UPDATE",
          entityType: "Country",
          entityId: "c-1",
        }),
      });
    });

    it("throws 404 when country not found", async () => {
      const { updateCountry, ReferenceDataError } = await import("../reference-data.server");
      mockCountryFindFirst.mockResolvedValue(null);

      await expect(
        updateCountry(
          "nonexistent",
          { code: "XX", name: "X", alpha3: "", numericCode: "", phoneCode: "", flag: "", sortOrder: 0, isActive: true },
          ctx,
        ),
      ).rejects.toThrow(ReferenceDataError);
    });

    it("throws 409 on duplicate code during update", async () => {
      const { updateCountry, ReferenceDataError } = await import("../reference-data.server");
      mockCountryFindFirst.mockResolvedValue({ id: "c-1", code: "US", name: "United States" });
      mockCountryUpdate.mockRejectedValue(makePrismaUniqueError());

      await expect(
        updateCountry(
          "c-1",
          { code: "CA", name: "Canada", alpha3: "", numericCode: "", phoneCode: "", flag: "", sortOrder: 0, isActive: true },
          ctx,
        ),
      ).rejects.toThrow(ReferenceDataError);
    });
  });

  describe("deleteCountry", () => {
    it("deletes a country and writes audit", async () => {
      const { deleteCountry } = await import("../reference-data.server");
      mockCountryFindFirst.mockResolvedValue({ id: "c-1", code: "US", name: "United States" });
      mockCountryDelete.mockResolvedValue({});

      await deleteCountry("c-1", ctx);

      expect(mockCountryDelete).toHaveBeenCalledWith({ where: { id: "c-1" } });
      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "DELETE",
          entityType: "Country",
          entityId: "c-1",
        }),
      });
    });

    it("throws 404 when country not found", async () => {
      const { deleteCountry, ReferenceDataError } = await import("../reference-data.server");
      mockCountryFindFirst.mockResolvedValue(null);

      await expect(deleteCountry("nonexistent", ctx)).rejects.toThrow(ReferenceDataError);
      await expect(deleteCountry("nonexistent", ctx)).rejects.toThrow("Country not found");
    });
  });

  // ─────────────────────────────────────────────────────
  // Title
  // ─────────────────────────────────────────────────────

  describe("listTitles", () => {
    it("returns all titles without filter", async () => {
      const { listTitles } = await import("../reference-data.server");
      const titles = [
        { id: "t-1", code: "MR", name: "Mr.", isActive: true },
        { id: "t-2", code: "MRS", name: "Mrs.", isActive: true },
      ];
      mockTitleFindMany.mockResolvedValue(titles);

      const result = await listTitles();

      expect(result).toHaveLength(2);
      expect(mockTitleFindMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
    });

    it("filters by isActive", async () => {
      const { listTitles } = await import("../reference-data.server");
      mockTitleFindMany.mockResolvedValue([]);

      await listTitles({ isActive: false });

      expect(mockTitleFindMany).toHaveBeenCalledWith({
        where: { isActive: false },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
    });

    it("filters by search text", async () => {
      const { listTitles } = await import("../reference-data.server");
      mockTitleFindMany.mockResolvedValue([]);

      await listTitles({ search: "mr" });

      expect(mockTitleFindMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: "mr", mode: "insensitive" } },
            { code: { contains: "mr", mode: "insensitive" } },
          ],
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
    });
  });

  describe("listTitlesPaginated", () => {
    it("returns paginated titles", async () => {
      const { listTitlesPaginated } = await import("../reference-data.server");
      mockTitleFindMany.mockResolvedValue([{ id: "t-1", code: "MR", name: "Mr." }]);
      mockTitleCount.mockResolvedValue(15);

      const result = await listTitlesPaginated({ page: 1, pageSize: 10 });

      expect(result).toEqual({
        items: [{ id: "t-1", code: "MR", name: "Mr." }],
        totalCount: 15,
      });
      expect(mockTitleFindMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        skip: 0,
        take: 10,
      });
    });

    it("uses custom orderBy when provided", async () => {
      const { listTitlesPaginated } = await import("../reference-data.server");
      mockTitleFindMany.mockResolvedValue([]);
      mockTitleCount.mockResolvedValue(0);

      await listTitlesPaginated({ page: 1, pageSize: 5, orderBy: [{ code: "asc" }] });

      expect(mockTitleFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: [{ code: "asc" }] }),
      );
    });
  });

  describe("getTitle", () => {
    it("returns a title by id", async () => {
      const { getTitle } = await import("../reference-data.server");
      const title = { id: "t-1", code: "DR", name: "Dr." };
      mockTitleFindFirst.mockResolvedValue(title);

      const result = await getTitle("t-1");

      expect(result).toEqual(title);
    });

    it("throws when title not found", async () => {
      const { getTitle, ReferenceDataError } = await import("../reference-data.server");
      mockTitleFindFirst.mockResolvedValue(null);

      await expect(getTitle("nonexistent")).rejects.toThrow(ReferenceDataError);
      await expect(getTitle("nonexistent")).rejects.toThrow("Title not found");
    });
  });

  describe("createTitle", () => {
    it("creates a title and writes audit log", async () => {
      const { createTitle } = await import("../reference-data.server");
      const created = { id: "t-1", code: "PROF", name: "Professor" };
      mockTitleCreate.mockResolvedValue(created);

      const result = await createTitle(
        { code: "prof", name: "Professor", sortOrder: 5, isActive: true },
        ctx,
      );

      expect(result.id).toBe("t-1");
      expect(mockTitleCreate).toHaveBeenCalledWith({
        data: {
          code: "PROF",
          name: "Professor",
          sortOrder: 5,
          isActive: true,
        },
      });
      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "CREATE",
          entityType: "Title",
        }),
      });
    });

    it("throws 409 on duplicate code", async () => {
      const { createTitle, ReferenceDataError } = await import("../reference-data.server");
      mockTitleCreate.mockRejectedValue(makePrismaUniqueError());

      await expect(
        createTitle({ code: "MR", name: "Mr.", sortOrder: 0, isActive: true }, ctx),
      ).rejects.toThrow(ReferenceDataError);
    });
  });

  describe("updateTitle", () => {
    it("updates an existing title", async () => {
      const { updateTitle } = await import("../reference-data.server");
      mockTitleFindFirst.mockResolvedValue({ id: "t-1", code: "MR", name: "Mr." });
      mockTitleUpdate.mockResolvedValue({ id: "t-1", code: "MR", name: "Mister" });

      const result = await updateTitle(
        "t-1",
        { code: "mr", name: "Mister", sortOrder: 0, isActive: true },
        ctx,
      );

      expect(result.name).toBe("Mister");
      expect(mockTitleUpdate).toHaveBeenCalledWith({
        where: { id: "t-1" },
        data: { code: "MR", name: "Mister", sortOrder: 0, isActive: true },
      });
      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: "UPDATE", entityType: "Title" }),
      });
    });

    it("throws 404 when title not found", async () => {
      const { updateTitle, ReferenceDataError } = await import("../reference-data.server");
      mockTitleFindFirst.mockResolvedValue(null);

      await expect(
        updateTitle("nonexistent", { code: "X", name: "X", sortOrder: 0, isActive: true }, ctx),
      ).rejects.toThrow(ReferenceDataError);
    });

    it("throws 409 on duplicate code during update", async () => {
      const { updateTitle, ReferenceDataError } = await import("../reference-data.server");
      mockTitleFindFirst.mockResolvedValue({ id: "t-1", code: "MR", name: "Mr." });
      mockTitleUpdate.mockRejectedValue(makePrismaUniqueError());

      await expect(
        updateTitle("t-1", { code: "MRS", name: "Mrs.", sortOrder: 0, isActive: true }, ctx),
      ).rejects.toThrow(ReferenceDataError);
    });
  });

  describe("deleteTitle", () => {
    it("deletes a title and writes audit", async () => {
      const { deleteTitle } = await import("../reference-data.server");
      mockTitleFindFirst.mockResolvedValue({ id: "t-1", code: "MR", name: "Mr." });
      mockTitleDelete.mockResolvedValue({});

      await deleteTitle("t-1", ctx);

      expect(mockTitleDelete).toHaveBeenCalledWith({ where: { id: "t-1" } });
      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: "DELETE", entityType: "Title" }),
      });
    });

    it("throws 404 when title not found", async () => {
      const { deleteTitle, ReferenceDataError } = await import("../reference-data.server");
      mockTitleFindFirst.mockResolvedValue(null);

      await expect(deleteTitle("nonexistent", ctx)).rejects.toThrow(ReferenceDataError);
    });
  });

  // ─────────────────────────────────────────────────────
  // Language
  // ─────────────────────────────────────────────────────

  describe("listLanguages", () => {
    it("returns all languages without filter", async () => {
      const { listLanguages } = await import("../reference-data.server");
      const languages = [
        { id: "l-1", code: "en", name: "English", nativeName: "English" },
        { id: "l-2", code: "fr", name: "French", nativeName: "Francais" },
      ];
      mockLanguageFindMany.mockResolvedValue(languages);

      const result = await listLanguages();

      expect(result).toHaveLength(2);
      expect(mockLanguageFindMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
    });

    it("filters by isActive", async () => {
      const { listLanguages } = await import("../reference-data.server");
      mockLanguageFindMany.mockResolvedValue([]);

      await listLanguages({ isActive: true });

      expect(mockLanguageFindMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
    });

    it("filters by search including nativeName", async () => {
      const { listLanguages } = await import("../reference-data.server");
      mockLanguageFindMany.mockResolvedValue([]);

      await listLanguages({ search: "franc" });

      expect(mockLanguageFindMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: "franc", mode: "insensitive" } },
            { code: { contains: "franc", mode: "insensitive" } },
            { nativeName: { contains: "franc", mode: "insensitive" } },
          ],
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
    });
  });

  describe("listLanguagesPaginated", () => {
    it("returns paginated languages", async () => {
      const { listLanguagesPaginated } = await import("../reference-data.server");
      mockLanguageFindMany.mockResolvedValue([{ id: "l-1", code: "en", name: "English" }]);
      mockLanguageCount.mockResolvedValue(3);

      const result = await listLanguagesPaginated({ page: 1, pageSize: 10 });

      expect(result).toEqual({
        items: [{ id: "l-1", code: "en", name: "English" }],
        totalCount: 3,
      });
    });
  });

  describe("getLanguage", () => {
    it("returns a language by id", async () => {
      const { getLanguage } = await import("../reference-data.server");
      const language = { id: "l-1", code: "en", name: "English" };
      mockLanguageFindFirst.mockResolvedValue(language);

      const result = await getLanguage("l-1");

      expect(result).toEqual(language);
    });

    it("throws when language not found", async () => {
      const { getLanguage, ReferenceDataError } = await import("../reference-data.server");
      mockLanguageFindFirst.mockResolvedValue(null);

      await expect(getLanguage("nonexistent")).rejects.toThrow(ReferenceDataError);
      await expect(getLanguage("nonexistent")).rejects.toThrow("Language not found");
    });
  });

  describe("createLanguage", () => {
    it("creates a language with lowercased code", async () => {
      const { createLanguage } = await import("../reference-data.server");
      const created = { id: "l-1", code: "am", name: "Amharic" };
      mockLanguageCreate.mockResolvedValue(created);

      const result = await createLanguage(
        { code: "AM", name: "Amharic", nativeName: "Amharic native", sortOrder: 0, isActive: true },
        ctx,
      );

      expect(result.id).toBe("l-1");
      expect(mockLanguageCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          code: "am",
          name: "Amharic",
          nativeName: "Amharic native",
        }),
      });
      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "CREATE",
          entityType: "Language",
        }),
      });
    });

    it("sets nativeName to null when empty", async () => {
      const { createLanguage } = await import("../reference-data.server");
      mockLanguageCreate.mockResolvedValue({ id: "l-1", code: "en", name: "English" });

      await createLanguage(
        { code: "en", name: "English", nativeName: "", sortOrder: 0, isActive: true },
        ctx,
      );

      expect(mockLanguageCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ nativeName: null }),
      });
    });

    it("throws 409 on duplicate code", async () => {
      const { createLanguage, ReferenceDataError } = await import("../reference-data.server");
      mockLanguageCreate.mockRejectedValue(makePrismaUniqueError());

      await expect(
        createLanguage({ code: "en", name: "English", nativeName: "", sortOrder: 0, isActive: true }, ctx),
      ).rejects.toThrow(ReferenceDataError);
    });

    it("rethrows non-duplicate errors", async () => {
      const { createLanguage } = await import("../reference-data.server");
      mockLanguageCreate.mockRejectedValue(new Error("DB down"));

      await expect(
        createLanguage({ code: "en", name: "English", nativeName: "", sortOrder: 0, isActive: true }, ctx),
      ).rejects.toThrow("DB down");
    });
  });

  describe("updateLanguage", () => {
    it("updates an existing language", async () => {
      const { updateLanguage } = await import("../reference-data.server");
      mockLanguageFindFirst.mockResolvedValue({ id: "l-1", code: "en", name: "English" });
      mockLanguageUpdate.mockResolvedValue({ id: "l-1", code: "en", name: "English (Updated)" });

      const result = await updateLanguage(
        "l-1",
        { code: "EN", name: "English (Updated)", nativeName: "", sortOrder: 0, isActive: true },
        ctx,
      );

      expect(result.name).toBe("English (Updated)");
      expect(mockLanguageUpdate).toHaveBeenCalledWith({
        where: { id: "l-1" },
        data: expect.objectContaining({ code: "en", name: "English (Updated)" }),
      });
    });

    it("throws 404 when language not found", async () => {
      const { updateLanguage, ReferenceDataError } = await import("../reference-data.server");
      mockLanguageFindFirst.mockResolvedValue(null);

      await expect(
        updateLanguage("nonexistent", { code: "xx", name: "X", nativeName: "", sortOrder: 0, isActive: true }, ctx),
      ).rejects.toThrow(ReferenceDataError);
    });

    it("throws 409 on duplicate code", async () => {
      const { updateLanguage, ReferenceDataError } = await import("../reference-data.server");
      mockLanguageFindFirst.mockResolvedValue({ id: "l-1", code: "en", name: "English" });
      mockLanguageUpdate.mockRejectedValue(makePrismaUniqueError());

      await expect(
        updateLanguage("l-1", { code: "fr", name: "French", nativeName: "", sortOrder: 0, isActive: true }, ctx),
      ).rejects.toThrow(ReferenceDataError);
    });
  });

  describe("deleteLanguage", () => {
    it("deletes a language and writes audit", async () => {
      const { deleteLanguage } = await import("../reference-data.server");
      mockLanguageFindFirst.mockResolvedValue({ id: "l-1", code: "en", name: "English" });
      mockLanguageDelete.mockResolvedValue({});

      await deleteLanguage("l-1", ctx);

      expect(mockLanguageDelete).toHaveBeenCalledWith({ where: { id: "l-1" } });
      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: "DELETE", entityType: "Language" }),
      });
    });

    it("throws 404 when language not found", async () => {
      const { deleteLanguage, ReferenceDataError } = await import("../reference-data.server");
      mockLanguageFindFirst.mockResolvedValue(null);

      await expect(deleteLanguage("nonexistent", ctx)).rejects.toThrow(ReferenceDataError);
    });
  });

  // ─────────────────────────────────────────────────────
  // Currency
  // ─────────────────────────────────────────────────────

  describe("listCurrencies", () => {
    it("returns all currencies without filter", async () => {
      const { listCurrencies } = await import("../reference-data.server");
      const currencies = [
        { id: "cur-1", code: "USD", name: "US Dollar", symbol: "$" },
        { id: "cur-2", code: "EUR", name: "Euro", symbol: "EUR" },
      ];
      mockCurrencyFindMany.mockResolvedValue(currencies);

      const result = await listCurrencies();

      expect(result).toHaveLength(2);
    });

    it("filters by search including symbol", async () => {
      const { listCurrencies } = await import("../reference-data.server");
      mockCurrencyFindMany.mockResolvedValue([]);

      await listCurrencies({ search: "$" });

      expect(mockCurrencyFindMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: "$", mode: "insensitive" } },
            { code: { contains: "$", mode: "insensitive" } },
            { symbol: { contains: "$", mode: "insensitive" } },
          ],
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
    });

    it("filters by isActive", async () => {
      const { listCurrencies } = await import("../reference-data.server");
      mockCurrencyFindMany.mockResolvedValue([]);

      await listCurrencies({ isActive: true });

      expect(mockCurrencyFindMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
    });
  });

  describe("listCurrenciesPaginated", () => {
    it("returns paginated currencies", async () => {
      const { listCurrenciesPaginated } = await import("../reference-data.server");
      mockCurrencyFindMany.mockResolvedValue([{ id: "cur-1", code: "USD", name: "US Dollar" }]);
      mockCurrencyCount.mockResolvedValue(50);

      const result = await listCurrenciesPaginated({ page: 3, pageSize: 20 });

      expect(result).toEqual({
        items: [{ id: "cur-1", code: "USD", name: "US Dollar" }],
        totalCount: 50,
      });
      expect(mockCurrencyFindMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        skip: 40,
        take: 20,
      });
    });
  });

  describe("getCurrency", () => {
    it("returns a currency by id", async () => {
      const { getCurrency } = await import("../reference-data.server");
      const currency = { id: "cur-1", code: "ETB", name: "Ethiopian Birr" };
      mockCurrencyFindFirst.mockResolvedValue(currency);

      const result = await getCurrency("cur-1");

      expect(result).toEqual(currency);
    });

    it("throws when currency not found", async () => {
      const { getCurrency, ReferenceDataError } = await import("../reference-data.server");
      mockCurrencyFindFirst.mockResolvedValue(null);

      await expect(getCurrency("nonexistent")).rejects.toThrow(ReferenceDataError);
      await expect(getCurrency("nonexistent")).rejects.toThrow("Currency not found");
    });
  });

  describe("createCurrency", () => {
    it("creates a currency with uppercased code and audit", async () => {
      const { createCurrency } = await import("../reference-data.server");
      const created = { id: "cur-1", code: "ETB", name: "Ethiopian Birr" };
      mockCurrencyCreate.mockResolvedValue(created);

      const result = await createCurrency(
        { code: "etb", name: "Ethiopian Birr", symbol: "Br", decimalDigits: 2, sortOrder: 0, isActive: true },
        ctx,
      );

      expect(result.id).toBe("cur-1");
      expect(mockCurrencyCreate).toHaveBeenCalledWith({
        data: {
          code: "ETB",
          name: "Ethiopian Birr",
          symbol: "Br",
          decimalDigits: 2,
          sortOrder: 0,
          isActive: true,
        },
      });
      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "CREATE",
          entityType: "Currency",
        }),
      });
    });

    it("sets symbol to null when empty", async () => {
      const { createCurrency } = await import("../reference-data.server");
      mockCurrencyCreate.mockResolvedValue({ id: "cur-1", code: "USD", name: "US Dollar" });

      await createCurrency(
        { code: "USD", name: "US Dollar", symbol: "", decimalDigits: 2, sortOrder: 0, isActive: true },
        ctx,
      );

      expect(mockCurrencyCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ symbol: null }),
      });
    });

    it("throws 409 on duplicate code", async () => {
      const { createCurrency, ReferenceDataError } = await import("../reference-data.server");
      mockCurrencyCreate.mockRejectedValue(makePrismaUniqueError());

      await expect(
        createCurrency(
          { code: "USD", name: "US Dollar", symbol: "$", decimalDigits: 2, sortOrder: 0, isActive: true },
          ctx,
        ),
      ).rejects.toThrow(ReferenceDataError);
    });

    it("rethrows non-P2002 errors", async () => {
      const { createCurrency } = await import("../reference-data.server");
      mockCurrencyCreate.mockRejectedValue(new Error("Timeout"));

      await expect(
        createCurrency(
          { code: "USD", name: "US Dollar", symbol: "$", decimalDigits: 2, sortOrder: 0, isActive: true },
          ctx,
        ),
      ).rejects.toThrow("Timeout");
    });
  });

  describe("updateCurrency", () => {
    it("updates an existing currency", async () => {
      const { updateCurrency } = await import("../reference-data.server");
      mockCurrencyFindFirst.mockResolvedValue({ id: "cur-1", code: "USD", name: "US Dollar" });
      mockCurrencyUpdate.mockResolvedValue({ id: "cur-1", code: "USD", name: "United States Dollar" });

      const result = await updateCurrency(
        "cur-1",
        { code: "usd", name: "United States Dollar", symbol: "$", decimalDigits: 2, sortOrder: 0, isActive: true },
        ctx,
      );

      expect(result.name).toBe("United States Dollar");
      expect(mockCurrencyUpdate).toHaveBeenCalledWith({
        where: { id: "cur-1" },
        data: expect.objectContaining({ code: "USD" }),
      });
    });

    it("throws 404 when currency not found", async () => {
      const { updateCurrency, ReferenceDataError } = await import("../reference-data.server");
      mockCurrencyFindFirst.mockResolvedValue(null);

      await expect(
        updateCurrency(
          "nonexistent",
          { code: "XXX", name: "X", symbol: "", decimalDigits: 0, sortOrder: 0, isActive: true },
          ctx,
        ),
      ).rejects.toThrow(ReferenceDataError);
    });

    it("throws 409 on duplicate code during update", async () => {
      const { updateCurrency, ReferenceDataError } = await import("../reference-data.server");
      mockCurrencyFindFirst.mockResolvedValue({ id: "cur-1", code: "USD", name: "US Dollar" });
      mockCurrencyUpdate.mockRejectedValue(makePrismaUniqueError());

      await expect(
        updateCurrency(
          "cur-1",
          { code: "EUR", name: "Euro", symbol: "EUR", decimalDigits: 2, sortOrder: 0, isActive: true },
          ctx,
        ),
      ).rejects.toThrow(ReferenceDataError);
    });
  });

  describe("deleteCurrency", () => {
    it("deletes a currency and writes audit", async () => {
      const { deleteCurrency } = await import("../reference-data.server");
      mockCurrencyFindFirst.mockResolvedValue({ id: "cur-1", code: "USD", name: "US Dollar" });
      mockCurrencyDelete.mockResolvedValue({});

      await deleteCurrency("cur-1", ctx);

      expect(mockCurrencyDelete).toHaveBeenCalledWith({ where: { id: "cur-1" } });
      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "DELETE",
          entityType: "Currency",
          entityId: "cur-1",
        }),
      });
    });

    it("throws 404 when currency not found", async () => {
      const { deleteCurrency, ReferenceDataError } = await import("../reference-data.server");
      mockCurrencyFindFirst.mockResolvedValue(null);

      await expect(deleteCurrency("nonexistent", ctx)).rejects.toThrow(ReferenceDataError);
    });
  });

  // ─────────────────────────────────────────────────────
  // Document Type
  // ─────────────────────────────────────────────────────

  describe("listDocumentTypes", () => {
    it("returns all document types without filter", async () => {
      const { listDocumentTypes } = await import("../reference-data.server");
      const docTypes = [
        { id: "dt-1", code: "PASSPORT", name: "Passport", category: "Identity" },
        { id: "dt-2", code: "VISA", name: "Visa", category: "Travel" },
      ];
      mockDocTypeFindMany.mockResolvedValue(docTypes);

      const result = await listDocumentTypes();

      expect(result).toHaveLength(2);
      expect(mockDocTypeFindMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
    });

    it("filters by isActive", async () => {
      const { listDocumentTypes } = await import("../reference-data.server");
      mockDocTypeFindMany.mockResolvedValue([]);

      await listDocumentTypes({ isActive: true });

      expect(mockDocTypeFindMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
    });

    it("filters by search including category", async () => {
      const { listDocumentTypes } = await import("../reference-data.server");
      mockDocTypeFindMany.mockResolvedValue([]);

      await listDocumentTypes({ search: "identity" });

      expect(mockDocTypeFindMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: "identity", mode: "insensitive" } },
            { code: { contains: "identity", mode: "insensitive" } },
            { category: { contains: "identity", mode: "insensitive" } },
          ],
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
    });
  });

  describe("listDocumentTypesPaginated", () => {
    it("returns paginated document types", async () => {
      const { listDocumentTypesPaginated } = await import("../reference-data.server");
      mockDocTypeFindMany.mockResolvedValue([{ id: "dt-1", code: "PASSPORT", name: "Passport" }]);
      mockDocTypeCount.mockResolvedValue(8);

      const result = await listDocumentTypesPaginated({ page: 1, pageSize: 10 });

      expect(result).toEqual({
        items: [{ id: "dt-1", code: "PASSPORT", name: "Passport" }],
        totalCount: 8,
      });
    });

    it("uses default orderBy when none provided", async () => {
      const { listDocumentTypesPaginated } = await import("../reference-data.server");
      mockDocTypeFindMany.mockResolvedValue([]);
      mockDocTypeCount.mockResolvedValue(0);

      await listDocumentTypesPaginated({ page: 1, pageSize: 5 });

      expect(mockDocTypeFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        }),
      );
    });
  });

  describe("getDocumentType", () => {
    it("returns a document type by id", async () => {
      const { getDocumentType } = await import("../reference-data.server");
      const docType = { id: "dt-1", code: "PASSPORT", name: "Passport" };
      mockDocTypeFindFirst.mockResolvedValue(docType);

      const result = await getDocumentType("dt-1");

      expect(result).toEqual(docType);
    });

    it("throws when document type not found", async () => {
      const { getDocumentType, ReferenceDataError } = await import("../reference-data.server");
      mockDocTypeFindFirst.mockResolvedValue(null);

      await expect(getDocumentType("nonexistent")).rejects.toThrow(ReferenceDataError);
      await expect(getDocumentType("nonexistent")).rejects.toThrow("Document type not found");
    });
  });

  describe("createDocumentType", () => {
    it("creates a document type with uppercased code and audit", async () => {
      const { createDocumentType } = await import("../reference-data.server");
      const created = { id: "dt-1", code: "DL", name: "Driving License" };
      mockDocTypeCreate.mockResolvedValue(created);

      const result = await createDocumentType(
        { code: "dl", name: "Driving License", description: "A driver permit", category: "Identity", sortOrder: 3, isActive: true },
        ctx,
      );

      expect(result.id).toBe("dt-1");
      expect(mockDocTypeCreate).toHaveBeenCalledWith({
        data: {
          code: "DL",
          name: "Driving License",
          description: "A driver permit",
          category: "Identity",
          sortOrder: 3,
          isActive: true,
        },
      });
      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "CREATE",
          entityType: "DocumentType",
        }),
      });
    });

    it("sets description and category to null when empty", async () => {
      const { createDocumentType } = await import("../reference-data.server");
      mockDocTypeCreate.mockResolvedValue({ id: "dt-1", code: "OTHER", name: "Other" });

      await createDocumentType(
        { code: "OTHER", name: "Other", description: "", category: "", sortOrder: 0, isActive: true },
        ctx,
      );

      expect(mockDocTypeCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          description: null,
          category: null,
        }),
      });
    });

    it("throws 409 on duplicate code", async () => {
      const { createDocumentType, ReferenceDataError } = await import("../reference-data.server");
      mockDocTypeCreate.mockRejectedValue(makePrismaUniqueError());

      await expect(
        createDocumentType(
          { code: "PASSPORT", name: "Passport", description: "", category: "", sortOrder: 0, isActive: true },
          ctx,
        ),
      ).rejects.toThrow(ReferenceDataError);

      await expect(
        createDocumentType(
          { code: "PASSPORT", name: "Passport", description: "", category: "", sortOrder: 0, isActive: true },
          ctx,
        ),
      ).rejects.toThrow("A document type with this code already exists");
    });

    it("rethrows non-P2002 errors", async () => {
      const { createDocumentType } = await import("../reference-data.server");
      mockDocTypeCreate.mockRejectedValue(new Error("Network error"));

      await expect(
        createDocumentType(
          { code: "X", name: "X", description: "", category: "", sortOrder: 0, isActive: true },
          ctx,
        ),
      ).rejects.toThrow("Network error");
    });
  });

  describe("updateDocumentType", () => {
    it("updates an existing document type", async () => {
      const { updateDocumentType } = await import("../reference-data.server");
      mockDocTypeFindFirst.mockResolvedValue({ id: "dt-1", code: "PASSPORT", name: "Passport" });
      mockDocTypeUpdate.mockResolvedValue({ id: "dt-1", code: "PASSPORT", name: "International Passport" });

      const result = await updateDocumentType(
        "dt-1",
        { code: "passport", name: "International Passport", description: "Updated", category: "Travel", sortOrder: 1, isActive: true },
        ctx,
      );

      expect(result.name).toBe("International Passport");
      expect(mockDocTypeUpdate).toHaveBeenCalledWith({
        where: { id: "dt-1" },
        data: expect.objectContaining({
          code: "PASSPORT",
          name: "International Passport",
          description: "Updated",
          category: "Travel",
        }),
      });
      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "UPDATE",
          entityType: "DocumentType",
        }),
      });
    });

    it("throws 404 when document type not found", async () => {
      const { updateDocumentType, ReferenceDataError } = await import("../reference-data.server");
      mockDocTypeFindFirst.mockResolvedValue(null);

      await expect(
        updateDocumentType(
          "nonexistent",
          { code: "X", name: "X", description: "", category: "", sortOrder: 0, isActive: true },
          ctx,
        ),
      ).rejects.toThrow(ReferenceDataError);
    });

    it("throws 409 on duplicate code during update", async () => {
      const { updateDocumentType, ReferenceDataError } = await import("../reference-data.server");
      mockDocTypeFindFirst.mockResolvedValue({ id: "dt-1", code: "PASSPORT", name: "Passport" });
      mockDocTypeUpdate.mockRejectedValue(makePrismaUniqueError());

      await expect(
        updateDocumentType(
          "dt-1",
          { code: "VISA", name: "Visa", description: "", category: "", sortOrder: 0, isActive: true },
          ctx,
        ),
      ).rejects.toThrow(ReferenceDataError);
    });
  });

  describe("deleteDocumentType", () => {
    it("deletes a document type and writes audit", async () => {
      const { deleteDocumentType } = await import("../reference-data.server");
      mockDocTypeFindFirst.mockResolvedValue({ id: "dt-1", code: "PASSPORT", name: "Passport" });
      mockDocTypeDelete.mockResolvedValue({});

      await deleteDocumentType("dt-1", ctx);

      expect(mockDocTypeDelete).toHaveBeenCalledWith({ where: { id: "dt-1" } });
      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "DELETE",
          entityType: "DocumentType",
          entityId: "dt-1",
        }),
      });
    });

    it("throws 404 when document type not found", async () => {
      const { deleteDocumentType, ReferenceDataError } = await import("../reference-data.server");
      mockDocTypeFindFirst.mockResolvedValue(null);

      await expect(deleteDocumentType("nonexistent", ctx)).rejects.toThrow(ReferenceDataError);
      await expect(deleteDocumentType("nonexistent", ctx)).rejects.toThrow(
        "Document type not found",
      );
    });
  });

  // ─────────────────────────────────────────────────────
  // getReferenceDataCounts
  // ─────────────────────────────────────────────────────

  describe("getReferenceDataCounts", () => {
    it("returns counts for all entity types", async () => {
      const { getReferenceDataCounts } = await import("../reference-data.server");
      mockCountryCount.mockResolvedValue(195);
      mockTitleCount.mockResolvedValue(6);
      mockLanguageCount.mockResolvedValue(30);
      mockCurrencyCount.mockResolvedValue(150);
      mockDocTypeCount.mockResolvedValue(12);

      const result = await getReferenceDataCounts();

      expect(result).toEqual({
        countries: 195,
        titles: 6,
        languages: 30,
        currencies: 150,
        documentTypes: 12,
      });
    });

    it("returns zeros when tables are empty", async () => {
      const { getReferenceDataCounts } = await import("../reference-data.server");
      mockCountryCount.mockResolvedValue(0);
      mockTitleCount.mockResolvedValue(0);
      mockLanguageCount.mockResolvedValue(0);
      mockCurrencyCount.mockResolvedValue(0);
      mockDocTypeCount.mockResolvedValue(0);

      const result = await getReferenceDataCounts();

      expect(result).toEqual({
        countries: 0,
        titles: 0,
        languages: 0,
        currencies: 0,
        documentTypes: 0,
      });
    });
  });

  // ─────────────────────────────────────────────────────
  // ReferenceDataError
  // ─────────────────────────────────────────────────────

  describe("ReferenceDataError", () => {
    it("extends ServiceError with name and status", async () => {
      const { ReferenceDataError } = await import("../reference-data.server");

      const error = new ReferenceDataError("test error", 422);

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("ReferenceDataError");
      expect(error.message).toBe("test error");
      expect(error.status).toBe(422);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock functions for each Prisma method ────────────────
const mockTemplateFindMany = vi.fn();
const mockTemplateFindFirst = vi.fn();
const mockTemplateCount = vi.fn();
const mockTemplateCreate = vi.fn();
const mockTemplateUpdate = vi.fn();
const mockAuditLogCreate = vi.fn();
const mockFieldDefFindMany = vi.fn();

vi.mock("~/lib/db/db.server", () => ({
  prisma: {
    sectionTemplate: {
      findMany: (...args: unknown[]) => mockTemplateFindMany(...args),
      findFirst: (...args: unknown[]) => mockTemplateFindFirst(...args),
      count: (...args: unknown[]) => mockTemplateCount(...args),
      create: (...args: unknown[]) => mockTemplateCreate(...args),
      update: (...args: unknown[]) => mockTemplateUpdate(...args),
    },
    fieldDefinition: {
      findMany: (...args: unknown[]) => mockFieldDefFindMany(...args),
    },
    auditLog: {
      create: (...args: unknown[]) => mockAuditLogCreate(...args),
    },
  },
}));

vi.mock("~/lib/monitoring/logger.server", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("~/lib/fields", () => ({
  collectFieldDefIds: vi.fn(),
  buildFieldSchema: vi.fn(),
}));

vi.mock("~/lib/fields.server", () => ({
  parseExtrasFormData: vi.fn(),
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

const sampleTemplate = {
  id: "tpl-1",
  tenantId,
  name: "Employee Onboarding",
  description: "Collects new hire information",
  entityType: "User",
  status: "DRAFT",
  isActive: true,
  definition: {},
  publishedAt: null,
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  updatedAt: new Date("2025-01-01T00:00:00.000Z"),
};

const templateWithFields = {
  ...sampleTemplate,
  definition: {
    pages: [
      {
        id: "page-1",
        title: "Page 1",
        sections: [
          {
            id: "sec-1",
            title: "Personal Info",
            fields: [
              { fieldDefinitionId: "fd-1", column: 1 },
              { fieldDefinitionId: "fd-2", column: 1 },
            ],
          },
        ],
      },
    ],
  },
};

describe("section-templates.server", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ═══════════════════════════════════════════════════════════
  // listSectionTemplatesPaginated
  // ═══════════════════════════════════════════════════════════
  describe("listSectionTemplatesPaginated", () => {
    it("returns paginated items and totalCount", async () => {
      const { listSectionTemplatesPaginated } = await import("../section-templates.server");
      mockTemplateFindMany.mockResolvedValue([sampleTemplate]);
      mockTemplateCount.mockResolvedValue(15);

      const result = await listSectionTemplatesPaginated(tenantId, {
        page: 1,
        pageSize: 10,
      });

      expect(result).toEqual({ items: [sampleTemplate], totalCount: 15 });
      expect(mockTemplateFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId, isActive: true }),
          skip: 0,
          take: 10,
        }),
      );
    });

    it("calculates correct offset for page 2", async () => {
      const { listSectionTemplatesPaginated } = await import("../section-templates.server");
      mockTemplateFindMany.mockResolvedValue([]);
      mockTemplateCount.mockResolvedValue(0);

      await listSectionTemplatesPaginated(tenantId, { page: 2, pageSize: 25 });

      expect(mockTemplateFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 25, take: 25 }),
      );
    });

    it("defaults orderBy to name asc", async () => {
      const { listSectionTemplatesPaginated } = await import("../section-templates.server");
      mockTemplateFindMany.mockResolvedValue([]);
      mockTemplateCount.mockResolvedValue(0);

      await listSectionTemplatesPaginated(tenantId, { page: 1, pageSize: 10 });

      expect(mockTemplateFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { name: "asc" } }),
      );
    });

    it("uses custom orderBy when provided", async () => {
      const { listSectionTemplatesPaginated } = await import("../section-templates.server");
      mockTemplateFindMany.mockResolvedValue([]);
      mockTemplateCount.mockResolvedValue(0);

      await listSectionTemplatesPaginated(tenantId, {
        page: 1,
        pageSize: 10,
        orderBy: [{ createdAt: "desc" }],
      });

      expect(mockTemplateFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: [{ createdAt: "desc" }] }),
      );
    });

    it("merges options.where into the query", async () => {
      const { listSectionTemplatesPaginated } = await import("../section-templates.server");
      mockTemplateFindMany.mockResolvedValue([]);
      mockTemplateCount.mockResolvedValue(0);

      await listSectionTemplatesPaginated(tenantId, {
        page: 1,
        pageSize: 10,
        where: { entityType: "User" },
      });

      expect(mockTemplateFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId, isActive: true, entityType: "User" }),
        }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════
  // getSectionTemplate
  // ═══════════════════════════════════════════════════════════
  describe("getSectionTemplate", () => {
    it("returns the template when found", async () => {
      const { getSectionTemplate } = await import("../section-templates.server");
      mockTemplateFindFirst.mockResolvedValue(sampleTemplate);

      const result = await getSectionTemplate("tpl-1", tenantId);

      expect(result).toEqual(sampleTemplate);
      expect(mockTemplateFindFirst).toHaveBeenCalledWith({
        where: { id: "tpl-1", tenantId, isActive: true },
      });
    });

    it("throws SectionTemplateError when not found", async () => {
      const { getSectionTemplate, SectionTemplateError } = await import(
        "../section-templates.server"
      );
      mockTemplateFindFirst.mockResolvedValue(null);

      await expect(getSectionTemplate("nonexistent", tenantId)).rejects.toThrow(
        SectionTemplateError,
      );
      await expect(getSectionTemplate("nonexistent", tenantId)).rejects.toThrow(
        "Form template not found",
      );
    });
  });

  // ═══════════════════════════════════════════════════════════
  // createSectionTemplate
  // ═══════════════════════════════════════════════════════════
  describe("createSectionTemplate", () => {
    const createInput = {
      name: "  Employee Onboarding  ",
      description: "Collects new hire information",
      entityType: "User" as const,
    };

    it("creates a template with trimmed name and empty definition", async () => {
      const { createSectionTemplate } = await import("../section-templates.server");

      const createdTemplate = {
        ...sampleTemplate,
        id: "tpl-new",
        name: "Employee Onboarding",
      };
      mockTemplateCreate.mockResolvedValue(createdTemplate);
      mockAuditLogCreate.mockResolvedValue({});

      const result = await createSectionTemplate(createInput, ctx);

      expect(result.id).toBe("tpl-new");
      expect(mockTemplateCreate).toHaveBeenCalledWith({
        data: {
          tenantId,
          name: "Employee Onboarding",
          description: "Collects new hire information",
          entityType: "User",
          definition: {},
        },
      });
    });

    it("defaults entityType to Generic when not provided", async () => {
      const { createSectionTemplate } = await import("../section-templates.server");

      mockTemplateCreate.mockResolvedValue({ id: "tpl-new", name: "Test" });
      mockAuditLogCreate.mockResolvedValue({});

      await createSectionTemplate({ name: "Test", entityType: undefined }, ctx);

      expect(mockTemplateCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ entityType: "Generic" }),
      });
    });

    it("sets description to null when empty", async () => {
      const { createSectionTemplate } = await import("../section-templates.server");

      mockTemplateCreate.mockResolvedValue({ id: "tpl-new", name: "Test" });
      mockAuditLogCreate.mockResolvedValue({});

      await createSectionTemplate({ name: "Test", description: "" }, ctx);

      expect(mockTemplateCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ description: null }),
      });
    });

    it("throws SectionTemplateError on duplicate name (P2002)", async () => {
      const { createSectionTemplate, SectionTemplateError } = await import(
        "../section-templates.server"
      );

      const prismaError = new Error("Unique constraint failed");
      (prismaError as any).code = "P2002";
      mockTemplateCreate.mockRejectedValue(prismaError);

      await expect(createSectionTemplate(createInput, ctx)).rejects.toThrow(SectionTemplateError);
      await expect(createSectionTemplate(createInput, ctx)).rejects.toThrow(
        "A form template with this name already exists",
      );
    });

    it("re-throws non-P2002 errors", async () => {
      const { createSectionTemplate } = await import("../section-templates.server");

      const genericError = new Error("Connection lost");
      mockTemplateCreate.mockRejectedValue(genericError);

      await expect(createSectionTemplate(createInput, ctx)).rejects.toThrow("Connection lost");
    });

    it("creates an audit log entry", async () => {
      const { createSectionTemplate } = await import("../section-templates.server");

      mockTemplateCreate.mockResolvedValue({ id: "tpl-new", name: "Employee Onboarding" });
      mockAuditLogCreate.mockResolvedValue({});

      await createSectionTemplate(createInput, ctx);

      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          userId,
          action: "CREATE",
          entityType: "SectionTemplate",
          entityId: "tpl-new",
          description: 'Created form template "Employee Onboarding"',
          ipAddress: "127.0.0.1",
          userAgent: "test-agent",
        }),
      });
    });
  });

  // ═══════════════════════════════════════════════════════════
  // updateSectionTemplate
  // ═══════════════════════════════════════════════════════════
  describe("updateSectionTemplate", () => {
    const updateInput = {
      name: "  Updated Template  ",
      description: "New description",
      entityType: "Tenant" as const,
    };

    it("updates a template successfully", async () => {
      const { updateSectionTemplate } = await import("../section-templates.server");

      mockTemplateFindFirst.mockResolvedValue(sampleTemplate);
      mockTemplateUpdate.mockResolvedValue({
        ...sampleTemplate,
        name: "Updated Template",
        description: "New description",
        entityType: "Tenant",
      });
      mockAuditLogCreate.mockResolvedValue({});

      const result = await updateSectionTemplate("tpl-1", updateInput, ctx);

      expect(result.name).toBe("Updated Template");
      expect(mockTemplateUpdate).toHaveBeenCalledWith({
        where: { id: "tpl-1" },
        data: {
          name: "Updated Template",
          description: "New description",
          entityType: "Tenant",
        },
      });
    });

    it("throws SectionTemplateError when template not found", async () => {
      const { updateSectionTemplate, SectionTemplateError } = await import(
        "../section-templates.server"
      );

      mockTemplateFindFirst.mockResolvedValue(null);

      await expect(updateSectionTemplate("nonexistent", updateInput, ctx)).rejects.toThrow(
        SectionTemplateError,
      );
      await expect(updateSectionTemplate("nonexistent", updateInput, ctx)).rejects.toThrow(
        "Form template not found",
      );
    });

    it("preserves existing entityType when not provided in input", async () => {
      const { updateSectionTemplate } = await import("../section-templates.server");

      mockTemplateFindFirst.mockResolvedValue(sampleTemplate);
      mockTemplateUpdate.mockResolvedValue({ ...sampleTemplate, name: "New Name" });
      mockAuditLogCreate.mockResolvedValue({});

      await updateSectionTemplate(
        "tpl-1",
        { name: "New Name", entityType: undefined },
        ctx,
      );

      expect(mockTemplateUpdate).toHaveBeenCalledWith({
        where: { id: "tpl-1" },
        data: expect.objectContaining({ entityType: sampleTemplate.entityType }),
      });
    });

    it("sets description to null when empty", async () => {
      const { updateSectionTemplate } = await import("../section-templates.server");

      mockTemplateFindFirst.mockResolvedValue(sampleTemplate);
      mockTemplateUpdate.mockResolvedValue({ ...sampleTemplate, description: null });
      mockAuditLogCreate.mockResolvedValue({});

      await updateSectionTemplate("tpl-1", { name: "Test", description: "" }, ctx);

      expect(mockTemplateUpdate).toHaveBeenCalledWith({
        where: { id: "tpl-1" },
        data: expect.objectContaining({ description: null }),
      });
    });

    it("throws SectionTemplateError on duplicate name (P2002)", async () => {
      const { updateSectionTemplate, SectionTemplateError } = await import(
        "../section-templates.server"
      );

      mockTemplateFindFirst.mockResolvedValue(sampleTemplate);
      const prismaError = new Error("Unique constraint failed");
      (prismaError as any).code = "P2002";
      mockTemplateUpdate.mockRejectedValue(prismaError);

      await expect(updateSectionTemplate("tpl-1", updateInput, ctx)).rejects.toThrow(
        SectionTemplateError,
      );
      await expect(updateSectionTemplate("tpl-1", updateInput, ctx)).rejects.toThrow(
        "A form template with this name already exists",
      );
    });

    it("re-throws non-P2002 errors", async () => {
      const { updateSectionTemplate } = await import("../section-templates.server");

      mockTemplateFindFirst.mockResolvedValue(sampleTemplate);
      const genericError = new Error("Timeout");
      mockTemplateUpdate.mockRejectedValue(genericError);

      await expect(updateSectionTemplate("tpl-1", updateInput, ctx)).rejects.toThrow("Timeout");
    });

    it("creates an audit log entry", async () => {
      const { updateSectionTemplate } = await import("../section-templates.server");

      mockTemplateFindFirst.mockResolvedValue(sampleTemplate);
      mockTemplateUpdate.mockResolvedValue({ ...sampleTemplate, name: "Updated Template" });
      mockAuditLogCreate.mockResolvedValue({});

      await updateSectionTemplate("tpl-1", updateInput, ctx);

      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "UPDATE",
          entityType: "SectionTemplate",
          entityId: "tpl-1",
          description: 'Updated form template "Updated Template"',
        }),
      });
    });
  });

  // ═══════════════════════════════════════════════════════════
  // deleteSectionTemplate
  // ═══════════════════════════════════════════════════════════
  describe("deleteSectionTemplate", () => {
    it("soft-deletes a template by setting isActive to false", async () => {
      const { deleteSectionTemplate } = await import("../section-templates.server");

      mockTemplateFindFirst.mockResolvedValue(sampleTemplate);
      mockTemplateUpdate.mockResolvedValue({ ...sampleTemplate, isActive: false });
      mockAuditLogCreate.mockResolvedValue({});

      await deleteSectionTemplate("tpl-1", ctx);

      expect(mockTemplateUpdate).toHaveBeenCalledWith({
        where: { id: "tpl-1" },
        data: { isActive: false },
      });
    });

    it("throws SectionTemplateError when template not found", async () => {
      const { deleteSectionTemplate, SectionTemplateError } = await import(
        "../section-templates.server"
      );

      mockTemplateFindFirst.mockResolvedValue(null);

      await expect(deleteSectionTemplate("nonexistent", ctx)).rejects.toThrow(
        SectionTemplateError,
      );
      await expect(deleteSectionTemplate("nonexistent", ctx)).rejects.toThrow(
        "Form template not found",
      );
    });

    it("creates a DELETE audit log entry", async () => {
      const { deleteSectionTemplate } = await import("../section-templates.server");

      mockTemplateFindFirst.mockResolvedValue(sampleTemplate);
      mockTemplateUpdate.mockResolvedValue({});
      mockAuditLogCreate.mockResolvedValue({});

      await deleteSectionTemplate("tpl-1", ctx);

      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "DELETE",
          entityType: "SectionTemplate",
          entityId: "tpl-1",
          description: 'Deleted form template "Employee Onboarding"',
        }),
      });
    });
  });

  // ═══════════════════════════════════════════════════════════
  // publishTemplate
  // ═══════════════════════════════════════════════════════════
  describe("publishTemplate", () => {
    it("publishes a template with fields", async () => {
      const { publishTemplate } = await import("../section-templates.server");

      mockTemplateFindFirst.mockResolvedValueOnce(templateWithFields);
      mockTemplateUpdate.mockResolvedValue({
        ...templateWithFields,
        status: "PUBLISHED",
        publishedAt: new Date(),
      });
      mockAuditLogCreate.mockResolvedValue({});

      const result = await publishTemplate("tpl-1", ctx);

      expect(result.status).toBe("PUBLISHED");
      expect(mockTemplateUpdate).toHaveBeenCalledWith({
        where: { id: "tpl-1" },
        data: { status: "PUBLISHED", publishedAt: expect.any(Date) },
      });
    });

    it("throws SectionTemplateError when template not found", async () => {
      const { publishTemplate, SectionTemplateError } = await import(
        "../section-templates.server"
      );

      mockTemplateFindFirst.mockResolvedValue(null);

      await expect(publishTemplate("nonexistent", ctx)).rejects.toThrow(SectionTemplateError);
      await expect(publishTemplate("nonexistent", ctx)).rejects.toThrow(
        "Form template not found",
      );
    });

    it("throws SectionTemplateError when template has no fields", async () => {
      const { publishTemplate, SectionTemplateError } = await import(
        "../section-templates.server"
      );

      const emptyTemplate = {
        ...sampleTemplate,
        definition: { pages: [{ id: "p1", title: "P1", sections: [{ id: "s1", title: "S1", fields: [] }] }] },
      };
      mockTemplateFindFirst.mockResolvedValue(emptyTemplate);

      await expect(publishTemplate("tpl-1", ctx)).rejects.toThrow(SectionTemplateError);
      await expect(publishTemplate("tpl-1", ctx)).rejects.toThrow(
        "Cannot publish a form with no fields",
      );
    });

    it("throws SectionTemplateError when template definition is empty object", async () => {
      const { publishTemplate, SectionTemplateError } = await import(
        "../section-templates.server"
      );

      mockTemplateFindFirst.mockResolvedValue(sampleTemplate); // definition is {}

      await expect(publishTemplate("tpl-1", ctx)).rejects.toThrow(SectionTemplateError);
      await expect(publishTemplate("tpl-1", ctx)).rejects.toThrow(
        "Cannot publish a form with no fields",
      );
    });

    it("throws when another template is already published for same entity type", async () => {
      const { publishTemplate, SectionTemplateError } = await import(
        "../section-templates.server"
      );

      mockTemplateFindFirst
        .mockResolvedValueOnce(templateWithFields) // the template to publish
        .mockResolvedValueOnce({ id: "tpl-other", name: "Other Template" }); // existing published

      const error = await publishTemplate("tpl-1", ctx).catch((e) => e);
      expect(error).toBeInstanceOf(SectionTemplateError);
      expect(error.message).toMatch("already published");
    });

    it("allows publishing Generic template even if another Generic is published", async () => {
      const { publishTemplate } = await import("../section-templates.server");

      const genericTemplate = {
        ...templateWithFields,
        entityType: "Generic",
      };
      mockTemplateFindFirst.mockResolvedValueOnce(genericTemplate);
      // For Generic entityType, the duplicate check is skipped
      mockTemplateUpdate.mockResolvedValue({
        ...genericTemplate,
        status: "PUBLISHED",
        publishedAt: new Date(),
      });
      mockAuditLogCreate.mockResolvedValue({});

      const result = await publishTemplate("tpl-1", ctx);

      expect(result.status).toBe("PUBLISHED");
      // Should NOT have a second findFirst call for duplicate check
      expect(mockTemplateFindFirst).toHaveBeenCalledTimes(1);
    });

    it("creates an audit log entry when publishing", async () => {
      const { publishTemplate } = await import("../section-templates.server");

      mockTemplateFindFirst.mockResolvedValueOnce(templateWithFields);
      mockTemplateUpdate.mockResolvedValue({
        ...templateWithFields,
        status: "PUBLISHED",
      });
      mockAuditLogCreate.mockResolvedValue({});

      await publishTemplate("tpl-1", ctx);

      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "UPDATE",
          entityType: "SectionTemplate",
          entityId: "tpl-1",
          description: 'Published form template "Employee Onboarding"',
        }),
      });
    });
  });

  // ═══════════════════════════════════════════════════════════
  // unpublishTemplate
  // ═══════════════════════════════════════════════════════════
  describe("unpublishTemplate", () => {
    it("unpublishes a template by setting status to DRAFT", async () => {
      const { unpublishTemplate } = await import("../section-templates.server");

      const publishedTemplate = { ...sampleTemplate, status: "PUBLISHED" };
      mockTemplateFindFirst.mockResolvedValue(publishedTemplate);
      mockTemplateUpdate.mockResolvedValue({
        ...publishedTemplate,
        status: "DRAFT",
        publishedAt: null,
      });
      mockAuditLogCreate.mockResolvedValue({});

      const result = await unpublishTemplate("tpl-1", ctx);

      expect(result.status).toBe("DRAFT");
      expect(result.publishedAt).toBeNull();
      expect(mockTemplateUpdate).toHaveBeenCalledWith({
        where: { id: "tpl-1" },
        data: { status: "DRAFT", publishedAt: null },
      });
    });

    it("throws SectionTemplateError when template not found", async () => {
      const { unpublishTemplate, SectionTemplateError } = await import(
        "../section-templates.server"
      );

      mockTemplateFindFirst.mockResolvedValue(null);

      await expect(unpublishTemplate("nonexistent", ctx)).rejects.toThrow(SectionTemplateError);
      await expect(unpublishTemplate("nonexistent", ctx)).rejects.toThrow(
        "Form template not found",
      );
    });

    it("creates an audit log entry when unpublishing", async () => {
      const { unpublishTemplate } = await import("../section-templates.server");

      mockTemplateFindFirst.mockResolvedValue(sampleTemplate);
      mockTemplateUpdate.mockResolvedValue({ ...sampleTemplate, status: "DRAFT" });
      mockAuditLogCreate.mockResolvedValue({});

      await unpublishTemplate("tpl-1", ctx);

      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "UPDATE",
          entityType: "SectionTemplate",
          entityId: "tpl-1",
          description: 'Unpublished form template "Employee Onboarding"',
        }),
      });
    });
  });

  // ═══════════════════════════════════════════════════════════
  // getPublishedTemplateForEntity
  // ═══════════════════════════════════════════════════════════
  describe("getPublishedTemplateForEntity", () => {
    it("returns published template for entity type", async () => {
      const { getPublishedTemplateForEntity } = await import("../section-templates.server");

      const published = { ...sampleTemplate, status: "PUBLISHED" };
      mockTemplateFindFirst.mockResolvedValue(published);

      const result = await getPublishedTemplateForEntity(tenantId, "User");

      expect(result).toEqual(published);
      expect(mockTemplateFindFirst).toHaveBeenCalledWith({
        where: { tenantId, entityType: "User", status: "PUBLISHED", isActive: true },
      });
    });

    it("returns null when no published template exists", async () => {
      const { getPublishedTemplateForEntity } = await import("../section-templates.server");

      mockTemplateFindFirst.mockResolvedValue(null);

      const result = await getPublishedTemplateForEntity(tenantId, "Tenant");

      expect(result).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // loadExtrasForEntity
  // ═══════════════════════════════════════════════════════════
  describe("loadExtrasForEntity", () => {
    it("returns null definition and empty fields when no published template", async () => {
      const { loadExtrasForEntity } = await import("../section-templates.server");

      mockTemplateFindFirst.mockResolvedValue(null);

      const result = await loadExtrasForEntity(tenantId, "User");

      expect(result).toEqual({ extrasDefinition: null, extrasFieldDefs: [] });
    });

    it("returns null definition when definition has no pages", async () => {
      const { loadExtrasForEntity } = await import("../section-templates.server");

      mockTemplateFindFirst.mockResolvedValue({
        ...sampleTemplate,
        status: "PUBLISHED",
        definition: {},
      });

      const result = await loadExtrasForEntity(tenantId, "User");

      expect(result).toEqual({ extrasDefinition: null, extrasFieldDefs: [] });
    });

    it("returns null definition when pages array is empty", async () => {
      const { loadExtrasForEntity } = await import("../section-templates.server");

      mockTemplateFindFirst.mockResolvedValue({
        ...sampleTemplate,
        status: "PUBLISHED",
        definition: { pages: [] },
      });

      const result = await loadExtrasForEntity(tenantId, "User");

      expect(result).toEqual({ extrasDefinition: null, extrasFieldDefs: [] });
    });

    it("returns definition with empty fields when no fieldDefIds found", async () => {
      const { loadExtrasForEntity } = await import("../section-templates.server");
      const { collectFieldDefIds } = await import("~/lib/fields");

      const def = {
        pages: [{ id: "p1", title: "P1", sections: [{ id: "s1", title: "S1", fields: [] }] }],
      };
      mockTemplateFindFirst.mockResolvedValue({
        ...sampleTemplate,
        status: "PUBLISHED",
        definition: def,
      });
      vi.mocked(collectFieldDefIds).mockReturnValue([]);

      const result = await loadExtrasForEntity(tenantId, "User");

      expect(result).toEqual({ extrasDefinition: def, extrasFieldDefs: [] });
    });

    it("returns definition and mapped field defs when fields exist", async () => {
      const { loadExtrasForEntity } = await import("../section-templates.server");
      const { collectFieldDefIds } = await import("~/lib/fields");

      const def = templateWithFields.definition;
      mockTemplateFindFirst.mockResolvedValue({
        ...sampleTemplate,
        status: "PUBLISHED",
        definition: def,
      });
      vi.mocked(collectFieldDefIds).mockReturnValue(["fd-1", "fd-2"]);

      const fieldDefs = [
        {
          id: "fd-1",
          name: "first_name",
          label: "First Name",
          dataType: "TEXT",
          isRequired: true,
          config: {},
        },
        {
          id: "fd-2",
          name: "age",
          label: "Age",
          dataType: "NUMBER",
          isRequired: false,
          config: {},
        },
      ];
      mockFieldDefFindMany.mockResolvedValue(fieldDefs);

      const result = await loadExtrasForEntity(tenantId, "User");

      expect(result.extrasDefinition).toEqual(def);
      expect(result.extrasFieldDefs).toEqual([
        { id: "fd-1", name: "first_name", label: "First Name", dataType: "TEXT", isRequired: true, config: {} },
        { id: "fd-2", name: "age", label: "Age", dataType: "NUMBER", isRequired: false, config: {} },
      ]);
      expect(mockFieldDefFindMany).toHaveBeenCalledWith({
        where: { id: { in: ["fd-1", "fd-2"] }, tenantId },
        select: { id: true, name: true, label: true, dataType: true, isRequired: true, config: true },
      });
    });
  });

  // ═══════════════════════════════════════════════════════════
  // parseExtrasForEntity
  // ═══════════════════════════════════════════════════════════
  describe("parseExtrasForEntity", () => {
    it("returns null when no published template exists", async () => {
      const { parseExtrasForEntity } = await import("../section-templates.server");

      mockTemplateFindFirst.mockResolvedValue(null);

      const formData = new FormData();
      const result = await parseExtrasForEntity(tenantId, "User", formData);

      expect(result).toBeNull();
    });

    it("returns null when definition has no pages", async () => {
      const { parseExtrasForEntity } = await import("../section-templates.server");

      mockTemplateFindFirst.mockResolvedValue({
        ...sampleTemplate,
        status: "PUBLISHED",
        definition: {},
      });

      const formData = new FormData();
      const result = await parseExtrasForEntity(tenantId, "User", formData);

      expect(result).toBeNull();
    });

    it("returns null when no field def IDs are collected", async () => {
      const { parseExtrasForEntity } = await import("../section-templates.server");
      const { collectFieldDefIds } = await import("~/lib/fields");

      mockTemplateFindFirst.mockResolvedValue({
        ...sampleTemplate,
        status: "PUBLISHED",
        definition: {
          pages: [{ id: "p1", title: "P1", sections: [{ id: "s1", title: "S1", fields: [] }] }],
        },
      });
      vi.mocked(collectFieldDefIds).mockReturnValue([]);

      const formData = new FormData();
      const result = await parseExtrasForEntity(tenantId, "User", formData);

      expect(result).toBeNull();
    });

    it("returns extras on successful validation", async () => {
      const { parseExtrasForEntity } = await import("../section-templates.server");
      const { collectFieldDefIds, buildFieldSchema } = await import("~/lib/fields");
      const { parseExtrasFormData } = await import("~/lib/fields.server");

      mockTemplateFindFirst.mockResolvedValue({
        ...sampleTemplate,
        status: "PUBLISHED",
        definition: templateWithFields.definition,
      });
      vi.mocked(collectFieldDefIds).mockReturnValue(["fd-1"]);

      const fieldDefs = [
        { id: "fd-1", name: "first_name", label: "First Name", dataType: "TEXT", isRequired: false },
      ];
      mockFieldDefFindMany.mockResolvedValue(fieldDefs);

      const parsedData = { first_name: "John" };
      vi.mocked(parseExtrasFormData).mockReturnValue(parsedData);

      const mockSchema = { safeParse: vi.fn().mockReturnValue({ success: true, data: parsedData }) };
      vi.mocked(buildFieldSchema).mockReturnValue(mockSchema as any);

      const formData = new FormData();
      formData.append("extras.first_name", "John");

      const result = await parseExtrasForEntity(tenantId, "User", formData);

      expect(result).toEqual({ extras: { first_name: "John" } });
    });

    it("returns extrasErrors on validation failure", async () => {
      const { parseExtrasForEntity } = await import("../section-templates.server");
      const { collectFieldDefIds, buildFieldSchema } = await import("~/lib/fields");
      const { parseExtrasFormData } = await import("~/lib/fields.server");

      mockTemplateFindFirst.mockResolvedValue({
        ...sampleTemplate,
        status: "PUBLISHED",
        definition: templateWithFields.definition,
      });
      vi.mocked(collectFieldDefIds).mockReturnValue(["fd-1"]);

      const fieldDefs = [
        { id: "fd-1", name: "email", label: "Email", dataType: "EMAIL", isRequired: true },
      ];
      mockFieldDefFindMany.mockResolvedValue(fieldDefs);

      vi.mocked(parseExtrasFormData).mockReturnValue({ email: "not-an-email" });

      const mockSchema = {
        safeParse: vi.fn().mockReturnValue({
          success: false,
          error: {
            issues: [
              { path: ["email"], message: "Invalid email" },
              { path: ["email"], message: "Email is required" },
            ],
          },
        }),
      };
      vi.mocked(buildFieldSchema).mockReturnValue(mockSchema as any);

      const formData = new FormData();
      const result = await parseExtrasForEntity(tenantId, "User", formData);

      expect(result).toEqual({
        extrasErrors: { email: ["Invalid email", "Email is required"] },
      });
    });

    it("uses custom prefix when provided", async () => {
      const { parseExtrasForEntity } = await import("../section-templates.server");
      const { collectFieldDefIds, buildFieldSchema } = await import("~/lib/fields");
      const { parseExtrasFormData } = await import("~/lib/fields.server");

      mockTemplateFindFirst.mockResolvedValue({
        ...sampleTemplate,
        status: "PUBLISHED",
        definition: templateWithFields.definition,
      });
      vi.mocked(collectFieldDefIds).mockReturnValue(["fd-1"]);
      mockFieldDefFindMany.mockResolvedValue([]);

      vi.mocked(parseExtrasFormData).mockReturnValue({});
      const mockSchema = { safeParse: vi.fn().mockReturnValue({ success: true, data: {} }) };
      vi.mocked(buildFieldSchema).mockReturnValue(mockSchema as any);

      const formData = new FormData();
      await parseExtrasForEntity(tenantId, "User", formData, "custom_prefix");

      expect(parseExtrasFormData).toHaveBeenCalledWith(formData, [], "custom_prefix");
    });
  });

  // ═══════════════════════════════════════════════════════════
  // SectionTemplateError
  // ═══════════════════════════════════════════════════════════
  describe("SectionTemplateError", () => {
    it("extends ServiceError with correct properties", async () => {
      const { SectionTemplateError } = await import("../section-templates.server");
      const { ServiceError } = await import("~/lib/errors/service-error.server");

      const err = new SectionTemplateError("Something failed", "CUSTOM_CODE", 422);

      expect(err).toBeInstanceOf(ServiceError);
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe("SectionTemplateError");
      expect(err.message).toBe("Something failed");
      expect(err.code).toBe("CUSTOM_CODE");
      expect(err.status).toBe(422);
    });

    it("uses default code and status", async () => {
      const { SectionTemplateError } = await import("../section-templates.server");

      const err = new SectionTemplateError("Default error");

      expect(err.code).toBe("SECTION_TEMPLATE_ERROR");
      expect(err.status).toBe(400);
    });
  });
});

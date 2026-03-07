import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTemplateCreate = vi.fn();
const mockTemplateUpdate = vi.fn();
const mockTemplateDelete = vi.fn();
const mockTemplateFindFirst = vi.fn();
const mockTemplateFindMany = vi.fn();
const mockTemplateCount = vi.fn();
const mockAuditLogCreate = vi.fn();

vi.mock("~/utils/db/db.server", () => ({
  prisma: {
    messageTemplate: {
      create: (...args: unknown[]) => mockTemplateCreate(...args),
      update: (...args: unknown[]) => mockTemplateUpdate(...args),
      delete: (...args: unknown[]) => mockTemplateDelete(...args),
      findFirst: (...args: unknown[]) => mockTemplateFindFirst(...args),
      findMany: (...args: unknown[]) => mockTemplateFindMany(...args),
      count: (...args: unknown[]) => mockTemplateCount(...args),
    },
    auditLog: {
      create: (...args: unknown[]) => mockAuditLogCreate(...args),
    },
  },
}));

vi.mock("~/utils/monitoring/logger.server", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const tenantId = "tenant-1";
const userId = "user-1";
const ctx = {
  userId,
  tenantId,
  ipAddress: "127.0.0.1",
  userAgent: "test-agent",
};

const baseTemplate = {
  id: "tpl-1",
  tenantId,
  name: "Welcome Email",
  subject: "Welcome, {{name}}!",
  body: "Hello {{name}}, welcome to {{org}}!",
  channel: "EMAIL",
  variables: ["name", "org"],
  isSystem: false,
  createdBy: userId,
  updatedBy: null,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
};

describe("message-templates.server", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ─── createTemplate ────────────────────────────────────

  describe("createTemplate", () => {
    it("creates a template with valid input", async () => {
      const { createTemplate } = await import("~/services/message-templates.server");
      mockTemplateCreate.mockResolvedValue({ ...baseTemplate });
      mockAuditLogCreate.mockResolvedValue({});

      const result = await createTemplate(
        {
          name: "Welcome Email",
          subject: "Welcome, {{name}}!",
          body: "Hello {{name}}, welcome to {{org}}!",
          channel: "EMAIL",
          variables: ["name", "org"],
        },
        ctx,
      );

      expect(result.id).toBe("tpl-1");
      expect(result.name).toBe("Welcome Email");
      expect(mockTemplateCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          name: "Welcome Email",
          subject: "Welcome, {{name}}!",
          body: "Hello {{name}}, welcome to {{org}}!",
          channel: "EMAIL",
          variables: ["name", "org"],
          createdBy: userId,
        }),
      });
    });

    it("defaults variables to empty array when not provided", async () => {
      const { createTemplate } = await import("~/services/message-templates.server");
      mockTemplateCreate.mockResolvedValue({ ...baseTemplate, variables: [] });
      mockAuditLogCreate.mockResolvedValue({});

      await createTemplate(
        {
          name: "Simple",
          body: "Hello world",
          channel: "IN_APP",
        },
        ctx,
      );

      expect(mockTemplateCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          variables: [],
        }),
      });
    });

    it("creates an audit log entry", async () => {
      const { createTemplate } = await import("~/services/message-templates.server");
      mockTemplateCreate.mockResolvedValue({ ...baseTemplate });
      mockAuditLogCreate.mockResolvedValue({});

      await createTemplate(
        { name: "Welcome Email", body: "Hi", channel: "EMAIL" },
        ctx,
      );

      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          userId,
          action: "CREATE",
          entityType: "MessageTemplate",
          entityId: "tpl-1",
          description: expect.stringContaining("Welcome Email"),
        }),
      });
    });

    it("creates a template with SMS channel", async () => {
      const { createTemplate } = await import("~/services/message-templates.server");
      mockTemplateCreate.mockResolvedValue({ ...baseTemplate, channel: "SMS" });
      mockAuditLogCreate.mockResolvedValue({});

      const result = await createTemplate(
        { name: "SMS Alert", body: "Alert!", channel: "SMS" },
        ctx,
      );

      expect(result.channel).toBe("SMS");
    });
  });

  // ─── listTemplatesPaginated ────────────────────────────

  describe("listTemplatesPaginated", () => {
    it("returns paginated items and totalCount", async () => {
      const { listTemplatesPaginated } = await import("~/services/message-templates.server");
      mockTemplateFindMany.mockResolvedValue([baseTemplate]);
      mockTemplateCount.mockResolvedValue(1);

      const result = await listTemplatesPaginated(tenantId, {
        page: 1,
        pageSize: 20,
      });

      expect(result.items).toEqual([baseTemplate]);
      expect(result.totalCount).toBe(1);
    });

    it("applies custom where and orderBy", async () => {
      const { listTemplatesPaginated } = await import("~/services/message-templates.server");
      mockTemplateFindMany.mockResolvedValue([]);
      mockTemplateCount.mockResolvedValue(0);

      await listTemplatesPaginated(tenantId, {
        page: 2,
        pageSize: 10,
        where: { channel: "SMS" },
        orderBy: [{ name: "asc" }],
      });

      expect(mockTemplateFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId, channel: "SMS" },
          orderBy: [{ name: "asc" }],
          skip: 10,
          take: 10,
        }),
      );
    });

    it("uses default orderBy when none provided", async () => {
      const { listTemplatesPaginated } = await import("~/services/message-templates.server");
      mockTemplateFindMany.mockResolvedValue([]);
      mockTemplateCount.mockResolvedValue(0);

      await listTemplatesPaginated(tenantId, {
        page: 1,
        pageSize: 20,
      });

      expect(mockTemplateFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: "desc" },
        }),
      );
    });
  });

  // ─── listTemplates ─────────────────────────────────────

  describe("listTemplates", () => {
    it("lists templates with defaults", async () => {
      const { listTemplates } = await import("~/services/message-templates.server");
      mockTemplateFindMany.mockResolvedValue([baseTemplate]);
      mockTemplateCount.mockResolvedValue(1);

      const result = await listTemplates(tenantId);

      expect(result.templates).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.perPage).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it("filters by channel", async () => {
      const { listTemplates } = await import("~/services/message-templates.server");
      mockTemplateFindMany.mockResolvedValue([]);
      mockTemplateCount.mockResolvedValue(0);

      await listTemplates(tenantId, { channel: "SMS" });

      expect(mockTemplateFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId, channel: "SMS" }),
        }),
      );
    });

    it("filters by search term (case insensitive)", async () => {
      const { listTemplates } = await import("~/services/message-templates.server");
      mockTemplateFindMany.mockResolvedValue([]);
      mockTemplateCount.mockResolvedValue(0);

      await listTemplates(tenantId, { search: "welcome" });

      expect(mockTemplateFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId,
            name: { contains: "welcome", mode: "insensitive" },
          }),
        }),
      );
    });

    it("paginates correctly", async () => {
      const { listTemplates } = await import("~/services/message-templates.server");
      mockTemplateFindMany.mockResolvedValue([]);
      mockTemplateCount.mockResolvedValue(50);

      const result = await listTemplates(tenantId, { page: 3, perPage: 10 });

      expect(result.totalPages).toBe(5);
      expect(mockTemplateFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it("combines channel and search filters", async () => {
      const { listTemplates } = await import("~/services/message-templates.server");
      mockTemplateFindMany.mockResolvedValue([]);
      mockTemplateCount.mockResolvedValue(0);

      await listTemplates(tenantId, { channel: "EMAIL", search: "invite" });

      expect(mockTemplateFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId,
            channel: "EMAIL",
            name: { contains: "invite", mode: "insensitive" },
          }),
        }),
      );
    });
  });

  // ─── getTemplate ───────────────────────────────────────

  describe("getTemplate", () => {
    it("returns the template when found", async () => {
      const { getTemplate } = await import("~/services/message-templates.server");
      mockTemplateFindFirst.mockResolvedValue({ ...baseTemplate });

      const result = await getTemplate("tpl-1", tenantId);

      expect(result.id).toBe("tpl-1");
      expect(result.name).toBe("Welcome Email");
      expect(mockTemplateFindFirst).toHaveBeenCalledWith({
        where: { id: "tpl-1", tenantId },
      });
    });

    it("throws TemplateError when not found", async () => {
      const { getTemplate, TemplateError } = await import("~/services/message-templates.server");
      mockTemplateFindFirst.mockResolvedValue(null);

      await expect(getTemplate("nonexistent", tenantId)).rejects.toThrow(TemplateError);
      await expect(getTemplate("nonexistent", tenantId)).rejects.toThrow("Template not found");
    });
  });

  // ─── updateTemplate ────────────────────────────────────

  describe("updateTemplate", () => {
    it("updates a non-system template", async () => {
      const { updateTemplate } = await import("~/services/message-templates.server");
      mockTemplateFindFirst.mockResolvedValue({ ...baseTemplate, isSystem: false });
      const updatedTemplate = { ...baseTemplate, name: "Updated Name" };
      mockTemplateUpdate.mockResolvedValue(updatedTemplate);
      mockAuditLogCreate.mockResolvedValue({});

      const result = await updateTemplate(
        "tpl-1",
        { name: "Updated Name" },
        ctx,
      );

      expect(result.name).toBe("Updated Name");
      expect(mockTemplateUpdate).toHaveBeenCalledWith({
        where: { id: "tpl-1" },
        data: expect.objectContaining({
          name: "Updated Name",
          updatedBy: userId,
        }),
      });
    });

    it("throws TemplateError when template not found", async () => {
      const { updateTemplate, TemplateError } = await import("~/services/message-templates.server");
      mockTemplateFindFirst.mockResolvedValue(null);

      await expect(
        updateTemplate("nonexistent", { name: "New" }, ctx),
      ).rejects.toThrow(TemplateError);
    });

    it("throws TemplateError when updating a system template", async () => {
      const { updateTemplate, TemplateError } = await import("~/services/message-templates.server");
      mockTemplateFindFirst.mockResolvedValue({ ...baseTemplate, isSystem: true });

      await expect(
        updateTemplate("tpl-1", { name: "Hacked" }, ctx),
      ).rejects.toThrow("System templates cannot be modified");
    });

    it("only includes provided fields in update data", async () => {
      const { updateTemplate } = await import("~/services/message-templates.server");
      mockTemplateFindFirst.mockResolvedValue({ ...baseTemplate, isSystem: false });
      mockTemplateUpdate.mockResolvedValue({ ...baseTemplate, body: "New body" });
      mockAuditLogCreate.mockResolvedValue({});

      await updateTemplate("tpl-1", { body: "New body" }, ctx);

      const updateCall = mockTemplateUpdate.mock.calls[0][0];
      expect(updateCall.data).toHaveProperty("body", "New body");
      expect(updateCall.data).toHaveProperty("updatedBy", userId);
      // Should not include name, subject, channel, variables if not provided
      expect(updateCall.data).not.toHaveProperty("name");
      expect(updateCall.data).not.toHaveProperty("subject");
      expect(updateCall.data).not.toHaveProperty("channel");
      expect(updateCall.data).not.toHaveProperty("variables");
    });

    it("creates an audit log entry on update", async () => {
      const { updateTemplate } = await import("~/services/message-templates.server");
      mockTemplateFindFirst.mockResolvedValue({ ...baseTemplate, isSystem: false });
      mockTemplateUpdate.mockResolvedValue({ ...baseTemplate, name: "Edited" });
      mockAuditLogCreate.mockResolvedValue({});

      await updateTemplate("tpl-1", { name: "Edited" }, ctx);

      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "UPDATE",
          entityType: "MessageTemplate",
          entityId: "tpl-1",
        }),
      });
    });

    it("updates variables when provided", async () => {
      const { updateTemplate } = await import("~/services/message-templates.server");
      mockTemplateFindFirst.mockResolvedValue({ ...baseTemplate, isSystem: false });
      mockTemplateUpdate.mockResolvedValue({
        ...baseTemplate,
        variables: ["firstName", "lastName", "org"],
      });
      mockAuditLogCreate.mockResolvedValue({});

      await updateTemplate("tpl-1", { variables: ["firstName", "lastName", "org"] }, ctx);

      expect(mockTemplateUpdate).toHaveBeenCalledWith({
        where: { id: "tpl-1" },
        data: expect.objectContaining({
          variables: ["firstName", "lastName", "org"],
        }),
      });
    });
  });

  // ─── deleteTemplate ────────────────────────────────────

  describe("deleteTemplate", () => {
    it("deletes a non-system template", async () => {
      const { deleteTemplate } = await import("~/services/message-templates.server");
      mockTemplateFindFirst.mockResolvedValue({ ...baseTemplate, isSystem: false });
      mockTemplateDelete.mockResolvedValue({});
      mockAuditLogCreate.mockResolvedValue({});

      await deleteTemplate("tpl-1", ctx);

      expect(mockTemplateDelete).toHaveBeenCalledWith({ where: { id: "tpl-1" } });
    });

    it("throws TemplateError when template not found", async () => {
      const { deleteTemplate, TemplateError } = await import("~/services/message-templates.server");
      mockTemplateFindFirst.mockResolvedValue(null);

      await expect(deleteTemplate("nonexistent", ctx)).rejects.toThrow(TemplateError);
    });

    it("throws TemplateError when deleting a system template", async () => {
      const { deleteTemplate } = await import("~/services/message-templates.server");
      mockTemplateFindFirst.mockResolvedValue({ ...baseTemplate, isSystem: true });

      await expect(deleteTemplate("tpl-1", ctx)).rejects.toThrow(
        "System templates cannot be deleted",
      );
    });

    it("creates an audit log entry on delete", async () => {
      const { deleteTemplate } = await import("~/services/message-templates.server");
      mockTemplateFindFirst.mockResolvedValue({ ...baseTemplate, isSystem: false });
      mockTemplateDelete.mockResolvedValue({});
      mockAuditLogCreate.mockResolvedValue({});

      await deleteTemplate("tpl-1", ctx);

      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "DELETE",
          entityType: "MessageTemplate",
          entityId: "tpl-1",
          description: expect.stringContaining("Welcome Email"),
        }),
      });
    });
  });

  // ─── cloneTemplate ─────────────────────────────────────

  describe("cloneTemplate", () => {
    it("clones an existing template with a new name", async () => {
      const { cloneTemplate } = await import("~/services/message-templates.server");
      mockTemplateFindFirst.mockResolvedValue({ ...baseTemplate });
      mockTemplateCreate.mockResolvedValue({
        ...baseTemplate,
        id: "tpl-2",
        name: "Welcome Email (copy)",
        isSystem: false,
      });

      const result = await cloneTemplate("tpl-1", "Welcome Email (copy)", ctx);

      expect(result.id).toBe("tpl-2");
      expect(result.name).toBe("Welcome Email (copy)");
      expect(mockTemplateCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          name: "Welcome Email (copy)",
          subject: baseTemplate.subject,
          body: baseTemplate.body,
          channel: baseTemplate.channel,
          variables: baseTemplate.variables,
          isSystem: false,
          createdBy: userId,
        }),
      });
    });

    it("throws TemplateError when source template not found", async () => {
      const { cloneTemplate, TemplateError } = await import("~/services/message-templates.server");
      mockTemplateFindFirst.mockResolvedValue(null);

      await expect(cloneTemplate("nonexistent", "Copy", ctx)).rejects.toThrow(TemplateError);
    });

    it("clones a system template as a non-system copy", async () => {
      const { cloneTemplate } = await import("~/services/message-templates.server");
      mockTemplateFindFirst.mockResolvedValue({ ...baseTemplate, isSystem: true });
      mockTemplateCreate.mockResolvedValue({
        ...baseTemplate,
        id: "tpl-clone",
        name: "My Copy",
        isSystem: false,
      });

      const result = await cloneTemplate("tpl-1", "My Copy", ctx);

      expect(result.isSystem).toBe(false);
      expect(mockTemplateCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ isSystem: false }),
      });
    });
  });

  // ─── renderTemplate ────────────────────────────────────

  describe("renderTemplate", () => {
    it("replaces all variables with provided values", async () => {
      const { renderTemplate } = await import("~/services/message-templates.server");

      const result = renderTemplate("Hello {{name}}, welcome to {{org}}!", {
        name: "Alice",
        org: "Acme Corp",
      });

      expect(result).toBe("Hello Alice, welcome to Acme Corp!");
    });

    it("leaves unmatched variables as-is", async () => {
      const { renderTemplate } = await import("~/services/message-templates.server");

      const result = renderTemplate("Hello {{name}}, your code is {{code}}", {
        name: "Bob",
      });

      expect(result).toBe("Hello Bob, your code is {{code}}");
    });

    it("handles body with no variables", async () => {
      const { renderTemplate } = await import("~/services/message-templates.server");

      const result = renderTemplate("No variables here!", { name: "Test" });

      expect(result).toBe("No variables here!");
    });

    it("handles empty variables map", async () => {
      const { renderTemplate } = await import("~/services/message-templates.server");

      const result = renderTemplate("Hello {{name}}", {});

      expect(result).toBe("Hello {{name}}");
    });

    it("handles empty body string", async () => {
      const { renderTemplate } = await import("~/services/message-templates.server");

      const result = renderTemplate("", { name: "Alice" });

      expect(result).toBe("");
    });

    it("replaces multiple occurrences of the same variable", async () => {
      const { renderTemplate } = await import("~/services/message-templates.server");

      const result = renderTemplate("{{name}} said hello. Hi {{name}}!", {
        name: "Alice",
      });

      expect(result).toBe("Alice said hello. Hi Alice!");
    });

    it("handles variables with special regex characters in values", async () => {
      const { renderTemplate } = await import("~/services/message-templates.server");

      const result = renderTemplate("Price: {{amount}}", {
        amount: "$10.00 (USD)",
      });

      expect(result).toBe("Price: $10.00 (USD)");
    });
  });

  // ─── previewTemplate ──────────────────────────────────

  describe("previewTemplate", () => {
    it("previews a template with sample data", async () => {
      const { previewTemplate } = await import("~/services/message-templates.server");
      mockTemplateFindFirst.mockResolvedValue({ ...baseTemplate });

      const result = await previewTemplate("tpl-1", tenantId, {
        name: "Alice",
        org: "Acme Corp",
      });

      expect(result.subject).toBe("Welcome, Alice!");
      expect(result.body).toBe("Hello Alice, welcome to Acme Corp!");
      expect(result.variables).toEqual(["name", "org"]);
    });

    it("throws TemplateError when template not found", async () => {
      const { previewTemplate, TemplateError } = await import("~/services/message-templates.server");
      mockTemplateFindFirst.mockResolvedValue(null);

      await expect(previewTemplate("nonexistent", tenantId, {})).rejects.toThrow(TemplateError);
    });

    it("returns null subject when template has no subject", async () => {
      const { previewTemplate } = await import("~/services/message-templates.server");
      mockTemplateFindFirst.mockResolvedValue({
        ...baseTemplate,
        subject: null,
      });

      const result = await previewTemplate("tpl-1", tenantId, { name: "Alice" });

      expect(result.subject).toBeNull();
    });

    it("leaves unmatched variables in preview", async () => {
      const { previewTemplate } = await import("~/services/message-templates.server");
      mockTemplateFindFirst.mockResolvedValue({ ...baseTemplate });

      const result = await previewTemplate("tpl-1", tenantId, { name: "Alice" });

      expect(result.body).toBe("Hello Alice, welcome to {{org}}!");
    });
  });

  // ─── TemplateError ─────────────────────────────────────

  describe("TemplateError", () => {
    it("has correct default properties", async () => {
      const { TemplateError } = await import("~/services/message-templates.server");

      const error = new TemplateError("Something went wrong");

      expect(error.message).toBe("Something went wrong");
      expect(error.code).toBe("TEMPLATE_ERROR");
      expect(error.status).toBe(400);
      expect(error.name).toBe("TemplateError");
    });

    it("accepts custom code and status", async () => {
      const { TemplateError } = await import("~/services/message-templates.server");

      const error = new TemplateError("Not found", "NOT_FOUND", 404);

      expect(error.code).toBe("NOT_FOUND");
      expect(error.status).toBe(404);
    });

    it("is an instance of ServiceError", async () => {
      const { TemplateError } = await import("~/services/message-templates.server");
      const { ServiceError } = await import("~/utils/errors/service-error.server");

      const error = new TemplateError("test");

      expect(error).toBeInstanceOf(ServiceError);
    });
  });
});

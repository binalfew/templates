import { prisma } from "~/lib/db.server";
import { logger } from "~/lib/logger.server";
import type { CreateSectionTemplateInput, UpdateSectionTemplateInput } from "~/lib/schemas/section-template";
import type { PaginatedQueryOptions, TenantServiceContext } from "~/lib/types.server";
import type { FormDefinition } from "~/types/form-designer";
import type { RendererFieldDef } from "~/components/form-renderer/form-renderer";
import { collectFieldDefIds, buildFieldSchema } from "~/lib/fields";
import { parseExtrasFormData } from "~/lib/fields.server";
import { ServiceError } from "~/lib/service-error.server";

// ─── Types ────────────────────────────────────────────────

export class SectionTemplateError extends ServiceError {
  constructor(message: string, code: string = "SECTION_TEMPLATE_ERROR", status: number = 400) {
    super(message, status, code);
    this.name = "SectionTemplateError";
  }
}

// ─── Section Template CRUD ───────────────────────────────

export async function listSectionTemplatesPaginated(
  tenantId: string,
  options: PaginatedQueryOptions,
) {
  const where = { tenantId, isActive: true, ...(options.where ?? {}) } as any;
  const orderBy = options.orderBy?.length ? (options.orderBy as any) : { name: "asc" };

  const [items, totalCount] = await Promise.all([
    prisma.sectionTemplate.findMany({
      where,
      orderBy,
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
    }),
    prisma.sectionTemplate.count({ where }),
  ]);

  return { items, totalCount };
}

export async function getSectionTemplate(id: string, tenantId: string) {
  const template = await prisma.sectionTemplate.findFirst({
    where: { id, tenantId, isActive: true },
  });

  if (!template) {
    throw new SectionTemplateError("Form template not found", "NOT_FOUND", 404);
  }

  return template;
}

export async function createSectionTemplate(
  input: CreateSectionTemplateInput,
  ctx: TenantServiceContext,
) {
  try {
    const template = await prisma.sectionTemplate.create({
      data: {
        tenantId: ctx.tenantId,
        name: input.name.trim(),
        description: input.description || null,
        entityType: input.entityType ?? "Generic",
        definition: {},
      },
    });

    logger.info({ templateId: template.id }, "Section template created");

    await prisma.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: "CREATE",
        entityType: "SectionTemplate",
        entityId: template.id,
        description: `Created form template "${template.name}"`,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      },
    });

    return template;
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as any).code === "P2002") {
      throw new SectionTemplateError(
        "A form template with this name already exists",
        "DUPLICATE_NAME",
        409,
      );
    }
    throw error;
  }
}

export async function updateSectionTemplate(
  id: string,
  input: UpdateSectionTemplateInput,
  ctx: TenantServiceContext,
) {
  const existing = await prisma.sectionTemplate.findFirst({
    where: { id, tenantId: ctx.tenantId, isActive: true },
  });

  if (!existing) {
    throw new SectionTemplateError("Form template not found", "NOT_FOUND", 404);
  }

  try {
    const updated = await prisma.sectionTemplate.update({
      where: { id },
      data: {
        name: input.name.trim(),
        description: input.description || null,
        entityType: input.entityType ?? existing.entityType,
      },
    });

    logger.info({ templateId: id }, "Section template updated");

    await prisma.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "SectionTemplate",
        entityId: id,
        description: `Updated form template "${updated.name}"`,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      },
    });

    return updated;
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as any).code === "P2002") {
      throw new SectionTemplateError(
        "A form template with this name already exists",
        "DUPLICATE_NAME",
        409,
      );
    }
    throw error;
  }
}

export async function deleteSectionTemplate(id: string, ctx: TenantServiceContext) {
  const existing = await prisma.sectionTemplate.findFirst({
    where: { id, tenantId: ctx.tenantId, isActive: true },
  });

  if (!existing) {
    throw new SectionTemplateError("Form template not found", "NOT_FOUND", 404);
  }

  await prisma.sectionTemplate.update({
    where: { id },
    data: { isActive: false },
  });

  logger.info({ templateId: id }, "Section template soft-deleted");

  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: "DELETE",
      entityType: "SectionTemplate",
      entityId: id,
      description: `Deleted form template "${existing.name}"`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    },
  });
}

// ─── Publish / Unpublish ──────────────────────────────────

export async function publishTemplate(id: string, ctx: TenantServiceContext) {
  const template = await prisma.sectionTemplate.findFirst({
    where: { id, tenantId: ctx.tenantId, isActive: true },
  });

  if (!template) {
    throw new SectionTemplateError("Form template not found", "NOT_FOUND", 404);
  }

  // Validate form has at least one field
  const def = template.definition as unknown as FormDefinition | null;
  const fieldCount =
    def?.pages?.reduce(
      (sum, page) => sum + page.sections.reduce((s, sec) => s + sec.fields.length, 0),
      0,
    ) ?? 0;

  if (fieldCount === 0) {
    throw new SectionTemplateError(
      "Cannot publish a form with no fields. Add at least one field first.",
      "NO_FIELDS",
      400,
    );
  }

  // For entity-bound templates, enforce one published per entityType+tenant
  if (template.entityType !== "Generic") {
    const existing = await prisma.sectionTemplate.findFirst({
      where: {
        tenantId: ctx.tenantId,
        entityType: template.entityType,
        status: "PUBLISHED",
        isActive: true,
        id: { not: id },
      },
    });

    if (existing) {
      throw new SectionTemplateError(
        `Another template ("${existing.name}") is already published for ${template.entityType}. Unpublish it first.`,
        "DUPLICATE_PUBLISHED",
        409,
      );
    }
  }

  const updated = await prisma.sectionTemplate.update({
    where: { id },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });

  logger.info({ templateId: id }, "Form template published");

  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: "UPDATE",
      entityType: "SectionTemplate",
      entityId: id,
      description: `Published form template "${template.name}"`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    },
  });

  return updated;
}

export async function unpublishTemplate(id: string, ctx: TenantServiceContext) {
  const template = await prisma.sectionTemplate.findFirst({
    where: { id, tenantId: ctx.tenantId, isActive: true },
  });

  if (!template) {
    throw new SectionTemplateError("Form template not found", "NOT_FOUND", 404);
  }

  const updated = await prisma.sectionTemplate.update({
    where: { id },
    data: { status: "DRAFT", publishedAt: null },
  });

  logger.info({ templateId: id }, "Form template unpublished");

  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: "UPDATE",
      entityType: "SectionTemplate",
      entityId: id,
      description: `Unpublished form template "${template.name}"`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    },
  });

  return updated;
}

// ─── Entity-Bound Queries ──────────────────────────────────

export async function getPublishedTemplateForEntity(tenantId: string, entityType: string) {
  return prisma.sectionTemplate.findFirst({
    where: { tenantId, entityType, status: "PUBLISHED", isActive: true },
  });
}

/**
 * Load the published extras template + field definitions for a given entity type.
 * Use in route loaders to get data for inline FormRenderer.
 */
export async function loadExtrasForEntity(
  tenantId: string,
  entityType: string,
): Promise<{ extrasDefinition: FormDefinition | null; extrasFieldDefs: RendererFieldDef[] }> {
  const template = await getPublishedTemplateForEntity(tenantId, entityType);
  if (!template) return { extrasDefinition: null, extrasFieldDefs: [] };

  const def = template.definition as unknown as FormDefinition | null;
  if (!def?.pages?.length) return { extrasDefinition: null, extrasFieldDefs: [] };

  const fieldDefIds = collectFieldDefIds(def);
  if (fieldDefIds.length === 0) return { extrasDefinition: def, extrasFieldDefs: [] };

  const fds = await prisma.fieldDefinition.findMany({
    where: { id: { in: fieldDefIds }, tenantId },
    select: { id: true, name: true, label: true, dataType: true, isRequired: true, config: true },
  });

  return {
    extrasDefinition: def,
    extrasFieldDefs: fds.map((fd) => ({ ...fd, dataType: fd.dataType as string })),
  };
}

/**
 * Parse and validate extras from submitted FormData for a given entity type.
 * Use in route actions. Returns `{ extras }` on success or `{ extrasErrors }` on validation failure.
 */
export async function parseExtrasForEntity(
  tenantId: string,
  entityType: string,
  formData: FormData,
  prefix: string = "extras",
): Promise<
  | { extras: Record<string, unknown>; extrasErrors?: undefined }
  | { extras?: undefined; extrasErrors: Record<string, string[]> }
  | null
> {
  const template = await getPublishedTemplateForEntity(tenantId, entityType);
  if (!template) return null;

  const def = template.definition as unknown as FormDefinition | null;
  if (!def?.pages?.length) return null;

  const fieldDefIds = collectFieldDefIds(def);
  if (fieldDefIds.length === 0) return null;

  const fieldDefs = await prisma.fieldDefinition.findMany({
    where: { id: { in: fieldDefIds }, tenantId },
  });

  const parsed = parseExtrasFormData(formData, fieldDefs, prefix);
  const schema = buildFieldSchema(fieldDefs);
  const result = schema.safeParse(parsed);

  if (!result.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (!errors[key]) errors[key] = [];
      errors[key].push(issue.message);
    }
    return { extrasErrors: errors };
  }

  return { extras: result.data as Record<string, unknown> };
}

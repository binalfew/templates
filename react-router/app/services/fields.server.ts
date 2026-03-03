import { prisma } from "~/lib/db.server";
import { logger } from "~/lib/logger.server";
import { FIELD_LIMITS } from "~/config/fields";
import { ConflictError, isPrismaNotFoundError } from "~/services/optimistic-lock.server";
import type { CreateFieldInput, UpdateFieldInput, ReorderFieldsInput } from "~/lib/schemas/field";

import type { TenantServiceContext } from "~/lib/types.server";
import { ServiceError } from "~/lib/service-error.server";

export async function listFields(
  tenantId: string,
  filters: {
    entityType?: string;
    dataType?: string;
    search?: string;
  } = {},
) {
  const where: Record<string, unknown> = { tenantId };

  if (filters.entityType) where.entityType = filters.entityType;
  if (filters.dataType) where.dataType = filters.dataType;
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { label: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const fields = await prisma.fieldDefinition.findMany({
    where,
    orderBy: { sortOrder: "asc" },
  });

  return fields;
}

export async function createField(input: CreateFieldInput, ctx: TenantServiceContext) {
  // Enforce tenant-wide limit
  const tenantCount = await prisma.fieldDefinition.count({
    where: { tenantId: ctx.tenantId },
  });
  if (tenantCount >= FIELD_LIMITS.maxPerTenant) {
    throw new FieldError(
      `Tenant limit reached: maximum ${FIELD_LIMITS.maxPerTenant} fields per organization`,
      422,
    );
  }

  // Enforce per-entity limit
  const entityCount = await prisma.fieldDefinition.count({
    where: { tenantId: ctx.tenantId, entityType: input.entityType ?? "Generic" },
  });
  if (entityCount >= FIELD_LIMITS.maxPerEntity) {
    throw new FieldError(
      `Entity limit reached: maximum ${FIELD_LIMITS.maxPerEntity} fields per entity type`,
      422,
    );
  }

  // Auto-calculate sortOrder
  const maxSort = await prisma.fieldDefinition.findFirst({
    where: { tenantId: ctx.tenantId, entityType: input.entityType ?? "Generic" },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const nextSortOrder = (maxSort?.sortOrder ?? -1) + 1;

  try {
    const field = await prisma.fieldDefinition.create({
      data: {
        tenantId: ctx.tenantId,
        entityType: input.entityType ?? "Generic",
        name: input.name,
        label: input.label,
        description: input.description ?? null,
        dataType: input.dataType,
        sortOrder: nextSortOrder,
        isRequired: input.isRequired,
        isUnique: input.isUnique,
        isSearchable: input.isSearchable,
        isFilterable: input.isFilterable,
        defaultValue: input.defaultValue ?? null,
        config: input.config as object,
        validation: input.validation as object[],
      },
    });

    logger.info({ fieldId: field.id, tenantId: ctx.tenantId }, "Field created");

    await prisma.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: "CREATE",
        entityType: "FieldDefinition",
        entityId: field.id,
        description: `Created field "${input.label}" (${input.name})`,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: { name: input.name, dataType: input.dataType, entityType: input.entityType },
      },
    });

    return field;
  } catch (error: unknown) {
    if (isPrismaUniqueConstraintError(error)) {
      throw new FieldError(
        `A field with name "${input.name}" already exists for this entity type`,
        409,
      );
    }
    throw error;
  }
}

export async function updateField(
  id: string,
  input: UpdateFieldInput,
  ctx: TenantServiceContext,
  expectedVersion?: string,
) {
  const existing = await prisma.fieldDefinition.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });
  if (!existing) {
    throw new FieldError("Field not found", 404);
  }

  if (expectedVersion) {
    const currentVersion = existing.updatedAt.toISOString();
    if (currentVersion !== expectedVersion) {
      throw new ConflictError("Field was modified by another user", {
        id: existing.id,
        name: existing.name,
        label: existing.label,
        updatedAt: existing.updatedAt,
      });
    }
  }

  const updateWhere: Record<string, unknown> = { id };
  if (expectedVersion) {
    updateWhere.updatedAt = new Date(expectedVersion);
  }

  try {
    const field = await prisma.fieldDefinition.update({
      where: updateWhere as { id: string; updatedAt?: Date },
      data: {
        ...(input.entityType !== undefined && { entityType: input.entityType }),
        ...(input.name !== undefined && { name: input.name }),
        ...(input.label !== undefined && { label: input.label }),
        ...(input.description !== undefined && { description: input.description ?? null }),
        ...(input.dataType !== undefined && { dataType: input.dataType }),
        ...(input.isRequired !== undefined && { isRequired: input.isRequired }),
        ...(input.isUnique !== undefined && { isUnique: input.isUnique }),
        ...(input.isSearchable !== undefined && { isSearchable: input.isSearchable }),
        ...(input.isFilterable !== undefined && { isFilterable: input.isFilterable }),
        ...(input.defaultValue !== undefined && { defaultValue: input.defaultValue ?? null }),
        ...(input.config !== undefined && { config: input.config as object }),
        ...(input.validation !== undefined && { validation: input.validation as object[] }),
      },
    });

    logger.info({ fieldId: id, tenantId: ctx.tenantId }, "Field updated");

    await prisma.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "FieldDefinition",
        entityId: id,
        description: `Updated field "${field.label}" (${field.name})`,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: {
          before: { name: existing.name, label: existing.label, dataType: existing.dataType },
          after: { name: field.name, label: field.label, dataType: field.dataType },
        },
      },
    });

    return field;
  } catch (error: unknown) {
    if (isPrismaNotFoundError(error) && expectedVersion) {
      const current = await prisma.fieldDefinition.findFirst({
        where: { id, tenantId: ctx.tenantId },
      });
      throw new ConflictError("Field was modified by another user", {
        id: current?.id,
        name: current?.name,
        label: current?.label,
        updatedAt: current?.updatedAt,
      });
    }
    if (isPrismaUniqueConstraintError(error)) {
      throw new FieldError(
        `A field with name "${input.name}" already exists for this entity type`,
        409,
      );
    }
    throw error;
  }
}

export async function deleteField(
  id: string,
  ctx: TenantServiceContext,
  options: { force?: boolean } = {},
) {
  const existing = await prisma.fieldDefinition.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });
  if (!existing) {
    throw new FieldError("Field not found", 404);
  }

  // Check if any record has data for this field (unless force)
  if (!options.force) {
    const dataCount = await getFieldDataCount(id, ctx.tenantId);
    if (dataCount > 0) {
      throw new FieldError(
        `Cannot delete: ${dataCount} record(s) have data for this field. Use force=true to delete anyway.`,
        422,
      );
    }
  }

  await prisma.fieldDefinition.delete({ where: { id } });

  logger.info({ fieldId: id, tenantId: ctx.tenantId }, "Field deleted");

  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: "DELETE",
      entityType: "FieldDefinition",
      entityId: id,
      description: `Deleted field "${existing.label}" (${existing.name})`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { name: existing.name, dataType: existing.dataType },
    },
  });

  return { success: true };
}

export async function reorderFields(input: ReorderFieldsInput, ctx: TenantServiceContext) {
  // Verify all fields belong to this tenant
  const fields = await prisma.fieldDefinition.findMany({
    where: { id: { in: input.fieldIds }, tenantId: ctx.tenantId },
    select: { id: true },
  });

  const foundIds = new Set(fields.map((f) => f.id));
  const missing = input.fieldIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    throw new FieldError(`Fields not found or not accessible: ${missing.join(", ")}`, 404);
  }

  await prisma.$transaction(
    input.fieldIds.map((fieldId, index) =>
      prisma.fieldDefinition.update({
        where: { id: fieldId },
        data: { sortOrder: index },
      }),
    ),
  );

  logger.info({ tenantId: ctx.tenantId, count: input.fieldIds.length }, "Fields reordered");

  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: "UPDATE",
      entityType: "FieldDefinition",
      description: `Reordered ${input.fieldIds.length} fields`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { fieldIds: input.fieldIds },
    },
  });

  return { success: true };
}

export async function getFieldDataCount(fieldId: string, tenantId: string): Promise<number> {
  const field = await prisma.fieldDefinition.findFirst({
    where: { id: fieldId, tenantId },
    select: { name: true, entityType: true },
  });
  if (!field) return 0;

  // Generic query against User table extras column as a default
  try {
    const result = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM "User" WHERE "tenantId" = $1 AND extras ? $2`,
      tenantId,
      field.name,
    );
    return result[0] ? Number(result[0].count) : 0;
  } catch {
    return 0;
  }
}

/**
 * Returns the effective field definitions for a given tenant and entity type.
 */
export async function getEffectiveFields(
  tenantId: string,
  entityType: string = "Generic",
) {
  const fields = await prisma.fieldDefinition.findMany({
    where: {
      tenantId,
      entityType,
    },
    orderBy: { sortOrder: "asc" },
  });

  return fields;
}

// Error class for service-layer errors with HTTP status codes
export class FieldError extends ServiceError {
  constructor(message: string, status: number) {
    super(message, status);
    this.name = "FieldError";
  }
}

function isPrismaUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  );
}

import { prisma } from "~/lib/db.server";
import { logger } from "~/lib/logger.server";
import { SLUG_REGEX } from "~/lib/schemas/custom-object";
import type { PaginatedQueryOptions } from "~/lib/types.server";
import { ServiceError } from "~/lib/service-error.server";

export interface CustomFieldDefinition {
  name: string;
  label: string;
  dataType: string;
  required?: boolean;
  options?: string[];
  defaultValue?: unknown;
}

export interface CreateDefinitionInput {
  tenantId: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  fields: CustomFieldDefinition[];
  createdBy?: string;
}

export interface UpdateDefinitionInput {
  name?: string;
  description?: string;
  icon?: string;
  fields?: CustomFieldDefinition[];
  isActive?: boolean;
}

export interface CreateRecordInput {
  definitionId: string;
  tenantId: string;
  data: Record<string, unknown>;
  createdBy?: string;
}

export class CustomObjectError extends ServiceError {
  constructor(message: string, status: number) {
    super(message, status);
    this.name = "CustomObjectError";
  }
}

function validateSlug(slug: string) {
  if (!SLUG_REGEX.test(slug)) {
    throw new CustomObjectError(
      "Slug must start with a letter and contain only lowercase letters, numbers, hyphens, and underscores",
      400,
    );
  }
}

export async function createDefinition(input: CreateDefinitionInput) {
  validateSlug(input.slug);
  const definition = await prisma.customObjectDefinition.create({
    data: {
      tenantId: input.tenantId,
      name: input.name,
      slug: input.slug,
      description: input.description,
      icon: input.icon,
      fields: input.fields as object[],
      createdBy: input.createdBy,
    },
  });
  logger.info({ definitionId: definition.id, slug: input.slug }, "Custom object definition created");
  return definition;
}

export async function updateDefinition(definitionId: string, input: UpdateDefinitionInput) {
  const definition = await prisma.customObjectDefinition.update({
    where: { id: definitionId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.icon !== undefined && { icon: input.icon }),
      ...(input.fields !== undefined && { fields: input.fields as object[] }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
  });
  logger.info({ definitionId }, "Custom object definition updated");
  return definition;
}

export async function deleteDefinition(definitionId: string) {
  const definition = await prisma.customObjectDefinition.findUniqueOrThrow({
    where: { id: definitionId },
    include: { _count: { select: { records: true } } },
  });
  if (definition._count.records > 0) {
    throw new CustomObjectError(
      `Cannot delete definition with ${definition._count.records} existing record(s). Delete records first or deactivate the definition.`,
      400,
    );
  }
  await prisma.customObjectDefinition.update({ where: { id: definitionId }, data: { deletedAt: new Date() } });
  logger.info({ definitionId }, "Custom object definition deleted");
}

export async function getDefinition(definitionId: string) {
  return prisma.customObjectDefinition.findUniqueOrThrow({
    where: { id: definitionId },
    include: { _count: { select: { records: true } } },
  });
}

export async function getDefinitionBySlug(tenantId: string, slug: string) {
  return prisma.customObjectDefinition.findUniqueOrThrow({
    where: { tenantId_slug: { tenantId, slug } },
    include: { _count: { select: { records: true } } },
  });
}

export async function listDefinitions(tenantId: string, includeInactive = false) {
  return prisma.customObjectDefinition.findMany({
    where: { tenantId, ...(includeInactive ? {} : { isActive: true }) },
    include: { _count: { select: { records: true } } },
    orderBy: { name: "asc" },
  });
}

export async function listDefinitionsPaginated(
  tenantId: string,
  options: PaginatedQueryOptions,
) {
  const where = { tenantId, ...(options.where ?? {}) } as any;
  const orderBy = options.orderBy?.length ? (options.orderBy as any) : { name: "asc" };

  const [items, totalCount] = await Promise.all([
    prisma.customObjectDefinition.findMany({
      where,
      orderBy,
      include: { _count: { select: { records: true } } },
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
    }),
    prisma.customObjectDefinition.count({ where }),
  ]);

  return { items, totalCount };
}

export async function createRecord(input: CreateRecordInput) {
  const definition = await prisma.customObjectDefinition.findUniqueOrThrow({
    where: { id: input.definitionId },
  });
  if (!definition.isActive) {
    throw new CustomObjectError("Cannot create records for an inactive definition", 400);
  }
  const fields = definition.fields as unknown as CustomFieldDefinition[];
  for (const field of fields) {
    if (field.required && (input.data[field.name] === undefined || input.data[field.name] === "")) {
      throw new CustomObjectError(`Field "${field.label}" is required`, 400);
    }
  }
  const record = await prisma.customObjectRecord.create({
    data: {
      definitionId: input.definitionId,
      tenantId: input.tenantId,
      data: input.data as object,
      createdBy: input.createdBy,
    },
  });
  logger.info({ recordId: record.id, definitionId: input.definitionId }, "Custom object record created");
  return record;
}

export async function updateRecord(recordId: string, recordData: Record<string, unknown>) {
  const existing = await prisma.customObjectRecord.findUniqueOrThrow({
    where: { id: recordId },
    include: { definition: true },
  });
  const fields = existing.definition.fields as unknown as CustomFieldDefinition[];
  for (const field of fields) {
    if (field.required && (recordData[field.name] === undefined || recordData[field.name] === "")) {
      throw new CustomObjectError(`Field "${field.label}" is required`, 400);
    }
  }
  const record = await prisma.customObjectRecord.update({
    where: { id: recordId },
    data: { data: recordData as object },
  });
  logger.info({ recordId }, "Custom object record updated");
  return record;
}

export async function deleteRecord(recordId: string) {
  await prisma.customObjectRecord.delete({ where: { id: recordId } });
  logger.info({ recordId }, "Custom object record deleted");
}

export async function getRecord(recordId: string) {
  return prisma.customObjectRecord.findUniqueOrThrow({
    where: { id: recordId },
    include: { definition: true },
  });
}

export async function listRecords(definitionId: string, tenantId: string) {
  return prisma.customObjectRecord.findMany({
    where: { definitionId, tenantId },
    orderBy: { createdAt: "desc" },
  });
}

import { prisma } from "~/lib/db/db.server";
import type {
  CreateCountryInput,
  UpdateCountryInput,
  CreateTitleInput,
  UpdateTitleInput,
  CreateLanguageInput,
  UpdateLanguageInput,
  CreateCurrencyInput,
  UpdateCurrencyInput,
  CreateDocumentTypeInput,
  UpdateDocumentTypeInput,
} from "~/lib/schemas/reference-data";

import type { TenantServiceContext } from "~/lib/types.server";
import { ServiceError } from "~/lib/errors/service-error.server";

export class ReferenceDataError extends ServiceError {
  constructor(message: string, status: number) {
    super(message, status);
    this.name = "ReferenceDataError";
  }
}

function audit(
  ctx: TenantServiceContext,
  action: "CREATE" | "UPDATE" | "DELETE",
  entityType: string,
  entityId: string,
  description: string,
  metadata?: Record<string, unknown>,
) {
  return prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action,
      entityType,
      entityId,
      description,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: (metadata as any) ?? undefined,
    },
  });
}

function handleDuplicateError(entity: string): never {
  throw new ReferenceDataError(`A ${entity} with this code already exists`, 409);
}

// ═══════════════════════════════════════════════════════════
// Country
// ═══════════════════════════════════════════════════════════

export async function listCountries(filter?: { isActive?: boolean; search?: string }) {
  return prisma.country.findMany({
    where: {
      ...(filter?.isActive !== undefined && { isActive: filter.isActive }),
      ...(filter?.search && {
        OR: [
          { name: { contains: filter.search, mode: "insensitive" as const } },
          { code: { contains: filter.search, mode: "insensitive" as const } },
        ],
      }),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function getCountry(id: string) {
  const country = await prisma.country.findFirst({ where: { id } });
  if (!country) throw new ReferenceDataError("Country not found", 404);
  return country;
}

export async function createCountry(input: CreateCountryInput, ctx: TenantServiceContext) {
  let country;
  try {
    country = await prisma.country.create({
      data: {
        code: input.code.toUpperCase(),
        name: input.name,
        alpha3: input.alpha3 || null,
        numericCode: input.numericCode || null,
        phoneCode: input.phoneCode || null,
        flag: input.flag || null,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      },
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as any).code === "P2002") {
      handleDuplicateError("country");
    }
    throw error;
  }
  await audit(
    ctx,
    "CREATE",
    "Country",
    country.id,
    `Created country "${country.name}" (${country.code})`,
  );
  return country;
}

export async function updateCountry(id: string, input: UpdateCountryInput, ctx: TenantServiceContext) {
  const existing = await prisma.country.findFirst({ where: { id } });
  if (!existing) throw new ReferenceDataError("Country not found", 404);

  let country;
  try {
    country = await prisma.country.update({
      where: { id },
      data: {
        code: input.code.toUpperCase(),
        name: input.name,
        alpha3: input.alpha3 || null,
        numericCode: input.numericCode || null,
        phoneCode: input.phoneCode || null,
        flag: input.flag || null,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      },
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as any).code === "P2002") {
      handleDuplicateError("country");
    }
    throw error;
  }
  await audit(ctx, "UPDATE", "Country", id, `Updated country "${country.name}" (${country.code})`);
  return country;
}

export async function deleteCountry(id: string, ctx: TenantServiceContext) {
  const existing = await prisma.country.findFirst({ where: { id } });
  if (!existing) throw new ReferenceDataError("Country not found", 404);

  await prisma.country.delete({ where: { id } });
  await audit(
    ctx,
    "DELETE",
    "Country",
    id,
    `Deleted country "${existing.name}" (${existing.code})`,
  );
}

// ═══════════════════════════════════════════════════════════
// Title
// ═══════════════════════════════════════════════════════════

export async function listTitles(filter?: { isActive?: boolean; search?: string }) {
  return prisma.title.findMany({
    where: {
      ...(filter?.isActive !== undefined && { isActive: filter.isActive }),
      ...(filter?.search && {
        OR: [
          { name: { contains: filter.search, mode: "insensitive" as const } },
          { code: { contains: filter.search, mode: "insensitive" as const } },
        ],
      }),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function getTitle(id: string) {
  const title = await prisma.title.findFirst({ where: { id } });
  if (!title) throw new ReferenceDataError("Title not found", 404);
  return title;
}

export async function createTitle(input: CreateTitleInput, ctx: TenantServiceContext) {
  let title;
  try {
    title = await prisma.title.create({
      data: {
        code: input.code.toUpperCase(),
        name: input.name,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      },
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as any).code === "P2002") {
      handleDuplicateError("title");
    }
    throw error;
  }
  await audit(ctx, "CREATE", "Title", title.id, `Created title "${title.name}" (${title.code})`);
  return title;
}

export async function updateTitle(id: string, input: UpdateTitleInput, ctx: TenantServiceContext) {
  const existing = await prisma.title.findFirst({ where: { id } });
  if (!existing) throw new ReferenceDataError("Title not found", 404);

  let title;
  try {
    title = await prisma.title.update({
      where: { id },
      data: {
        code: input.code.toUpperCase(),
        name: input.name,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      },
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as any).code === "P2002") {
      handleDuplicateError("title");
    }
    throw error;
  }
  await audit(ctx, "UPDATE", "Title", id, `Updated title "${title.name}" (${title.code})`);
  return title;
}

export async function deleteTitle(id: string, ctx: TenantServiceContext) {
  const existing = await prisma.title.findFirst({ where: { id } });
  if (!existing) throw new ReferenceDataError("Title not found", 404);

  await prisma.title.delete({ where: { id } });
  await audit(ctx, "DELETE", "Title", id, `Deleted title "${existing.name}" (${existing.code})`);
}

// ═══════════════════════════════════════════════════════════
// Language
// ═══════════════════════════════════════════════════════════

export async function listLanguages(filter?: { isActive?: boolean; search?: string }) {
  return prisma.language.findMany({
    where: {
      ...(filter?.isActive !== undefined && { isActive: filter.isActive }),
      ...(filter?.search && {
        OR: [
          { name: { contains: filter.search, mode: "insensitive" as const } },
          { code: { contains: filter.search, mode: "insensitive" as const } },
          { nativeName: { contains: filter.search, mode: "insensitive" as const } },
        ],
      }),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function getLanguage(id: string) {
  const language = await prisma.language.findFirst({ where: { id } });
  if (!language) throw new ReferenceDataError("Language not found", 404);
  return language;
}

export async function createLanguage(input: CreateLanguageInput, ctx: TenantServiceContext) {
  let language;
  try {
    language = await prisma.language.create({
      data: {
        code: input.code.toLowerCase(),
        name: input.name,
        nativeName: input.nativeName || null,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      },
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as any).code === "P2002") {
      handleDuplicateError("language");
    }
    throw error;
  }
  await audit(
    ctx,
    "CREATE",
    "Language",
    language.id,
    `Created language "${language.name}" (${language.code})`,
  );
  return language;
}

export async function updateLanguage(id: string, input: UpdateLanguageInput, ctx: TenantServiceContext) {
  const existing = await prisma.language.findFirst({ where: { id } });
  if (!existing) throw new ReferenceDataError("Language not found", 404);

  let language;
  try {
    language = await prisma.language.update({
      where: { id },
      data: {
        code: input.code.toLowerCase(),
        name: input.name,
        nativeName: input.nativeName || null,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      },
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as any).code === "P2002") {
      handleDuplicateError("language");
    }
    throw error;
  }
  await audit(
    ctx,
    "UPDATE",
    "Language",
    id,
    `Updated language "${language.name}" (${language.code})`,
  );
  return language;
}

export async function deleteLanguage(id: string, ctx: TenantServiceContext) {
  const existing = await prisma.language.findFirst({ where: { id } });
  if (!existing) throw new ReferenceDataError("Language not found", 404);

  await prisma.language.delete({ where: { id } });
  await audit(
    ctx,
    "DELETE",
    "Language",
    id,
    `Deleted language "${existing.name}" (${existing.code})`,
  );
}

// ═══════════════════════════════════════════════════════════
// Currency
// ═══════════════════════════════════════════════════════════

export async function listCurrencies(filter?: { isActive?: boolean; search?: string }) {
  return prisma.currency.findMany({
    where: {
      ...(filter?.isActive !== undefined && { isActive: filter.isActive }),
      ...(filter?.search && {
        OR: [
          { name: { contains: filter.search, mode: "insensitive" as const } },
          { code: { contains: filter.search, mode: "insensitive" as const } },
          { symbol: { contains: filter.search, mode: "insensitive" as const } },
        ],
      }),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function getCurrency(id: string) {
  const currency = await prisma.currency.findFirst({ where: { id } });
  if (!currency) throw new ReferenceDataError("Currency not found", 404);
  return currency;
}

export async function createCurrency(input: CreateCurrencyInput, ctx: TenantServiceContext) {
  let currency;
  try {
    currency = await prisma.currency.create({
      data: {
        code: input.code.toUpperCase(),
        name: input.name,
        symbol: input.symbol || null,
        decimalDigits: input.decimalDigits,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      },
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as any).code === "P2002") {
      handleDuplicateError("currency");
    }
    throw error;
  }
  await audit(
    ctx,
    "CREATE",
    "Currency",
    currency.id,
    `Created currency "${currency.name}" (${currency.code})`,
  );
  return currency;
}

export async function updateCurrency(id: string, input: UpdateCurrencyInput, ctx: TenantServiceContext) {
  const existing = await prisma.currency.findFirst({ where: { id } });
  if (!existing) throw new ReferenceDataError("Currency not found", 404);

  let currency;
  try {
    currency = await prisma.currency.update({
      where: { id },
      data: {
        code: input.code.toUpperCase(),
        name: input.name,
        symbol: input.symbol || null,
        decimalDigits: input.decimalDigits,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      },
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as any).code === "P2002") {
      handleDuplicateError("currency");
    }
    throw error;
  }
  await audit(
    ctx,
    "UPDATE",
    "Currency",
    id,
    `Updated currency "${currency.name}" (${currency.code})`,
  );
  return currency;
}

export async function deleteCurrency(id: string, ctx: TenantServiceContext) {
  const existing = await prisma.currency.findFirst({ where: { id } });
  if (!existing) throw new ReferenceDataError("Currency not found", 404);

  await prisma.currency.delete({ where: { id } });
  await audit(
    ctx,
    "DELETE",
    "Currency",
    id,
    `Deleted currency "${existing.name}" (${existing.code})`,
  );
}

// ═══════════════════════════════════════════════════════════
// Document Type
// ═══════════════════════════════════════════════════════════

export async function listDocumentTypes(filter?: { isActive?: boolean; search?: string }) {
  return prisma.documentType.findMany({
    where: {
      ...(filter?.isActive !== undefined && { isActive: filter.isActive }),
      ...(filter?.search && {
        OR: [
          { name: { contains: filter.search, mode: "insensitive" as const } },
          { code: { contains: filter.search, mode: "insensitive" as const } },
          { category: { contains: filter.search, mode: "insensitive" as const } },
        ],
      }),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function getDocumentType(id: string) {
  const documentType = await prisma.documentType.findFirst({ where: { id } });
  if (!documentType) throw new ReferenceDataError("Document type not found", 404);
  return documentType;
}

export async function createDocumentType(input: CreateDocumentTypeInput, ctx: TenantServiceContext) {
  let documentType;
  try {
    documentType = await prisma.documentType.create({
      data: {
        code: input.code.toUpperCase(),
        name: input.name,
        description: input.description || null,
        category: input.category || null,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      },
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as any).code === "P2002") {
      handleDuplicateError("document type");
    }
    throw error;
  }
  await audit(
    ctx,
    "CREATE",
    "DocumentType",
    documentType.id,
    `Created document type "${documentType.name}" (${documentType.code})`,
  );
  return documentType;
}

export async function updateDocumentType(
  id: string,
  input: UpdateDocumentTypeInput,
  ctx: TenantServiceContext,
) {
  const existing = await prisma.documentType.findFirst({ where: { id } });
  if (!existing) throw new ReferenceDataError("Document type not found", 404);

  let documentType;
  try {
    documentType = await prisma.documentType.update({
      where: { id },
      data: {
        code: input.code.toUpperCase(),
        name: input.name,
        description: input.description || null,
        category: input.category || null,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      },
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as any).code === "P2002") {
      handleDuplicateError("document type");
    }
    throw error;
  }
  await audit(
    ctx,
    "UPDATE",
    "DocumentType",
    id,
    `Updated document type "${documentType.name}" (${documentType.code})`,
  );
  return documentType;
}

export async function deleteDocumentType(id: string, ctx: TenantServiceContext) {
  const existing = await prisma.documentType.findFirst({ where: { id } });
  if (!existing) throw new ReferenceDataError("Document type not found", 404);

  await prisma.documentType.delete({ where: { id } });
  await audit(
    ctx,
    "DELETE",
    "DocumentType",
    id,
    `Deleted document type "${existing.name}" (${existing.code})`,
  );
}

// ═══════════════════════════════════════════════════════════
// Counts (for hub page)
// ═══════════════════════════════════════════════════════════

export async function getReferenceDataCounts() {
  const [countries, titles, languages, currencies, documentTypes] = await Promise.all([
    prisma.country.count(),
    prisma.title.count(),
    prisma.language.count(),
    prisma.currency.count(),
    prisma.documentType.count(),
  ]);
  return { countries, titles, languages, currencies, documentTypes };
}

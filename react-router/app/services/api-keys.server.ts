import crypto from "node:crypto";
import { hash, compare } from "bcryptjs";
import { prisma } from "~/lib/db/db.server";
import { logger } from "~/lib/monitoring/logger.server";
import { ServiceError } from "~/lib/errors/service-error.server";
import { env } from "~/lib/config/env.server";
import type { TenantServiceContext } from "~/lib/types.server";

// ─── Types ────────────────────────────────────────────────

export class ApiKeyError extends ServiceError {
  constructor(message: string, status: number) {
    super(message, status);
    this.name = "ApiKeyError";
  }
}

interface CreateApiKeyInput {
  name: string;
  description?: string;
  permissions: string[];
  rateLimitTier?: "STANDARD" | "ELEVATED" | "PREMIUM" | "CUSTOM";
  rateLimitCustom?: number;
  expiresAt?: Date;
  allowedIps?: string[];
  allowedOrigins?: string[];
}

interface UpdateApiKeyInput {
  name?: string;
  description?: string;
  permissions?: string[];
  rateLimitTier?: "STANDARD" | "ELEVATED" | "PREMIUM" | "CUSTOM";
  rateLimitCustom?: number;
  expiresAt?: Date;
  allowedIps?: string[];
  allowedOrigins?: string[];
}

interface ListApiKeysFilters {
  status?: "ACTIVE" | "ROTATED" | "REVOKED" | "EXPIRED";
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface ValidatedApiKey {
  tenantId: string;
  permissions: string[];
  apiKeyId: string;
  rateLimitTier: string;
  rateLimitCustom: number | null;
}

// ─── Shared Select ────────────────────────────────────────

const API_KEY_SELECT = {
  id: true,
  name: true,
  description: true,
  keyPrefix: true,
  permissions: true,
  rateLimitTier: true,
  rateLimitCustom: true,
  status: true,
  expiresAt: true,
  lastUsedAt: true,
  lastUsedIp: true,
  usageCount: true,
  allowedIps: true,
  allowedOrigins: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  revokedAt: true,
} as const;

// ─── Key Generation ───────────────────────────────────────

function generateRawKey(tenantId: string): string {
  const secret = crypto.randomBytes(32).toString("hex");
  const slug = tenantId.slice(0, 4);
  return `ak_${slug}_${secret}`;
}

function extractPrefix(rawKey: string): string {
  return rawKey.slice(0, 8);
}

// ─── Service Functions ────────────────────────────────────

export async function createApiKey(input: CreateApiKeyInput, ctx: TenantServiceContext) {
  const rawKey = generateRawKey(ctx.tenantId);
  const keyHash = await hash(rawKey, env.BCRYPT_ROUNDS);
  const keyPrefix = extractPrefix(rawKey);

  const apiKey = await prisma.apiKey.create({
    data: {
      tenantId: ctx.tenantId,
      name: input.name,
      description: input.description,
      keyHash,
      keyPrefix,
      permissions: input.permissions,
      rateLimitTier: input.rateLimitTier ?? "STANDARD",
      rateLimitCustom: input.rateLimitCustom,
      expiresAt: input.expiresAt,
      allowedIps: input.allowedIps ?? [],
      allowedOrigins: input.allowedOrigins ?? [],
      createdBy: ctx.userId,
    },
  });

  logger.info({ apiKeyId: apiKey.id, keyPrefix }, "API key created");

  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: "CREATE",
      entityType: "ApiKey",
      entityId: apiKey.id,
      description: `Created API key "${input.name}"`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { name: input.name, permissions: input.permissions },
    },
  });

  return { apiKey, rawKey };
}

export async function listApiKeys(tenantId: string, filters?: ListApiKeysFilters) {
  const page = filters?.page ?? 1;
  const pageSize = Math.min(filters?.pageSize ?? 20, 100);
  const skip = (page - 1) * pageSize;

  const where = {
    tenantId,
    ...(filters?.status && { status: filters.status }),
    ...(filters?.search && {
      OR: [
        { name: { contains: filters.search, mode: "insensitive" as const } },
        { description: { contains: filters.search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    prisma.apiKey.findMany({
      where,
      select: API_KEY_SELECT,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.apiKey.count({ where }),
  ]);

  return {
    items,
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

export async function getApiKey(id: string, tenantId: string) {
  return prisma.apiKey.findFirst({
    where: { id, tenantId },
    select: API_KEY_SELECT,
  });
}

export async function updateApiKey(id: string, input: UpdateApiKeyInput, ctx: TenantServiceContext) {
  const existing = await prisma.apiKey.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });
  if (!existing) {
    throw new ApiKeyError("API key not found", 404);
  }
  if (existing.status !== "ACTIVE") {
    throw new ApiKeyError("Cannot update a non-active API key", 400);
  }

  const apiKey = await prisma.apiKey.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.permissions !== undefined && { permissions: input.permissions }),
      ...(input.rateLimitTier !== undefined && { rateLimitTier: input.rateLimitTier }),
      ...(input.rateLimitCustom !== undefined && { rateLimitCustom: input.rateLimitCustom }),
      ...(input.expiresAt !== undefined && { expiresAt: input.expiresAt }),
      ...(input.allowedIps !== undefined && { allowedIps: input.allowedIps }),
      ...(input.allowedOrigins !== undefined && { allowedOrigins: input.allowedOrigins }),
    },
  });

  logger.info({ apiKeyId: id }, "API key updated");

  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: "CONFIGURE",
      entityType: "ApiKey",
      entityId: id,
      description: `Updated API key "${apiKey.name}"`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: JSON.parse(JSON.stringify(input)),
    },
  });

  return apiKey;
}

export async function revokeApiKey(id: string, ctx: TenantServiceContext) {
  const existing = await prisma.apiKey.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });
  if (!existing) {
    throw new ApiKeyError("API key not found", 404);
  }
  if (existing.status === "REVOKED") {
    throw new ApiKeyError("API key is already revoked", 400);
  }

  const apiKey = await prisma.apiKey.update({
    where: { id },
    data: { status: "REVOKED", revokedAt: new Date() },
  });

  logger.info({ apiKeyId: id }, "API key revoked");

  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: "CONFIGURE",
      entityType: "ApiKey",
      entityId: id,
      description: `Revoked API key "${apiKey.name}"`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { action: "revoke" },
    },
  });

  return apiKey;
}

export async function rotateApiKey(id: string, gracePeriodHours: number, ctx: TenantServiceContext) {
  const existing = await prisma.apiKey.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });
  if (!existing) {
    throw new ApiKeyError("API key not found", 404);
  }
  if (existing.status !== "ACTIVE") {
    throw new ApiKeyError("Can only rotate active API keys", 400);
  }

  const rawKey = generateRawKey(ctx.tenantId);
  const keyHash = await hash(rawKey, env.BCRYPT_ROUNDS);
  const keyPrefix = extractPrefix(rawKey);
  const graceEnd = new Date(Date.now() + gracePeriodHours * 60 * 60 * 1000);

  const [, newKey] = await prisma.$transaction([
    prisma.apiKey.update({
      where: { id },
      data: { status: "ROTATED", rotationGraceEnd: graceEnd },
    }),
    prisma.apiKey.create({
      data: {
        tenantId: ctx.tenantId,
        name: existing.name,
        description: existing.description,
        keyHash,
        keyPrefix,
        permissions: existing.permissions,
        rateLimitTier: existing.rateLimitTier,
        rateLimitCustom: existing.rateLimitCustom,
        expiresAt: existing.expiresAt,
        allowedIps: existing.allowedIps,
        allowedOrigins: existing.allowedOrigins,
        rotatedFromId: id,
        createdBy: ctx.userId,
      },
    }),
  ]);

  logger.info({ oldKeyId: id, newKeyId: newKey.id, graceEnd }, "API key rotated");

  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: "CONFIGURE",
      entityType: "ApiKey",
      entityId: newKey.id,
      description: `Rotated API key "${existing.name}" (grace: ${gracePeriodHours}h)`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { oldKeyId: id, gracePeriodHours },
    },
  });

  return { apiKey: newKey, rawKey };
}

export async function validateApiKey(rawKey: string): Promise<ValidatedApiKey | null> {
  if (!rawKey || !rawKey.startsWith("ak_")) return null;

  const prefix = extractPrefix(rawKey);

  const candidates = await prisma.apiKey.findMany({
    where: {
      keyPrefix: prefix,
      status: { in: ["ACTIVE", "ROTATED"] },
    },
  });

  for (const candidate of candidates) {
    const match = await compare(rawKey, candidate.keyHash);
    if (!match) continue;

    if (candidate.status === "ROTATED") {
      if (!candidate.rotationGraceEnd || candidate.rotationGraceEnd < new Date()) {
        return null;
      }
    }

    if (candidate.expiresAt && candidate.expiresAt < new Date()) {
      return null;
    }

    return {
      tenantId: candidate.tenantId,
      permissions: candidate.permissions,
      apiKeyId: candidate.id,
      rateLimitTier: candidate.rateLimitTier,
      rateLimitCustom: candidate.rateLimitCustom,
    };
  }

  return null;
}

export function trackApiKeyUsage(apiKeyId: string, ip: string) {
  prisma.apiKey
    .update({
      where: { id: apiKeyId },
      data: {
        lastUsedAt: new Date(),
        lastUsedIp: ip,
        usageCount: { increment: 1 },
      },
    })
    .catch((err) => {
      logger.warn({ apiKeyId, error: err }, "Failed to track API key usage");
    });
}

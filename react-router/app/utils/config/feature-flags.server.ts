import { prisma } from "~/utils/db/db.server";
import { logger } from "~/utils/monitoring/logger.server";
import type { UpdateFlagInput } from "~/utils/schemas/settings";
import type { ServiceContext } from "~/utils/types.server";

// --- Types ---

interface FlagContext {
  tenantId?: string;
  roles?: string[];
  userId?: string;
}

export interface FlagWithStatus {
  id: string;
  key: string;
  description: string | null;
  enabled: boolean;
  enabledForTenants: string[];
  enabledForRoles: string[];
  enabledForUsers: string[];
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// --- Feature Flag Keys ---

export const FEATURE_FLAG_KEYS = {
  I18N: "FF_I18N",
  PWA: "FF_PWA",
  REST_API: "FF_REST_API",
  WEBHOOKS: "FF_WEBHOOKS",
  SAVED_VIEWS: "FF_SAVED_VIEWS",
  TWO_FACTOR: "FF_TWO_FACTOR",
} as const;

// --- SDK Functions ---

export async function isFeatureEnabled(key: string, context?: FlagContext): Promise<boolean> {
  const flag = await prisma.featureFlag.findUnique({ where: { key } });
  if (!flag) return false;

  return evaluateFlag(flag, context);
}

function evaluateFlag(
  flag: {
    enabled: boolean;
    enabledForTenants: string[];
    enabledForRoles: string[];
    enabledForUsers: string[];
  },
  context?: FlagContext,
): boolean {
  if (flag.enabled) return true;
  if (!context) return false;

  if (context.tenantId && flag.enabledForTenants.includes(context.tenantId)) return true;
  if (context.roles?.some((role) => flag.enabledForRoles.includes(role))) return true;
  if (context.userId && flag.enabledForUsers.includes(context.userId)) return true;

  return false;
}

export async function getAllFlags(context?: FlagContext): Promise<FlagWithStatus[]> {
  const flags = await prisma.featureFlag.findMany({
    orderBy: { key: "asc" },
  });

  return flags.map((flag) => ({
    ...flag,
    isEnabled: evaluateFlag(flag, context),
  }));
}

export async function setFlag(key: string, updates: UpdateFlagInput, ctx: ServiceContext) {
  const flag = await prisma.featureFlag.update({
    where: { key },
    data: {
      ...(updates.enabled !== undefined && { enabled: updates.enabled }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.enabledForTenants !== undefined && {
        enabledForTenants: updates.enabledForTenants,
      }),
      ...(updates.enabledForRoles !== undefined && { enabledForRoles: updates.enabledForRoles }),
      ...(updates.enabledForUsers !== undefined && { enabledForUsers: updates.enabledForUsers }),
    },
  });

  logger.info({ flagId: flag.id, key, enabled: flag.enabled }, "Feature flag updated");

  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId ?? null,
      userId: ctx.userId,
      action: "CONFIGURE",
      entityType: "FeatureFlag",
      entityId: flag.id,
      description: `Updated feature flag "${key}" (enabled: ${flag.enabled})`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { key, ...updates },
    },
  });

  return flag;
}

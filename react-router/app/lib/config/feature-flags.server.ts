import { prisma } from "~/lib/db/db.server";
import { logger } from "~/lib/monitoring/logger.server";
import type { UpdateFlagInput } from "~/lib/schemas/settings";
import type { ServiceContext } from "~/lib/types.server";

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
  SSE_UPDATES: "FF_SSE_UPDATES",
  KEYBOARD_SHORTCUTS: "FF_KEYBOARD_SHORTCUTS",
  NOTIFICATIONS: "FF_NOTIFICATIONS",
  I18N: "FF_I18N",
  PWA: "FF_PWA",
  OFFLINE_MODE: "FF_OFFLINE_MODE",
  ANALYTICS: "FF_ANALYTICS",
  REST_API: "FF_REST_API",
  WEBHOOKS: "FF_WEBHOOKS",
  SIGNUP: "FF_SIGNUP",
  SAVED_VIEWS: "FF_SAVED_VIEWS",
  CUSTOM_FIELDS: "FF_CUSTOM_FIELDS",
  BROADCASTS: "FF_BROADCASTS",
  FILE_UPLOADS: "FF_FILE_UPLOADS",
  GLOBAL_SEARCH: "FF_GLOBAL_SEARCH",
  CUSTOM_OBJECTS: "FF_CUSTOM_OBJECTS",
  FORM_DESIGNER: "FF_FORM_DESIGNER",
  TWO_FACTOR: "FF_TWO_FACTOR",
  INVITATIONS: "FF_INVITATIONS",
  DATA_IMPORT_EXPORT: "FF_DATA_IMPORT_EXPORT",
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

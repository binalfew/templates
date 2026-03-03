import { prisma } from "~/lib/db.server";
import { logger } from "~/lib/logger.server";
import type { UpsertSettingInput } from "~/lib/schemas/settings";
import type { ServiceContext } from "~/lib/types.server";

// ─── Types ────────────────────────────────────────────────

interface SettingContext {
  userId?: string;
  tenantId?: string;
}

export interface ResolvedSetting {
  key: string;
  value: string;
  type: string;
  category: string;
  scope: string;
  scopeId: string;
}

// ─── Defaults ─────────────────────────────────────────────

export const SETTING_DEFAULTS: Record<string, { value: string; type: string; category: string }> = {
  "upload.max_file_size_mb": { value: "10", type: "number", category: "upload" },
  "upload.allowed_extensions": {
    value: "jpg,jpeg,png,gif,pdf,doc,docx",
    type: "string",
    category: "upload",
  },
  "auth.session_timeout_minutes": { value: "480", type: "number", category: "auth" },
  "auth.max_failed_attempts": { value: "5", type: "number", category: "auth" },
  "auth.lockout_duration_minutes": { value: "30", type: "number", category: "auth" },
  "auth.inactivity_timeout_minutes": { value: "60", type: "number", category: "auth" },
  "email.from_address": { value: "noreply@example.com", type: "string", category: "email" },
  "email.from_name": { value: "App Platform", type: "string", category: "email" },
  "general.app_name": { value: "App Platform", type: "string", category: "general" },
  "general.default_timezone": { value: "UTC", type: "string", category: "general" },
};

// ─── Scope Priority ───────────────────────────────────────

const SCOPE_PRIORITY: Record<string, number> = {
  user: 3,
  tenant: 2,
  global: 1,
};

// ─── SDK Functions ────────────────────────────────────────

export async function getSetting(
  key: string,
  context?: SettingContext,
): Promise<ResolvedSetting | null> {
  const scopeFilters: Array<{ scope: string; scopeId: string }> = [
    { scope: "global", scopeId: "" },
  ];

  if (context?.tenantId) {
    scopeFilters.push({ scope: "tenant", scopeId: context.tenantId });
  }
  if (context?.userId) {
    scopeFilters.push({ scope: "user", scopeId: context.userId });
  }

  const settings = await prisma.systemSetting.findMany({
    where: {
      key,
      OR: scopeFilters,
    },
  });

  if (settings.length === 0) {
    const def = SETTING_DEFAULTS[key];
    if (def) {
      return {
        key,
        value: def.value,
        type: def.type,
        category: def.category,
        scope: "default",
        scopeId: "",
      };
    }
    return null;
  }

  settings.sort((a, b) => (SCOPE_PRIORITY[b.scope] ?? 0) - (SCOPE_PRIORITY[a.scope] ?? 0));

  const best = settings[0];
  return {
    key: best.key,
    value: best.value,
    type: best.type,
    category: best.category,
    scope: best.scope,
    scopeId: best.scopeId,
  };
}

export async function setSetting(input: UpsertSettingInput, ctx: ServiceContext) {
  const setting = await prisma.systemSetting.upsert({
    where: {
      key_scope_scopeId: {
        key: input.key,
        scope: input.scope,
        scopeId: input.scopeId,
      },
    },
    update: {
      value: input.value,
      type: input.type,
      category: input.category,
    },
    create: {
      key: input.key,
      value: input.value,
      type: input.type,
      category: input.category,
      scope: input.scope,
      scopeId: input.scopeId,
    },
  });

  logger.info({ settingId: setting.id, key: input.key, scope: input.scope }, "Setting upserted");

  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId ?? null,
      userId: ctx.userId,
      action: "CONFIGURE",
      entityType: "SystemSetting",
      entityId: setting.id,
      description: `Set "${input.key}" = "${input.value}" at scope ${input.scope}`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { key: input.key, value: input.value, scope: input.scope, scopeId: input.scopeId },
    },
  });

  return setting;
}

export async function getSettingsByCategory(
  category: string,
  context?: SettingContext,
): Promise<ResolvedSetting[]> {
  const dbSettings = await prisma.systemSetting.findMany({
    where: { category },
    orderBy: { key: "asc" },
  });

  const keyMap = new Map<string, typeof dbSettings>();
  for (const s of dbSettings) {
    const list = keyMap.get(s.key) ?? [];
    list.push(s);
    keyMap.set(s.key, list);
  }

  for (const [key, def] of Object.entries(SETTING_DEFAULTS)) {
    if (def.category === category && !keyMap.has(key)) {
      keyMap.set(key, []);
    }
  }

  const results: ResolvedSetting[] = [];

  for (const [key] of keyMap) {
    const resolved = await getSetting(key, context);
    if (resolved) {
      results.push(resolved);
    }
  }

  results.sort((a, b) => a.key.localeCompare(b.key));
  return results;
}

export async function getAllSettings(
  context?: SettingContext,
): Promise<Record<string, ResolvedSetting[]>> {
  const dbSettings = await prisma.systemSetting.findMany({
    orderBy: { key: "asc" },
  });

  const categories = new Set<string>();
  for (const s of dbSettings) categories.add(s.category);
  for (const def of Object.values(SETTING_DEFAULTS)) categories.add(def.category);

  const grouped: Record<string, ResolvedSetting[]> = {};
  for (const category of categories) {
    grouped[category] = await getSettingsByCategory(category, context);
  }

  return grouped;
}

export async function deleteSetting(
  key: string,
  scope: string,
  scopeId: string,
  ctx: ServiceContext,
) {
  const setting = await prisma.systemSetting.findUnique({
    where: { key_scope_scopeId: { key, scope, scopeId } },
  });

  if (!setting) return { success: false };

  await prisma.systemSetting.delete({
    where: { key_scope_scopeId: { key, scope, scopeId } },
  });

  logger.info({ key, scope, scopeId }, "Setting deleted");

  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId ?? null,
      userId: ctx.userId,
      action: "CONFIGURE",
      entityType: "SystemSetting",
      entityId: setting.id,
      description: `Deleted setting "${key}" at scope ${scope}`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { key, scope, scopeId },
    },
  });

  return { success: true };
}

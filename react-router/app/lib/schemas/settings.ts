import { z } from "zod/v4";

// ─── Constants ────────────────────────────────────────────

export const SETTING_TYPES = ["string", "number", "boolean", "json"] as const;
export const SETTING_SCOPES = ["global", "tenant", "event", "user"] as const;
export const SETTING_CATEGORIES = ["general", "auth", "email", "upload", "workflow"] as const;

// ─── Setting Schemas ──────────────────────────────────────

export const upsertSettingSchema = z.object({
  key: z
    .string()
    .min(1, "Key is required")
    .max(100, "Key must be at most 100 characters")
    .regex(
      /^[a-z][a-z0-9_.]*$/,
      "Key must start with a lowercase letter and contain only lowercase letters, digits, underscores, and dots",
    ),
  value: z.string(),
  type: z.enum(SETTING_TYPES).default("string"),
  category: z.enum(SETTING_CATEGORIES),
  scope: z.enum(SETTING_SCOPES).default("global"),
  scopeId: z.string().default(""),
});

export type UpsertSettingInput = z.infer<typeof upsertSettingSchema>;

// ─── Feature Flag Schemas ─────────────────────────────────

export const updateFlagSchema = z.object({
  enabled: z.boolean().optional(),
  description: z.string().max(500, "Description must be at most 500 characters").optional(),
  enabledForTenants: z.array(z.string()).optional(),
  enabledForRoles: z.array(z.string()).optional(),
  enabledForUsers: z.array(z.string()).optional(),
});

export type UpdateFlagInput = z.infer<typeof updateFlagSchema>;

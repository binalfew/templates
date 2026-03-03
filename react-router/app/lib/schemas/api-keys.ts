import { z } from "zod/v4";

export const createApiKeySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  permissions: z.string().min(1, "At least one permission is required"),
  rateLimitTier: z.enum(["STANDARD", "ELEVATED", "PREMIUM", "CUSTOM"]).default("STANDARD"),
  rateLimitCustom: z.coerce.number().int().min(1).optional(),
  expiresAt: z.string().optional(),
  allowedIps: z.string().optional(),
});

export const updateApiKeySchema = createApiKeySchema.partial();

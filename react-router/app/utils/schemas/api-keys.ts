import { z } from "zod/v4";

export const createApiKeySchema = z.object({
  name: z.string({ error: "Name is required" }).min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  permissions: z
    .array(z.string())
    .min(1, "At least one permission is required"),
  rateLimitTier: z.coerce.number().int().min(1).default(100),
  expiresIn: z.string().optional(),
  allowedIps: z.string().optional(),
});

export const updateApiKeySchema = createApiKeySchema.partial();

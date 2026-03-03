import { z } from "zod/v4";

export const ENTITY_TYPES_LIST = ["Generic", "User", "Tenant"] as const;

export const createSectionTemplateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  entityType: z.enum(ENTITY_TYPES_LIST).optional().default("Generic"),
});

export const updateSectionTemplateSchema = createSectionTemplateSchema;

export type CreateSectionTemplateInput = z.infer<typeof createSectionTemplateSchema>;
export type UpdateSectionTemplateInput = z.infer<typeof updateSectionTemplateSchema>;

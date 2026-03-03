import { z } from "zod/v4";

const FIELD_DATA_TYPES = [
  "TEXT", "LONG_TEXT", "NUMBER", "BOOLEAN", "DATE", "DATETIME",
  "ENUM", "MULTI_ENUM", "EMAIL", "URL", "PHONE",
  "FILE", "IMAGE", "REFERENCE", "FORMULA", "JSON",
] as const;

export const fieldNameSchema = z.string().min(1).max(64).regex(/^[a-z][a-z0-9_]*$/);

export const createFieldSchema = z.object({
  entityType: z.string().default("Generic"),
  name: fieldNameSchema,
  label: z.string().min(1).max(128),
  description: z.string().max(500).optional(),
  dataType: z.enum(FIELD_DATA_TYPES),
  isRequired: z.coerce.boolean().default(false),
  isUnique: z.coerce.boolean().default(false),
  isSearchable: z.coerce.boolean().default(false),
  isFilterable: z.coerce.boolean().default(false),
  defaultValue: z.string().optional(),
  config: z.record(z.string(), z.unknown()).default({}),
  validation: z.array(z.record(z.string(), z.unknown())).default([]),
});

export const updateFieldSchema = createFieldSchema.partial();

export const reorderFieldsSchema = z.object({
  fieldIds: z.array(z.string()).min(1),
});

export type CreateFieldInput = z.infer<typeof createFieldSchema>;
export type UpdateFieldInput = z.infer<typeof updateFieldSchema>;
export type ReorderFieldsInput = z.infer<typeof reorderFieldsSchema>;
export { FIELD_DATA_TYPES };

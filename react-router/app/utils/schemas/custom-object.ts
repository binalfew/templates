import { z } from "zod/v4";

export const SLUG_REGEX = /^[a-z][a-z0-9_-]*$/;

export const createCustomObjectSchema = z.object({
  name: z
    .string({ error: "Name is required" })
    .min(1, "Name is required")
    .max(100, "Name must be at most 100 characters"),
  slug: z
    .string({ error: "Slug is required" })
    .min(1, "Slug is required")
    .max(100, "Slug must be at most 100 characters")
    .regex(
      SLUG_REGEX,
      "Slug must start with a letter and contain only lowercase letters, numbers, hyphens, and underscores",
    ),
  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .optional()
    .default(""),
});

export type CreateCustomObjectInput = z.infer<typeof createCustomObjectSchema>;

export const updateCustomObjectSchema = z.object({
  name: z
    .string({ error: "Name is required" })
    .min(1, "Name is required")
    .max(100, "Name must be at most 100 characters"),
  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .optional()
    .default(""),
});

export type UpdateCustomObjectInput = z.infer<typeof updateCustomObjectSchema>;

// ─── Add Field (inline on object detail page) ──────────

const ADD_FIELD_DATA_TYPES = ["TEXT", "NUMBER", "BOOLEAN", "DATE", "EMAIL", "URL", "PHONE"] as const;

export const addFieldSchema = z.object({
  fieldName: z
    .string({ error: "Name is required" })
    .min(1, "Name is required")
    .max(50, "Name must be at most 50 characters")
    .regex(
      /^[a-z][a-z0-9_]*$/,
      "Must start with a letter and contain only lowercase letters, numbers, and underscores",
    ),
  fieldLabel: z
    .string({ error: "Label is required" })
    .min(1, "Label is required")
    .max(100, "Label must be at most 100 characters"),
  fieldType: z.enum(ADD_FIELD_DATA_TYPES),
  fieldRequired: z.string().optional(),
});

export { ADD_FIELD_DATA_TYPES };

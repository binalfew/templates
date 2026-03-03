import { z } from "zod/v4";

export const SLUG_REGEX = /^[a-z][a-z0-9_-]*$/;

export const createCustomObjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be at most 100 characters"),
  slug: z
    .string()
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
  name: z.string().min(1, "Name is required").max(100, "Name must be at most 100 characters"),
  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .optional()
    .default(""),
});

export type UpdateCustomObjectInput = z.infer<typeof updateCustomObjectSchema>;

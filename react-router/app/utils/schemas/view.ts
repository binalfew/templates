import { z } from "zod/v4";

export const createViewSchema = z.object({
  name: z
    .string({ error: "Name is required" })
    .min(1, "Name is required")
    .max(100, "Name must be at most 100 characters"),
  entityType: z
    .string({ error: "Entity type is required" })
    .min(1, "Entity type is required"),
  viewType: z.enum(["TABLE", "KANBAN", "CALENDAR", "GALLERY"]).default("TABLE"),
  isShared: z.boolean().default(false),
});

export type CreateViewInput = z.infer<typeof createViewSchema>;

export const updateViewSchema = z.object({
  name: z
    .string({ error: "Name is required" })
    .min(1, "Name is required")
    .max(100, "Name must be at most 100 characters"),
  viewType: z.enum(["TABLE", "KANBAN", "CALENDAR", "GALLERY"]).default("TABLE"),
  isShared: z.boolean().default(false),
  isDefault: z.boolean().default(false),
});

export type UpdateViewInput = z.infer<typeof updateViewSchema>;

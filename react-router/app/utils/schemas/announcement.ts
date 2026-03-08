import { z } from "zod/v4";

export const createAnnouncementSchema = z.object({
  title: z
    .string({ error: "Title is required" })
    .min(1, "Title is required")
    .max(200, "Title must be at most 200 characters"),
  message: z
    .string({ error: "Message is required" })
    .min(1, "Message is required")
    .max(2000, "Message must be at most 2000 characters"),
  type: z.enum(["INFO", "WARNING", "CRITICAL"]).default("INFO"),
  active: z.boolean().default(true),
  dismissible: z.boolean().default(true),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
});

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;

export const updateAnnouncementSchema = createAnnouncementSchema;

export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;

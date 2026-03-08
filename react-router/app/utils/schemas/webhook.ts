import { z } from "zod/v4";

export const createWebhookSchema = z.object({
  url: z
    .string({ error: "URL is required" })
    .min(1, "URL is required")
    .url("Must be a valid URL"),
  description: z.string().max(500, "Description must be at most 500 characters").optional().default(""),
  events: z
    .array(z.string())
    .min(1, "At least one event type is required"),
  headers: z
    .string()
    .optional()
    .default("")
    .refine(
      (val) => {
        if (!val) return true;
        try {
          JSON.parse(val);
          return true;
        } catch {
          return false;
        }
      },
      { message: "Headers must be valid JSON" },
    ),
});

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;

export const updateWebhookSchema = createWebhookSchema;

export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;

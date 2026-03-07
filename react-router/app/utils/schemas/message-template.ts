import { z } from "zod/v4";

const MESSAGE_CHANNELS = ["EMAIL", "SMS", "PUSH", "IN_APP"] as const;

export const createTemplateSchema = z.object({
  name: z.string({ error: "Name is required" }).min(1, "Name is required").max(100),
  subject: z.string().max(200).optional(),
  body: z.string({ error: "Body is required" }).min(1, "Body is required").max(10000),
  channel: z.enum(MESSAGE_CHANNELS),
  variables: z.array(z.string().min(1)).default([]),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
/** For PATCH-style partial updates. The edit UI uses createTemplateSchema since all fields are required. */
export const updateTemplateSchema = createTemplateSchema.partial();
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export { MESSAGE_CHANNELS };

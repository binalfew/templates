import { z } from "zod/v4";
import { MESSAGE_CHANNELS } from "./message-template";

export const audienceFilterSchema = z.object({
  roles: z.array(z.string()).optional(),
  statuses: z.array(z.string()).optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export type AudienceFilter = z.infer<typeof audienceFilterSchema>;

export const createBroadcastSchema = z.object({
  subject: z.string().max(200).optional(),
  body: z.string({ error: "Body is required" }).min(1, "Body is required").max(50000),
  channel: z.enum(MESSAGE_CHANNELS),
  filters: audienceFilterSchema.optional(),
  templateId: z.string().optional(),
  scheduledAt: z.coerce.date().optional(),
});

export type CreateBroadcastInput = z.infer<typeof createBroadcastSchema>;

export const updateBroadcastSchema = createBroadcastSchema.pick({
  subject: true,
  body: true,
  channel: true,
  templateId: true,
});

export type UpdateBroadcastInput = z.infer<typeof updateBroadcastSchema>;

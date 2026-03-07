import { z } from "zod/v4";

export const exportSchema = z.object({
  entity: z.enum(["users", "roles", "custom-object-records"]),
  format: z.enum(["csv", "json"]).default("csv"),
  objectId: z.string().optional(),
});

export const importSchema = z.object({
  entity: z.enum(["users", "roles", "custom-object-records"]),
  dryRun: z.preprocess((v) => v === "true" || v === true, z.boolean()).default(false),
  objectId: z.string().optional(),
});

export type ExportInput = z.infer<typeof exportSchema>;
export type ImportInput = z.infer<typeof importSchema>;

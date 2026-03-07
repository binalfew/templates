import { z } from "zod/v4";

export const exportSchema = z.object({
  entity: z.enum(["users", "roles"]),
  format: z.enum(["csv", "json"]).default("csv"),
});

export const importSchema = z.object({
  entity: z.enum(["users", "roles"]),
  dryRun: z.preprocess((v) => v === "true" || v === true, z.boolean()).default(false),
});

export type ExportInput = z.infer<typeof exportSchema>;
export type ImportInput = z.infer<typeof importSchema>;

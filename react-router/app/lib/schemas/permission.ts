import { z } from "zod/v4";

export const createPermissionSchema = z.object({
  resource: z
    .string()
    .min(1, "Resource is required")
    .max(100, "Resource must be at most 100 characters"),
  action: z.string().min(1, "Action is required").max(100, "Action must be at most 100 characters"),
  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .optional()
    .default(""),
});

export type CreatePermissionInput = z.infer<typeof createPermissionSchema>;

export const updatePermissionSchema = z.object({
  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .optional()
    .default(""),
});

export type UpdatePermissionInput = z.infer<typeof updatePermissionSchema>;

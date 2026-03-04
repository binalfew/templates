import { z } from "zod/v4";

const USER_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED"] as const;
const UPDATE_USER_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED", "LOCKED"] as const;

// ─── Signup Schemas ─────────────────────────────────────

export const SignupEmailSchema = z
  .string({ error: "Email is required" })
  .email("Please enter a valid email address")
  .min(3)
  .max(100)
  .transform((v) => v.toLowerCase().trim());

export const SignupUsernameSchema = z
  .string({ error: "Username is required" })
  .min(3, "Username must be at least 3 characters")
  .max(50, "Username must be at most 50 characters")
  .regex(/^[a-zA-Z0-9_@.\-]+$/, "Only letters, numbers, _, @, ., - allowed")
  .transform((v) => v.toLowerCase().trim());

export const SignupPasswordSchema = z
  .string({ error: "Password is required" })
  .min(8, "Password must be at least 8 characters")
  .max(100, "Password must be at most 100 characters")
  .regex(/[A-Z]/, "Must contain an uppercase letter")
  .regex(/[a-z]/, "Must contain a lowercase letter")
  .regex(/[0-9]/, "Must contain a digit")
  .regex(/[^a-zA-Z0-9]/, "Must contain a special character");

export const SignupNameSchema = z
  .string({ error: "Name is required" })
  .min(1, "Name is required")
  .max(100, "Name must be at most 100 characters")
  .transform((v) => v.trim());

// ─── Admin Schemas ──────────────────────────────────────

export const createUserSchema = z.object({
  email: z
    .string({ error: "Email is required" })
    .min(1, "Email is required")
    .email("Invalid email address"),
  username: z
    .string({ error: "Username is required" })
    .min(3, "Username must be at least 3 characters")
    .max(50, "Username must be at most 50 characters"),
  name: z.string().optional().default(""),
  status: z.enum(USER_STATUSES).optional().default("ACTIVE"),
  password: z
    .string({ error: "Password is required" })
    .min(8, "Password must be at least 8 characters"),
  tenantId: z.string().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  email: z
    .string({ error: "Email is required" })
    .min(1, "Email is required")
    .email("Invalid email address"),
  username: z
    .string({ error: "Username is required" })
    .min(3, "Username must be at least 3 characters")
    .max(50, "Username must be at most 50 characters"),
  name: z.string().optional().default(""),
  status: z.enum(UPDATE_USER_STATUSES).optional().default("ACTIVE"),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const changePasswordSchema = z.object({
  newPassword: z
    .string({ error: "Password is required" })
    .min(8, "Password must be at least 8 characters"),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

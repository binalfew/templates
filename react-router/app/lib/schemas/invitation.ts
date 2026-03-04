import { z } from "zod/v4";

export const inviteUserSchema = z.object({
  email: z.email("Please enter a valid email address"),
  roleIds: z.array(z.string()).min(1, "Select at least one role"),
});

export const acceptInviteSchema = z.object({
  token: z.string({ error: "Token is required" }).min(1, "Token is required"),
  name: z.string({ error: "Name is required" }).min(1, "Name is required").max(100),
  username: z
    .string({ error: "Username is required" })
    .min(3, "Username must be at least 3 characters")
    .max(30)
    .regex(/^[a-zA-Z0-9_-]+$/, "Only letters, numbers, hyphens, and underscores"),
  password: z
    .string({ error: "Password is required" })
    .min(8, "Password must be at least 8 characters")
    .max(100)
    .regex(/[A-Z]/, "Must contain an uppercase letter")
    .regex(/[a-z]/, "Must contain a lowercase letter")
    .regex(/[0-9]/, "Must contain a digit")
    .regex(/[^A-Za-z0-9]/, "Must contain a special character"),
});

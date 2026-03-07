import { z } from "zod/v4";

// ─── Profile ────────────────────────────────────────────

export const profileSchema = z.object({
  name: z.string({ error: "Name is required" }).min(1, "Name is required").max(200),
  username: z
    .string({ error: "Username is required" })
    .min(3, "Username must be at least 3 characters")
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/, "Only letters, numbers, hyphens, and underscores"),
  photoUrl: z.string().optional(),
});

// ─── Change Password ────────────────────────────────────

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ error: "Current password is required" })
      .min(1, "Current password is required"),
    newPassword: z
      .string({ error: "New password is required" })
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain an uppercase letter")
      .regex(/[a-z]/, "Must contain a lowercase letter")
      .regex(/[0-9]/, "Must contain a number")
      .regex(/[^A-Za-z0-9]/, "Must contain a special character"),
    confirmPassword: z
      .string({ error: "Please confirm your password" })
      .min(1, "Please confirm your password"),
  })
  .refine((val) => val.newPassword === val.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// ─── Change Email ───────────────────────────────────────

export const changeEmailSchema = z.object({
  newEmail: z.email("Please enter a valid email address"),
});

// ─── Verify Email (Profile) ────────────────────────────

export const verifyProfileEmailSchema = z.object({
  code: z
    .string({ error: "Code is required" })
    .min(6, "Code must be 6 characters")
    .max(6, "Code must be 6 characters"),
  intent: z.enum(["verify", "resend"]),
});

// ─── Two-Factor Verify (Profile) ───────────────────────

export const profileTwoFAVerifySchema = z.object({
  code: z
    .string({ error: "Code is required" })
    .min(6, "Code must be 6 digits")
    .max(6, "Code must be 6 digits"),
  intent: z.enum(["verify", "cancel"]),
});

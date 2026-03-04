import { z } from "zod/v4";
import { SignupEmailSchema, SignupUsernameSchema, SignupNameSchema, SignupPasswordSchema } from "./user";

// ─── Login ──────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.email("Please enter a valid email address"),
  password: z.string({ error: "Password is required" }).min(1, "Password is required"),
  redirectTo: z.string().optional(),
});

// ─── Signup ─────────────────────────────────────────────

export const signupSchema = z.object({
  email: SignupEmailSchema,
});

// ─── Onboarding ─────────────────────────────────────────

export const onboardingSchema = z
  .object({
    username: SignupUsernameSchema,
    name: SignupNameSchema,
    password: SignupPasswordSchema,
    confirmPassword: z
      .string({ error: "Please confirm your password" })
      .min(1, "Please confirm your password"),
    agreeToTerms: z.preprocess(
      (v) => v === "on" || v === true,
      z.boolean().refine((v) => v === true, "You must agree to the terms"),
    ),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

// ─── Email Verification ────────────────────────────────

export const verifyEmailSchema = z.object({
  code: z
    .string({ error: "Code is required" })
    .min(6, "Code must be 6 characters")
    .max(6, "Code must be 6 characters"),
  intent: z.enum(["verify", "resend"]),
});

// ─── Two-Factor Authentication ─────────────────────────

export const twoFAVerifySchema = z.object({
  code: z
    .string({ error: "Code is required" })
    .min(6, "Code must be 6 digits")
    .max(6, "Code must be 6 digits"),
});

export const twoFASetupSchema = z.object({
  code: z
    .string({ error: "Code is required" })
    .min(6, "Code must be 6 digits")
    .max(6, "Code must be 6 digits"),
});

export const twoFARecoverySchema = z.object({
  code: z
    .string({ error: "Recovery code is required" })
    .min(1, "Recovery code is required"),
});

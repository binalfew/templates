import { z } from "zod/v4";

const SUBSCRIPTION_PLANS = ["free", "starter", "professional", "enterprise"] as const;

const RESERVED_SLUGS = ["auth", "api", "kiosk", "delegation", "resources", "up"];

const slugField = z
  .string({ error: "Slug is required" })
  .min(1, "Slug is required")
  .max(50, "Slug must be at most 50 characters")
  .regex(
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/,
    "Slug must be lowercase alphanumeric with hyphens only, cannot start or end with a hyphen",
  )
  .refine((val) => !RESERVED_SLUGS.includes(val), "This slug is reserved and cannot be used");

/**
 * Available brand themes — each maps to a [data-brand="..."] block in app.css
 * with complete light + dark variable overrides.
 */
export const BRAND_THEMES = [
  { value: "", label: "None (default)" },
  { value: "nature", label: "Nature" },
  { value: "quantum", label: "Quantum" },
  { value: "haze", label: "Haze" },
  { value: "graphite", label: "Graphite" },
  { value: "tangerine", label: "Tangerine" },
  { value: "matter", label: "Matter" },
  { value: "vercel", label: "Vercel" },
  { value: "claude", label: "Claude" },
  { value: "catppuccin", label: "Catppuccin" },
  { value: "slate", label: "Slate" },
  { value: "cosmic", label: "Cosmic" },
  { value: "elegant", label: "Elegant" },
  { value: "mono", label: "Mono" },
  { value: "auc", label: "AUC" },
] as const;

export const createTenantSchema = z
  .object({
    name: z
      .string({ error: "Name is required" })
      .min(1, "Name is required")
      .max(200, "Name must be at most 200 characters"),
    slug: slugField,
    email: z
      .string({ error: "Email is required" })
      .min(1, "Email is required")
      .email("Invalid email address"),
    phone: z.string({ error: "Phone is required" }).min(1, "Phone is required"),
    website: z.string().url("Invalid URL").optional().or(z.literal("")),
    address: z.string().optional().default(""),
    city: z.string().optional().default(""),
    state: z.string().optional().default(""),
    zip: z.string().optional().default(""),
    country: z.string().optional().default(""),
    subscriptionPlan: z.enum(SUBSCRIPTION_PLANS).optional().default("free"),
    logoUrl: z.string().optional().or(z.literal("")),
    brandTheme: z.string().optional().or(z.literal("")),
    // Initial admin user (optional — skip if all empty)
    adminEmail: z.string().email("Invalid admin email").optional().or(z.literal("")),
    adminName: z.string().optional().or(z.literal("")),
    adminPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .optional()
      .or(z.literal("")),
  })
  .refine(
    (data) => {
      const hasEmail = data.adminEmail && data.adminEmail.length > 0;
      const hasPassword = data.adminPassword && data.adminPassword.length > 0;
      // If either is provided, both must be provided
      if (hasEmail && !hasPassword) return false;
      if (!hasEmail && hasPassword) return false;
      return true;
    },
    {
      message: "Both admin email and password are required to create an initial administrator",
      path: ["adminEmail"],
    },
  );

export type CreateTenantInput = z.infer<typeof createTenantSchema>;

export const updateTenantSchema = z.object({
  name: z
    .string({ error: "Name is required" })
    .min(1, "Name is required")
    .max(200, "Name must be at most 200 characters"),
  slug: slugField,
  email: z
    .string({ error: "Email is required" })
    .min(1, "Email is required")
    .email("Invalid email address"),
  phone: z.string({ error: "Phone is required" }).min(1, "Phone is required"),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
  address: z.string().optional().default(""),
  city: z.string().optional().default(""),
  state: z.string().optional().default(""),
  zip: z.string().optional().default(""),
  country: z.string().optional().default(""),
  subscriptionPlan: z.enum(SUBSCRIPTION_PLANS),
  logoUrl: z.string().optional().or(z.literal("")),
  brandTheme: z.string().optional().or(z.literal("")),
});

export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;

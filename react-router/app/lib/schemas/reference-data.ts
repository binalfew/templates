import { z } from "zod/v4";

// ─── Country ─────────────────────────────────────────────

export const createCountrySchema = z.object({
  code: z.string().min(2, "Code is required").max(2, "Must be 2 characters"),
  name: z.string().min(1, "Name is required").max(200),
  alpha3: z.string().max(3).optional().default(""),
  numericCode: z.string().max(3).optional().default(""),
  phoneCode: z.string().max(15).optional().default(""),
  flag: z.string().max(10).optional().default(""),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.coerce.boolean().default(true),
});
export type CreateCountryInput = z.infer<typeof createCountrySchema>;

export const updateCountrySchema = createCountrySchema;
export type UpdateCountryInput = z.infer<typeof updateCountrySchema>;

// ─── Title ───────────────────────────────────────────────

export const createTitleSchema = z.object({
  code: z.string().min(1, "Code is required").max(20),
  name: z.string().min(1, "Name is required").max(200),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.coerce.boolean().default(true),
});
export type CreateTitleInput = z.infer<typeof createTitleSchema>;

export const updateTitleSchema = createTitleSchema;
export type UpdateTitleInput = z.infer<typeof updateTitleSchema>;

// ─── Language ────────────────────────────────────────────

export const createLanguageSchema = z.object({
  code: z.string().min(2, "Code is required").max(5),
  name: z.string().min(1, "Name is required").max(200),
  nativeName: z.string().max(200).optional().default(""),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.coerce.boolean().default(true),
});
export type CreateLanguageInput = z.infer<typeof createLanguageSchema>;

export const updateLanguageSchema = createLanguageSchema;
export type UpdateLanguageInput = z.infer<typeof updateLanguageSchema>;

// ─── Currency ────────────────────────────────────────────

export const createCurrencySchema = z.object({
  code: z.string().min(3, "Code is required").max(3, "Must be 3 characters"),
  name: z.string().min(1, "Name is required").max(200),
  symbol: z.string().max(10).optional().default(""),
  decimalDigits: z.coerce.number().int().min(0).max(4).default(2),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.coerce.boolean().default(true),
});
export type CreateCurrencyInput = z.infer<typeof createCurrencySchema>;

export const updateCurrencySchema = createCurrencySchema;
export type UpdateCurrencyInput = z.infer<typeof updateCurrencySchema>;

// ─── Document Type ───────────────────────────────────────

export const createDocumentTypeSchema = z.object({
  code: z.string().min(1, "Code is required").max(50),
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(500).optional().default(""),
  category: z.string().max(100).optional().default(""),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.coerce.boolean().default(true),
});
export type CreateDocumentTypeInput = z.infer<typeof createDocumentTypeSchema>;

export const updateDocumentTypeSchema = createDocumentTypeSchema;
export type UpdateDocumentTypeInput = z.infer<typeof updateDocumentTypeSchema>;

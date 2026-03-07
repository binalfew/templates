import { z } from "zod/v4";
import type { FieldDefinition } from "~/generated/prisma/client";
import type { FormDefinition } from "~/types/form-designer";

// ── Types ────────────────────────────────────────────────────────────────────

interface ValidationRule {
  rule: string;
  value?: unknown;
  message: string;
}

interface FieldConfig {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  options?: Array<{ value: string; label: string }>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getConfig(field: FieldDefinition): FieldConfig {
  if (field.config && typeof field.config === "object" && !Array.isArray(field.config)) {
    return field.config as unknown as FieldConfig;
  }
  return {};
}

function getValidation(field: FieldDefinition): ValidationRule[] {
  if (Array.isArray(field.validation)) {
    return field.validation as unknown as ValidationRule[];
  }
  return [];
}

function buildBaseZodType(field: FieldDefinition): z.ZodTypeAny {
  const config = getConfig(field);

  switch (field.dataType) {
    case "TEXT": {
      let s = z.string();
      if (config.minLength != null)
        s = s.min(
          config.minLength,
          `${field.label} must be at least ${config.minLength} characters`,
        );
      if (config.maxLength != null)
        s = s.max(
          config.maxLength,
          `${field.label} must be at most ${config.maxLength} characters`,
        );
      if (config.pattern)
        s = s.regex(new RegExp(config.pattern), `${field.label} has an invalid format`);
      return s;
    }

    case "LONG_TEXT": {
      let s = z.string();
      if (config.maxLength != null)
        s = s.max(
          config.maxLength,
          `${field.label} must be at most ${config.maxLength} characters`,
        );
      return s;
    }

    case "NUMBER": {
      let n = z.number({ error: `${field.label} must be a number` });
      if (config.min != null)
        n = n.min(config.min, `${field.label} must be at least ${config.min}`);
      if (config.max != null) n = n.max(config.max, `${field.label} must be at most ${config.max}`);
      return n;
    }

    case "BOOLEAN":
      return z.boolean();

    case "DATE":
      return z
        .string({ error: `${field.label} must be a valid date` })
        .date(`${field.label} must be a valid date`);

    case "DATETIME":
      return z
        .string({ error: `${field.label} must be a valid datetime` })
        .datetime(`${field.label} must be a valid datetime`);

    case "ENUM": {
      const options = config.options?.map((o) => o.value) ?? [];
      if (options.length === 0) return z.string();
      return z.enum(options as [string, ...string[]], {
        error: `${field.label} must be one of: ${options.join(", ")}`,
      });
    }

    case "MULTI_ENUM": {
      const options = config.options?.map((o) => o.value) ?? [];
      if (options.length === 0) return z.array(z.string());
      return z.array(
        z.enum(options as [string, ...string[]], {
          error: `${field.label} must be one of: ${options.join(", ")}`,
        }),
      );
    }

    case "EMAIL":
      return z.string().email(`${field.label} must be a valid email address`);

    case "URL":
      return z.string().url(`${field.label} must be a valid URL`);

    case "PHONE":
      return z
        .string()
        .min(7, `${field.label} must be at least 7 characters`)
        .max(20, `${field.label} must be at most 20 characters`);

    case "FILE":
    case "IMAGE":
    case "REFERENCE":
      return z.string();

    case "FORMULA":
      return z.any();

    case "JSON":
      return z.unknown();

    default:
      return z.unknown();
  }
}

function applyValidationRules(schema: z.ZodTypeAny, field: FieldDefinition): z.ZodTypeAny {
  const rules = getValidation(field);
  let result = schema;

  for (const rule of rules) {
    if (rule.rule === "regex" && typeof rule.value === "string") {
      result = result.refine(
        (val: unknown) => {
          if (val == null) return true;
          return new RegExp(rule.value as string).test(String(val));
        },
        { message: rule.message },
      );
    } else if (rule.rule === "min" && typeof rule.value === "number") {
      result = result.refine(
        (val: unknown) => {
          if (val == null) return true;
          return Number(val) >= (rule.value as number);
        },
        { message: rule.message },
      );
    } else if (rule.rule === "max" && typeof rule.value === "number") {
      result = result.refine(
        (val: unknown) => {
          if (val == null) return true;
          return Number(val) <= (rule.value as number);
        },
        { message: rule.message },
      );
    }
  }

  return result;
}

// ── Utility ──────────────────────────────────────────────────────────────────

/**
 * Walk a FormDefinition and collect all unique fieldDefinitionId strings.
 */
export function collectFieldDefIds(definition: FormDefinition): string[] {
  const ids = new Set<string>();
  for (const page of definition.pages) {
    for (const section of page.sections) {
      for (const field of section.fields) {
        ids.add(field.fieldDefinitionId);
      }
    }
  }
  return [...ids];
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Build a Zod schema from an array of FieldDefinition records.
 * Each field definition maps to a Zod validator based on its dataType and config.
 *
 * This is a shared (non-server) module so it can be used in both
 * server loaders/actions and client-side form validation.
 */
export function buildFieldSchema(
  fieldDefs: FieldDefinition[],
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fieldDefs) {
    let fieldSchema = buildBaseZodType(field);
    fieldSchema = applyValidationRules(fieldSchema, field);

    if (!field.isRequired) {
      fieldSchema = fieldSchema.optional();
    }

    shape[field.name] = fieldSchema;
  }

  return z.object(shape);
}

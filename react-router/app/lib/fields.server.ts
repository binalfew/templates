import { z } from "zod/v4";
import type { FieldDefinition } from "~/generated/prisma/client";
import { buildFieldSchema } from "./fields";

// Re-export shared functions so existing server imports continue to work
export { buildFieldSchema, collectFieldDefIds } from "./fields";

// ── Types ────────────────────────────────────────────────────────────────────

interface FieldConfig {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  options?: Array<{ value: string; label: string }>;
}

interface ConformConstraint {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
}

// ── Schema Cache ─────────────────────────────────────────────────────────────

const schemaCache = new Map<
  string,
  { schema: z.ZodObject<Record<string, z.ZodTypeAny>>; hash: string }
>();
const MAX_CACHE_SIZE = 1000;

function computeHash(fieldDefs: FieldDefinition[]): string {
  return fieldDefs
    .map((f) => f.id + f.updatedAt.toISOString())
    .sort()
    .join("|");
}

function evictOldest(): void {
  if (schemaCache.size >= MAX_CACHE_SIZE) {
    const firstKey = schemaCache.keys().next().value;
    if (firstKey !== undefined) {
      schemaCache.delete(firstKey);
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getConfig(field: FieldDefinition): FieldConfig {
  if (field.config && typeof field.config === "object" && !Array.isArray(field.config)) {
    return field.config as unknown as FieldConfig;
  }
  return {};
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse raw form data into typed values based on field definitions.
 * HTML forms submit everything as strings — this coerces to the correct types.
 */
export function parseFieldFormData(
  formData: FormData,
  fieldDefs: FieldDefinition[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const field of fieldDefs) {
    if (field.dataType === "FORMULA") continue;

    if (field.dataType === "MULTI_ENUM") {
      result[field.name] = formData.getAll(field.name).filter((v) => v !== "");
      continue;
    }

    const raw = formData.get(field.name);

    if (raw == null || raw === "") {
      if (field.dataType === "BOOLEAN") {
        result[field.name] = false;
      } else {
        result[field.name] = undefined;
      }
      continue;
    }

    const value = String(raw);

    switch (field.dataType) {
      case "NUMBER": {
        const num = Number(value);
        result[field.name] = Number.isNaN(num) ? undefined : num;
        break;
      }

      case "BOOLEAN":
        result[field.name] = value === "on" || value === "true" || value === "1";
        break;

      case "JSON": {
        try {
          result[field.name] = JSON.parse(value);
        } catch {
          result[field.name] = value;
        }
        break;
      }

      default:
        result[field.name] = value;
        break;
    }
  }

  return result;
}

/**
 * Get or build a cached Zod schema for a set of field definitions.
 * Cache key is based on tenant + entity type.
 * LRU eviction when cache exceeds 1000 entries.
 */
export function getCachedSchema(
  tenantId: string,
  entityType: string,
  fieldDefs: FieldDefinition[],
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const cacheKey = `${tenantId}:${entityType}`;
  const hash = computeHash(fieldDefs);

  const cached = schemaCache.get(cacheKey);
  if (cached && cached.hash === hash) {
    return cached.schema;
  }

  const schema = buildFieldSchema(fieldDefs);

  // LRU eviction: delete oldest entry if at capacity
  evictOldest();

  // Delete stale entry if exists, then re-insert (moves to end of Map insertion order)
  schemaCache.delete(cacheKey);
  schemaCache.set(cacheKey, { schema, hash });

  return schema;
}

/**
 * Build Conform field constraints for use with useForm().
 * Returns the constraint object that Conform uses for client-side hints.
 */
export function buildConformConstraints(
  fieldDefs: FieldDefinition[],
): Record<string, ConformConstraint> {
  const constraints: Record<string, ConformConstraint> = {};

  for (const field of fieldDefs) {
    const config = getConfig(field);
    const constraint: ConformConstraint = {};

    if (field.isRequired) {
      constraint.required = true;
    }

    if (config.minLength != null) constraint.minLength = config.minLength;
    if (config.maxLength != null) constraint.maxLength = config.maxLength;
    if (config.min != null) constraint.min = config.min;
    if (config.max != null) constraint.max = config.max;
    if (config.pattern != null) constraint.pattern = config.pattern;

    constraints[field.name] = constraint;
  }

  return constraints;
}

/**
 * Parse extras form data by stripping a prefix (e.g. "extras.") from FormData keys,
 * then delegating to parseFieldFormData.
 */
export function parseExtrasFormData(
  formData: FormData,
  fieldDefs: FieldDefinition[],
  prefix: string = "extras",
): Record<string, unknown> {
  const prefixed = `${prefix}.`;
  const stripped = new FormData();

  for (const [key, value] of formData.entries()) {
    if (key.startsWith(prefixed)) {
      stripped.append(key.slice(prefixed.length), value);
    }
  }

  return parseFieldFormData(stripped, fieldDefs);
}

// Export for testing
export { schemaCache, MAX_CACHE_SIZE };

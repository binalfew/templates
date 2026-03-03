import type { FieldDefinition } from "~/generated/prisma/client";

// ── Types ────────────────────────────────────────────────────────────────────

export interface FieldConfig {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  rows?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  accept?: string;
  maxSizeMB?: number;
  minDate?: string;
  maxDate?: string;
}

export interface FieldElementDescriptor {
  element: "input" | "textarea" | "select" | "checkbox-group" | "readonly";
  type?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract typed config from a FieldDefinition's JSON config field.
 */
export function getFieldConfig(field: FieldDefinition): FieldConfig {
  if (field.config && typeof field.config === "object" && !Array.isArray(field.config)) {
    return field.config as unknown as FieldConfig;
  }
  return {};
}

/**
 * Sort field definitions by sortOrder ascending, then by name alphabetically as tiebreaker.
 */
export function sortFieldDefs(fields: FieldDefinition[]): FieldDefinition[] {
  return [...fields].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Pure mapping from FieldDataType to the HTML element descriptor.
 */
export function getFieldElementType(dataType: string): FieldElementDescriptor {
  switch (dataType) {
    case "TEXT":
      return { element: "input", type: "text" };
    case "LONG_TEXT":
      return { element: "textarea" };
    case "NUMBER":
      return { element: "input", type: "number" };
    case "BOOLEAN":
      return { element: "input", type: "checkbox" };
    case "DATE":
      return { element: "input", type: "date" };
    case "DATETIME":
      return { element: "input", type: "datetime-local" };
    case "ENUM":
      return { element: "select" };
    case "MULTI_ENUM":
      return { element: "checkbox-group" };
    case "EMAIL":
      return { element: "input", type: "email" };
    case "URL":
      return { element: "input", type: "url" };
    case "PHONE":
      return { element: "input", type: "tel" };
    case "FILE":
      return { element: "input", type: "file" };
    case "IMAGE":
      return { element: "input", type: "file" };
    case "REFERENCE":
      return { element: "input", type: "text" };
    case "FORMULA":
      return { element: "readonly" };
    case "JSON":
      return { element: "textarea" };
    default:
      return { element: "input", type: "text" };
  }
}

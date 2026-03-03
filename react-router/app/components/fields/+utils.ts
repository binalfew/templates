/**
 * Convert a label string to a snake_case field name.
 * "Passport Number" → "passport_number"
 */
export function labelToFieldName(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "_")
    .replace(/^[^a-z]+/, "")
    .replace(/_+$/, "")
    .slice(0, 64);
}

/**
 * Format a FieldDataType enum value for display.
 * "MULTI_ENUM" → "Multi Enum"
 */
export function formatDataType(dataType: string): string {
  return dataType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

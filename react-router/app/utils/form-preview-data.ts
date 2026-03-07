import type { FormDefinition } from "~/types/form-designer";

interface FieldDefinitionLookup {
  id: string;
  name: string;
  label: string;
  dataType: string;
}

/**
 * Generate mock form values keyed by fieldDefinitionId for previewing a form.
 */
export function generateMockData(
  definition: FormDefinition,
  fieldDefinitions: FieldDefinitionLookup[],
): Record<string, unknown> {
  const fdMap = new Map(fieldDefinitions.map((fd) => [fd.id, fd]));
  const values: Record<string, unknown> = {};

  const seenIds = new Set<string>();
  for (const page of definition.pages) {
    for (const section of page.sections) {
      for (const field of section.fields) {
        if (!seenIds.has(field.fieldDefinitionId)) {
          seenIds.add(field.fieldDefinitionId);
          const fd = fdMap.get(field.fieldDefinitionId);
          if (fd) {
            values[fd.id] = generateValueForType(fd.dataType);
          }
        }
      }
    }
  }

  return values;
}

function generateValueForType(dataType: string): unknown {
  switch (dataType) {
    case "TEXT":
      return "Sample text";
    case "LONG_TEXT":
      return "This is a longer piece of sample text that spans multiple lines for preview purposes.";
    case "NUMBER":
      return 42;
    case "BOOLEAN":
      return true;
    case "DATE":
      return "2026-03-15";
    case "DATETIME":
      return "2026-03-15T09:00";
    case "ENUM":
      return "";
    case "MULTI_ENUM":
      return [];
    case "EMAIL":
      return "example@email.com";
    case "URL":
      return "https://example.com";
    case "PHONE":
      return "+1 (555) 123-4567";
    case "FILE":
    case "IMAGE":
      return null;
    case "REFERENCE":
      return "REF-001";
    case "FORMULA":
      return "(computed)";
    case "JSON":
      return '{\n  "key": "value"\n}';
    default:
      return "";
  }
}

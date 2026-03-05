import { describe, it, expect } from "vitest";
import type { FieldDefinition } from "~/generated/prisma/client";
import { getFieldConfig, sortFieldDefs, getFieldElementType } from "~/components/fields/types";

let counter = 0;

function makeField(
  overrides: Partial<FieldDefinition> & { name: string; dataType: string },
): FieldDefinition {
  counter++;
  const { name, dataType, label, ...rest } = overrides;
  return {
    id: `field-${counter}`,
    tenantId: "tenant-1",
    entityType: "Generic",
    description: null,
    sortOrder: 0,
    isRequired: false,
    isUnique: false,
    isSearchable: false,
    isFilterable: false,
    defaultValue: null,
    config: {},
    validation: [],
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...rest,
    name,
    label: label ?? name,
    dataType: dataType as FieldDefinition["dataType"],
  } as FieldDefinition;
}

describe("getFieldConfig", () => {
  it("returns typed config from valid config object", () => {
    const field = makeField({
      name: "test",
      dataType: "TEXT",
      config: { minLength: 2, maxLength: 50, placeholder: "Enter text" },
    });
    const config = getFieldConfig(field);
    expect(config.minLength).toBe(2);
    expect(config.maxLength).toBe(50);
    expect(config.placeholder).toBe("Enter text");
  });

  it("returns empty object for null config", () => {
    const field = makeField({ name: "test", dataType: "TEXT", config: null as unknown as object });
    const config = getFieldConfig(field);
    expect(config).toEqual({});
  });

  it("returns empty object for array config", () => {
    const field = makeField({
      name: "test",
      dataType: "TEXT",
      config: [1, 2, 3] as unknown as object,
    });
    const config = getFieldConfig(field);
    expect(config).toEqual({});
  });

  it("extracts nested options from config", () => {
    const field = makeField({
      name: "priority",
      dataType: "ENUM",
      config: {
        options: [
          { value: "low", label: "Low" },
          { value: "high", label: "High" },
        ],
      },
    });
    const config = getFieldConfig(field);
    expect(config.options).toHaveLength(2);
    expect(config.options![0].value).toBe("low");
    expect(config.options![1].label).toBe("High");
  });
});

describe("getFieldElementType", () => {
  it("TEXT maps to input[type=text]", () => {
    expect(getFieldElementType("TEXT")).toEqual({ element: "input", type: "text" });
  });

  it("LONG_TEXT maps to textarea", () => {
    expect(getFieldElementType("LONG_TEXT")).toEqual({ element: "textarea" });
  });

  it("NUMBER maps to input[type=number]", () => {
    expect(getFieldElementType("NUMBER")).toEqual({ element: "input", type: "number" });
  });

  it("BOOLEAN maps to input[type=checkbox]", () => {
    expect(getFieldElementType("BOOLEAN")).toEqual({ element: "input", type: "checkbox" });
  });

  it("DATE maps to input[type=date]", () => {
    expect(getFieldElementType("DATE")).toEqual({ element: "input", type: "date" });
  });

  it("DATETIME maps to input[type=datetime-local]", () => {
    expect(getFieldElementType("DATETIME")).toEqual({ element: "input", type: "datetime-local" });
  });

  it("ENUM maps to select", () => {
    expect(getFieldElementType("ENUM")).toEqual({ element: "select" });
  });

  it("MULTI_ENUM maps to checkbox-group", () => {
    expect(getFieldElementType("MULTI_ENUM")).toEqual({ element: "checkbox-group" });
  });

  it("EMAIL maps to input[type=email]", () => {
    expect(getFieldElementType("EMAIL")).toEqual({ element: "input", type: "email" });
  });

  it("URL maps to input[type=url]", () => {
    expect(getFieldElementType("URL")).toEqual({ element: "input", type: "url" });
  });

  it("PHONE maps to input[type=tel]", () => {
    expect(getFieldElementType("PHONE")).toEqual({ element: "input", type: "tel" });
  });

  it("FILE maps to input[type=file]", () => {
    expect(getFieldElementType("FILE")).toEqual({ element: "input", type: "file" });
  });

  it("IMAGE maps to input[type=file]", () => {
    expect(getFieldElementType("IMAGE")).toEqual({ element: "input", type: "file" });
  });

  it("REFERENCE maps to input[type=text]", () => {
    expect(getFieldElementType("REFERENCE")).toEqual({ element: "input", type: "text" });
  });

  it("FORMULA maps to readonly", () => {
    expect(getFieldElementType("FORMULA")).toEqual({ element: "readonly" });
  });

  it("JSON maps to textarea", () => {
    expect(getFieldElementType("JSON")).toEqual({ element: "textarea" });
  });

  it("unknown type falls back to input[type=text]", () => {
    expect(getFieldElementType("UNKNOWN_TYPE")).toEqual({ element: "input", type: "text" });
  });
});

describe("sortFieldDefs", () => {
  it("sorts by sortOrder ascending", () => {
    const fields = [
      makeField({ name: "c", dataType: "TEXT", sortOrder: 3 }),
      makeField({ name: "a", dataType: "TEXT", sortOrder: 1 }),
      makeField({ name: "b", dataType: "TEXT", sortOrder: 2 }),
    ];
    const sorted = sortFieldDefs(fields);
    expect(sorted.map((f) => f.name)).toEqual(["a", "b", "c"]);
  });

  it("resolves equal sortOrder by name alphabetically", () => {
    const fields = [
      makeField({ name: "zebra", dataType: "TEXT", sortOrder: 0 }),
      makeField({ name: "alpha", dataType: "TEXT", sortOrder: 0 }),
      makeField({ name: "middle", dataType: "TEXT", sortOrder: 0 }),
    ];
    const sorted = sortFieldDefs(fields);
    expect(sorted.map((f) => f.name)).toEqual(["alpha", "middle", "zebra"]);
  });

  it("returns empty array for empty input", () => {
    expect(sortFieldDefs([])).toEqual([]);
  });

  it("does not mutate the original array", () => {
    const fields = [
      makeField({ name: "b", dataType: "TEXT", sortOrder: 2 }),
      makeField({ name: "a", dataType: "TEXT", sortOrder: 1 }),
    ];
    const original = [...fields];
    sortFieldDefs(fields);
    expect(fields[0].name).toBe(original[0].name);
    expect(fields[1].name).toBe(original[1].name);
  });
});

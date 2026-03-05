import { describe, it, expect } from "vitest";
import { generateMockData } from "~/lib/form-preview-data";
import type { FormDefinition } from "~/types/form-designer";

function makeDefinition(fieldDefIds: string[]): FormDefinition {
  return {
    pages: [
      {
        id: "page-1",
        title: "Page 1",
        order: 0,
        sections: [
          {
            id: "section-1",
            title: "Section 1",
            columns: 2,
            collapsible: false,
            order: 0,
            fields: fieldDefIds.map((id, i) => ({
              id: `field-${i}`,
              fieldDefinitionId: id,
              order: i,
            })),
          },
        ],
      },
    ],
  };
}

const fieldDefs = [
  { id: "fd-text", name: "name", label: "Name", dataType: "TEXT" },
  { id: "fd-number", name: "age", label: "Age", dataType: "NUMBER" },
  { id: "fd-bool", name: "active", label: "Active", dataType: "BOOLEAN" },
  { id: "fd-date", name: "dob", label: "DOB", dataType: "DATE" },
  { id: "fd-email", name: "email", label: "Email", dataType: "EMAIL" },
  { id: "fd-enum", name: "country", label: "Country", dataType: "ENUM" },
  { id: "fd-longtext", name: "bio", label: "Bio", dataType: "LONG_TEXT" },
  { id: "fd-url", name: "website", label: "Website", dataType: "URL" },
  { id: "fd-phone", name: "phone", label: "Phone", dataType: "PHONE" },
  { id: "fd-file", name: "resume", label: "Resume", dataType: "FILE" },
  { id: "fd-formula", name: "calc", label: "Calc", dataType: "FORMULA" },
  { id: "fd-json", name: "meta", label: "Meta", dataType: "JSON" },
  { id: "fd-multi", name: "tags", label: "Tags", dataType: "MULTI_ENUM" },
];

describe("generateMockData", () => {
  it("generates values for all field definitions in the definition", () => {
    const def = makeDefinition(["fd-text", "fd-number", "fd-bool"]);
    const data = generateMockData(def, fieldDefs);

    expect(data["fd-text"]).toBe("Sample text");
    expect(data["fd-number"]).toBe(42);
    expect(data["fd-bool"]).toBe(true);
  });

  it("generates appropriate types for each data type", () => {
    const allIds = fieldDefs.map((fd) => fd.id);
    const def = makeDefinition(allIds);
    const data = generateMockData(def, fieldDefs);

    expect(typeof data["fd-text"]).toBe("string");
    expect(typeof data["fd-number"]).toBe("number");
    expect(typeof data["fd-bool"]).toBe("boolean");
    expect(typeof data["fd-date"]).toBe("string");
    expect(typeof data["fd-email"]).toBe("string");
    expect(data["fd-email"]).toContain("@");
    expect(typeof data["fd-url"]).toBe("string");
    expect(data["fd-url"]).toContain("http");
    expect(typeof data["fd-phone"]).toBe("string");
    expect(data["fd-file"]).toBeNull();
    expect(typeof data["fd-formula"]).toBe("string");
    expect(typeof data["fd-json"]).toBe("string");
    expect(typeof data["fd-longtext"]).toBe("string");
    expect(data["fd-enum"]).toBe("");
    expect(data["fd-multi"]).toEqual([]);
  });

  it("skips fields not in field definitions", () => {
    const def = makeDefinition(["unknown-id"]);
    const data = generateMockData(def, fieldDefs);

    expect(data["unknown-id"]).toBeUndefined();
  });

  it("deduplicates field definitions used multiple times", () => {
    const def: FormDefinition = {
      pages: [
        {
          id: "page-1",
          title: "Page 1",
          order: 0,
          sections: [
            {
              id: "s1",
              title: "S1",
              columns: 2,
              collapsible: false,
              order: 0,
              fields: [{ id: "f1", fieldDefinitionId: "fd-text", order: 0 }],
            },
            {
              id: "s2",
              title: "S2",
              columns: 2,
              collapsible: false,
              order: 1,
              fields: [{ id: "f2", fieldDefinitionId: "fd-text", order: 0 }],
            },
          ],
        },
      ],
    };
    const data = generateMockData(def, fieldDefs);

    expect(Object.keys(data).filter((k) => k === "fd-text")).toHaveLength(1);
    expect(data["fd-text"]).toBe("Sample text");
  });

  it("returns empty object for empty definition", () => {
    const def: FormDefinition = { pages: [] };
    const data = generateMockData(def, fieldDefs);

    expect(data).toEqual({});
  });
});

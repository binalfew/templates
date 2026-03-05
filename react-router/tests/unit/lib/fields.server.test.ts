import { describe, it, expect, beforeEach } from "vitest";
import type { FieldDefinition } from "~/generated/prisma/client";
import {
  buildFieldSchema,
  parseFieldFormData,
  getCachedSchema,
  buildConformConstraints,
  schemaCache,
} from "~/lib/fields.server";

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

describe("buildFieldSchema", () => {
  describe("type mapping", () => {
    it("TEXT produces a string validator", () => {
      const schema = buildFieldSchema([makeField({ name: "title", dataType: "TEXT" })]);
      expect(schema.safeParse({ title: "hello" }).success).toBe(true);
      expect(schema.safeParse({ title: 123 }).success).toBe(false);
    });

    it("TEXT with config constraints", () => {
      const schema = buildFieldSchema([
        makeField({
          name: "code",
          dataType: "TEXT",
          label: "Code",
          config: { minLength: 2, maxLength: 5, pattern: "^[A-Z]+$" },
        }),
      ]);
      expect(schema.safeParse({ code: "AB" }).success).toBe(true);
      expect(schema.safeParse({ code: "A" }).success).toBe(false);
      expect(schema.safeParse({ code: "ABCDEF" }).success).toBe(false);
      expect(schema.safeParse({ code: "abc" }).success).toBe(false);
    });

    it("LONG_TEXT produces a string validator with maxLength", () => {
      const schema = buildFieldSchema([
        makeField({ name: "bio", dataType: "LONG_TEXT", config: { maxLength: 10 } }),
      ]);
      expect(schema.safeParse({ bio: "short" }).success).toBe(true);
      expect(schema.safeParse({ bio: "this is too long" }).success).toBe(false);
    });

    it("NUMBER produces a number validator", () => {
      const schema = buildFieldSchema([makeField({ name: "age", dataType: "NUMBER" })]);
      expect(schema.safeParse({ age: 25 }).success).toBe(true);
      expect(schema.safeParse({ age: "25" }).success).toBe(false);
    });

    it("NUMBER with min/max config", () => {
      const schema = buildFieldSchema([
        makeField({ name: "score", dataType: "NUMBER", config: { min: 0, max: 100 } }),
      ]);
      expect(schema.safeParse({ score: 50 }).success).toBe(true);
      expect(schema.safeParse({ score: -1 }).success).toBe(false);
      expect(schema.safeParse({ score: 101 }).success).toBe(false);
    });

    it("BOOLEAN produces a boolean validator", () => {
      const schema = buildFieldSchema([makeField({ name: "active", dataType: "BOOLEAN" })]);
      expect(schema.safeParse({ active: true }).success).toBe(true);
      expect(schema.safeParse({ active: false }).success).toBe(true);
      expect(schema.safeParse({ active: "yes" }).success).toBe(false);
    });

    it("DATE produces a date string validator", () => {
      const schema = buildFieldSchema([makeField({ name: "birth_date", dataType: "DATE" })]);
      expect(schema.safeParse({ birth_date: "2026-01-15" }).success).toBe(true);
      expect(schema.safeParse({ birth_date: "not-a-date" }).success).toBe(false);
    });

    it("DATETIME produces a datetime string validator", () => {
      const schema = buildFieldSchema([makeField({ name: "arrival", dataType: "DATETIME" })]);
      expect(schema.safeParse({ arrival: "2026-01-15T10:00:00Z" }).success).toBe(true);
      expect(schema.safeParse({ arrival: "2026-01-15" }).success).toBe(false);
    });

    it("ENUM validates against allowed options", () => {
      const schema = buildFieldSchema([
        makeField({
          name: "priority",
          dataType: "ENUM",
          config: {
            options: [
              { value: "low", label: "Low" },
              { value: "high", label: "High" },
            ],
          },
        }),
      ]);
      expect(schema.safeParse({ priority: "low" }).success).toBe(true);
      expect(schema.safeParse({ priority: "high" }).success).toBe(true);
      expect(schema.safeParse({ priority: "medium" }).success).toBe(false);
    });

    it("ENUM with no options falls back to string", () => {
      const schema = buildFieldSchema([
        makeField({ name: "fallback", dataType: "ENUM", config: {} }),
      ]);
      expect(schema.safeParse({ fallback: "anything" }).success).toBe(true);
    });

    it("MULTI_ENUM validates array of allowed options", () => {
      const schema = buildFieldSchema([
        makeField({
          name: "tags",
          dataType: "MULTI_ENUM",
          config: {
            options: [
              { value: "a", label: "A" },
              { value: "b", label: "B" },
              { value: "c", label: "C" },
            ],
          },
        }),
      ]);
      expect(schema.safeParse({ tags: ["a", "b"] }).success).toBe(true);
      expect(schema.safeParse({ tags: ["a", "x"] }).success).toBe(false);
      expect(schema.safeParse({ tags: [] }).success).toBe(true);
    });

    it("EMAIL validates email format", () => {
      const schema = buildFieldSchema([makeField({ name: "contact_email", dataType: "EMAIL" })]);
      expect(schema.safeParse({ contact_email: "test@example.com" }).success).toBe(true);
      expect(schema.safeParse({ contact_email: "not-email" }).success).toBe(false);
    });

    it("URL validates URL format", () => {
      const schema = buildFieldSchema([makeField({ name: "website", dataType: "URL" })]);
      expect(schema.safeParse({ website: "https://example.com" }).success).toBe(true);
      expect(schema.safeParse({ website: "not a url" }).success).toBe(false);
    });

    it("PHONE validates string length 7-20", () => {
      const schema = buildFieldSchema([makeField({ name: "phone", dataType: "PHONE" })]);
      expect(schema.safeParse({ phone: "+1234567" }).success).toBe(true);
      expect(schema.safeParse({ phone: "123" }).success).toBe(false);
      expect(schema.safeParse({ phone: "1".repeat(21) }).success).toBe(false);
    });

    it("FILE produces a string validator", () => {
      const schema = buildFieldSchema([makeField({ name: "passport_scan", dataType: "FILE" })]);
      expect(schema.safeParse({ passport_scan: "uploads/file.pdf" }).success).toBe(true);
    });

    it("IMAGE produces a string validator", () => {
      const schema = buildFieldSchema([makeField({ name: "photo", dataType: "IMAGE" })]);
      expect(schema.safeParse({ photo: "uploads/photo.jpg" }).success).toBe(true);
    });

    it("REFERENCE produces a string validator", () => {
      const schema = buildFieldSchema([makeField({ name: "org_id", dataType: "REFERENCE" })]);
      expect(schema.safeParse({ org_id: "clxxxxxxxxxxxxxxxxx" }).success).toBe(true);
    });

    it("FORMULA produces z.any()", () => {
      const schema = buildFieldSchema([makeField({ name: "total", dataType: "FORMULA" })]);
      expect(schema.safeParse({ total: 42 }).success).toBe(true);
      expect(schema.safeParse({ total: "anything" }).success).toBe(true);
      expect(schema.safeParse({}).success).toBe(true);
    });

    it("JSON produces z.unknown()", () => {
      const schema = buildFieldSchema([makeField({ name: "metadata", dataType: "JSON" })]);
      expect(schema.safeParse({ metadata: { foo: "bar" } }).success).toBe(true);
      expect(schema.safeParse({ metadata: [1, 2, 3] }).success).toBe(true);
    });
  });

  describe("required vs optional", () => {
    it("required field rejects undefined/missing", () => {
      const schema = buildFieldSchema([
        makeField({ name: "full_name", dataType: "TEXT", isRequired: true }),
      ]);
      expect(schema.safeParse({}).success).toBe(false);
      expect(schema.safeParse({ full_name: undefined }).success).toBe(false);
      expect(schema.safeParse({ full_name: "John" }).success).toBe(true);
    });

    it("optional field accepts undefined", () => {
      const schema = buildFieldSchema([
        makeField({ name: "nickname", dataType: "TEXT", isRequired: false }),
      ]);
      expect(schema.safeParse({}).success).toBe(true);
      expect(schema.safeParse({ nickname: undefined }).success).toBe(true);
      expect(schema.safeParse({ nickname: "Jo" }).success).toBe(true);
    });
  });

  describe("custom validation rules", () => {
    it("applies regex validation rule from field.validation", () => {
      const schema = buildFieldSchema([
        makeField({
          name: "passport_number",
          dataType: "TEXT",
          isRequired: true,
          validation: [
            { rule: "regex", value: "^[A-Z]{2}\\d{7}$", message: "Invalid passport format" },
          ],
        }),
      ]);
      expect(schema.safeParse({ passport_number: "AB1234567" }).success).toBe(true);
      expect(schema.safeParse({ passport_number: "invalid" }).success).toBe(false);
    });

    it("applies min validation rule", () => {
      const schema = buildFieldSchema([
        makeField({
          name: "quantity",
          dataType: "NUMBER",
          isRequired: true,
          validation: [{ rule: "min", value: 5, message: "Minimum is 5" }],
        }),
      ]);
      expect(schema.safeParse({ quantity: 10 }).success).toBe(true);
      expect(schema.safeParse({ quantity: 3 }).success).toBe(false);
    });

    it("applies max validation rule", () => {
      const schema = buildFieldSchema([
        makeField({
          name: "weight",
          dataType: "NUMBER",
          isRequired: true,
          validation: [{ rule: "max", value: 50, message: "Maximum is 50" }],
        }),
      ]);
      expect(schema.safeParse({ weight: 30 }).success).toBe(true);
      expect(schema.safeParse({ weight: 60 }).success).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("empty field defs produces empty schema", () => {
      const schema = buildFieldSchema([]);
      expect(schema.safeParse({}).success).toBe(true);
    });

    it("field with no config works (uses defaults)", () => {
      const schema = buildFieldSchema([
        makeField({ name: "simple", dataType: "TEXT", config: {} }),
      ]);
      expect(schema.safeParse({ simple: "anything" }).success).toBe(true);
    });

    it("error messages include field label", () => {
      const schema = buildFieldSchema([
        makeField({
          name: "code",
          dataType: "TEXT",
          label: "Country Code",
          isRequired: true,
          config: { minLength: 2 },
        }),
      ]);
      const result = schema.safeParse({ code: "A" });
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message);
        expect(messages.some((m) => m.includes("Country Code"))).toBe(true);
      }
    });
  });
});

describe("parseFieldFormData", () => {
  it("coerces NUMBER string to number", () => {
    const fields = [makeField({ name: "age", dataType: "NUMBER" })];
    const formData = new FormData();
    formData.set("age", "25");
    const result = parseFieldFormData(formData, fields);
    expect(result.age).toBe(25);
  });

  it("returns undefined for NUMBER with empty value", () => {
    const fields = [makeField({ name: "age", dataType: "NUMBER" })];
    const formData = new FormData();
    formData.set("age", "");
    const result = parseFieldFormData(formData, fields);
    expect(result.age).toBeUndefined();
  });

  it("returns undefined for NUMBER with NaN", () => {
    const fields = [makeField({ name: "age", dataType: "NUMBER" })];
    const formData = new FormData();
    formData.set("age", "abc");
    const result = parseFieldFormData(formData, fields);
    expect(result.age).toBeUndefined();
  });

  it("coerces BOOLEAN 'on' to true", () => {
    const fields = [makeField({ name: "active", dataType: "BOOLEAN" })];
    const formData = new FormData();
    formData.set("active", "on");
    const result = parseFieldFormData(formData, fields);
    expect(result.active).toBe(true);
  });

  it("coerces BOOLEAN 'true' to true", () => {
    const fields = [makeField({ name: "active", dataType: "BOOLEAN" })];
    const formData = new FormData();
    formData.set("active", "true");
    const result = parseFieldFormData(formData, fields);
    expect(result.active).toBe(true);
  });

  it("coerces BOOLEAN '1' to true", () => {
    const fields = [makeField({ name: "active", dataType: "BOOLEAN" })];
    const formData = new FormData();
    formData.set("active", "1");
    const result = parseFieldFormData(formData, fields);
    expect(result.active).toBe(true);
  });

  it("coerces missing BOOLEAN to false", () => {
    const fields = [makeField({ name: "active", dataType: "BOOLEAN" })];
    const formData = new FormData();
    const result = parseFieldFormData(formData, fields);
    expect(result.active).toBe(false);
  });

  it("MULTI_ENUM returns array from getAll()", () => {
    const fields = [
      makeField({
        name: "tags",
        dataType: "MULTI_ENUM",
        config: {
          options: [
            { value: "a", label: "A" },
            { value: "b", label: "B" },
          ],
        },
      }),
    ];
    const formData = new FormData();
    formData.append("tags", "a");
    formData.append("tags", "b");
    const result = parseFieldFormData(formData, fields);
    expect(result.tags).toEqual(["a", "b"]);
  });

  it("MULTI_ENUM filters empty strings", () => {
    const fields = [makeField({ name: "tags", dataType: "MULTI_ENUM" })];
    const formData = new FormData();
    formData.append("tags", "a");
    formData.append("tags", "");
    const result = parseFieldFormData(formData, fields);
    expect(result.tags).toEqual(["a"]);
  });

  it("JSON parses valid JSON string", () => {
    const fields = [makeField({ name: "metadata", dataType: "JSON" })];
    const formData = new FormData();
    formData.set("metadata", '{"key":"value"}');
    const result = parseFieldFormData(formData, fields);
    expect(result.metadata).toEqual({ key: "value" });
  });

  it("JSON returns raw string on invalid JSON", () => {
    const fields = [makeField({ name: "metadata", dataType: "JSON" })];
    const formData = new FormData();
    formData.set("metadata", "not-json");
    const result = parseFieldFormData(formData, fields);
    expect(result.metadata).toBe("not-json");
  });

  it("empty strings become undefined for optional text fields", () => {
    const fields = [makeField({ name: "notes", dataType: "TEXT" })];
    const formData = new FormData();
    formData.set("notes", "");
    const result = parseFieldFormData(formData, fields);
    expect(result.notes).toBeUndefined();
  });

  it("FORMULA fields are skipped", () => {
    const fields = [makeField({ name: "total", dataType: "FORMULA" })];
    const formData = new FormData();
    formData.set("total", "42");
    const result = parseFieldFormData(formData, fields);
    expect(result.total).toBeUndefined();
  });

  it("DATE keeps string value", () => {
    const fields = [makeField({ name: "start_date", dataType: "DATE" })];
    const formData = new FormData();
    formData.set("start_date", "2026-07-01");
    const result = parseFieldFormData(formData, fields);
    expect(result.start_date).toBe("2026-07-01");
  });

  it("ENUM coerces to string", () => {
    const fields = [makeField({ name: "status", dataType: "ENUM" })];
    const formData = new FormData();
    formData.set("status", "active");
    const result = parseFieldFormData(formData, fields);
    expect(result.status).toBe("active");
  });

  it("ENUM returns undefined for empty value", () => {
    const fields = [makeField({ name: "status", dataType: "ENUM" })];
    const formData = new FormData();
    formData.set("status", "");
    const result = parseFieldFormData(formData, fields);
    expect(result.status).toBeUndefined();
  });
});

describe("getCachedSchema", () => {
  beforeEach(() => {
    schemaCache.clear();
  });

  it("returns same schema on repeated calls (cache hit)", () => {
    const fields = [makeField({ name: "title", dataType: "TEXT", isRequired: true })];
    const schema1 = getCachedSchema("t1", "Generic", fields);
    const schema2 = getCachedSchema("t1", "Generic", fields);
    expect(schema1).toBe(schema2);
  });

  it("rebuilds when hash changes (field updated)", () => {
    const fields1 = [
      makeField({ name: "title", dataType: "TEXT", updatedAt: new Date("2026-01-01") }),
    ];
    const schema1 = getCachedSchema("t1", "Generic", fields1);

    const fields2 = [{ ...fields1[0], updatedAt: new Date("2026-02-01") }] as FieldDefinition[];
    const schema2 = getCachedSchema("t1", "Generic", fields2);

    expect(schema1).not.toBe(schema2);
  });

  it("uses entityType in cache key", () => {
    const fields = [makeField({ name: "title", dataType: "TEXT" })];
    const schema1 = getCachedSchema("t1", "Generic", fields);
    const schema2 = getCachedSchema("t1", "Custom", fields);
    expect(schema1).not.toBe(schema2);
  });

  it("LRU eviction after MAX_CACHE_SIZE entries", () => {
    const field = makeField({ name: "title", dataType: "TEXT" });

    for (let i = 0; i < 1000; i++) {
      getCachedSchema("t1", `e${i}`, [{ ...field, id: `f-${i}` } as FieldDefinition]);
    }
    expect(schemaCache.size).toBe(1000);

    getCachedSchema("t1", "e-new", [{ ...field, id: "f-new" } as FieldDefinition]);
    expect(schemaCache.size).toBe(1000);

    expect(schemaCache.has("t1:e0")).toBe(false);
    expect(schemaCache.has("t1:e-new")).toBe(true);
  });
});

describe("buildConformConstraints", () => {
  it("maps required field", () => {
    const constraints = buildConformConstraints([
      makeField({ name: "title", dataType: "TEXT", isRequired: true }),
    ]);
    expect(constraints.title.required).toBe(true);
  });

  it("maps minLength and maxLength from config", () => {
    const constraints = buildConformConstraints([
      makeField({ name: "code", dataType: "TEXT", config: { minLength: 2, maxLength: 10 } }),
    ]);
    expect(constraints.code.minLength).toBe(2);
    expect(constraints.code.maxLength).toBe(10);
  });

  it("maps min and max from config for NUMBER", () => {
    const constraints = buildConformConstraints([
      makeField({ name: "score", dataType: "NUMBER", config: { min: 0, max: 100 } }),
    ]);
    expect(constraints.score.min).toBe(0);
    expect(constraints.score.max).toBe(100);
  });

  it("maps pattern from config", () => {
    const constraints = buildConformConstraints([
      makeField({ name: "code", dataType: "TEXT", config: { pattern: "^[A-Z]+$" } }),
    ]);
    expect(constraints.code.pattern).toBe("^[A-Z]+$");
  });

  it("omits undefined constraints", () => {
    const constraints = buildConformConstraints([
      makeField({ name: "simple", dataType: "TEXT", config: {} }),
    ]);
    expect(constraints.simple).toEqual({});
    expect(constraints.simple.required).toBeUndefined();
    expect(constraints.simple.minLength).toBeUndefined();
  });

  it("handles multiple fields", () => {
    const constraints = buildConformConstraints([
      makeField({ name: "name", dataType: "TEXT", isRequired: true, config: { maxLength: 50 } }),
      makeField({ name: "age", dataType: "NUMBER", config: { min: 0, max: 150 } }),
    ]);
    expect(constraints.name).toEqual({ required: true, maxLength: 50 });
    expect(constraints.age).toEqual({ min: 0, max: 150 });
  });
});

import { describe, it, expect } from "vitest";

import {
  audienceFilterSchema,
  createBroadcastSchema,
  updateBroadcastSchema,
} from "~/lib/schemas/broadcast";
import { createTemplateSchema, updateTemplateSchema, MESSAGE_CHANNELS } from "~/lib/schemas/message-template";
import {
  fieldNameSchema,
  createFieldSchema,
  updateFieldSchema,
  reorderFieldsSchema,
  FIELD_DATA_TYPES,
} from "~/lib/schemas/field";
import {
  createSectionTemplateSchema,
  updateSectionTemplateSchema,
  ENTITY_TYPES_LIST,
} from "~/lib/schemas/section-template";
import { inviteUserSchema, acceptInviteSchema } from "~/lib/schemas/invitation";
import {
  createCustomObjectSchema,
  updateCustomObjectSchema,
  addFieldSchema,
  SLUG_REGEX,
  ADD_FIELD_DATA_TYPES,
} from "~/lib/schemas/custom-object";

// ──────────────────────────────────────────────────────────
// 1. Broadcast schemas
// ──────────────────────────────────────────────────────────

describe("audienceFilterSchema", () => {
  it("accepts a fully populated filter", () => {
    const result = audienceFilterSchema.safeParse({
      roles: ["admin", "editor"],
      statuses: ["active"],
      customFields: { tier: "gold" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty object (all fields optional)", () => {
    const result = audienceFilterSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts with only roles", () => {
    const result = audienceFilterSchema.safeParse({ roles: ["viewer"] });
    expect(result.success).toBe(true);
  });

  it("accepts with only statuses", () => {
    const result = audienceFilterSchema.safeParse({ statuses: ["inactive"] });
    expect(result.success).toBe(true);
  });

  it("accepts with only customFields", () => {
    const result = audienceFilterSchema.safeParse({ customFields: { key: 123 } });
    expect(result.success).toBe(true);
  });

  it("rejects roles that is not an array", () => {
    const result = audienceFilterSchema.safeParse({ roles: "admin" });
    expect(result.success).toBe(false);
  });
});

describe("createBroadcastSchema", () => {
  const validBroadcast = {
    body: "Hello, world!",
    channel: "EMAIL" as const,
  };

  it("accepts valid data with required fields only", () => {
    const result = createBroadcastSchema.safeParse(validBroadcast);
    expect(result.success).toBe(true);
  });

  it("accepts valid data with all optional fields", () => {
    const result = createBroadcastSchema.safeParse({
      ...validBroadcast,
      subject: "Test Subject",
      filters: { roles: ["admin"] },
      templateId: "tpl-123",
      scheduledAt: "2026-06-01T12:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing body", () => {
    const result = createBroadcastSchema.safeParse({ channel: "EMAIL" });
    expect(result.success).toBe(false);
  });

  it("rejects empty body", () => {
    const result = createBroadcastSchema.safeParse({ body: "", channel: "EMAIL" });
    expect(result.success).toBe(false);
  });

  it("rejects missing channel", () => {
    const result = createBroadcastSchema.safeParse({ body: "Hello" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid channel value", () => {
    const result = createBroadcastSchema.safeParse({ body: "Hello", channel: "CARRIER_PIGEON" });
    expect(result.success).toBe(false);
  });

  it("accepts all valid channel values", () => {
    for (const channel of MESSAGE_CHANNELS) {
      const result = createBroadcastSchema.safeParse({ body: "Test", channel });
      expect(result.success).toBe(true);
    }
  });

  it("rejects subject longer than 200 characters", () => {
    const result = createBroadcastSchema.safeParse({
      ...validBroadcast,
      subject: "a".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("accepts subject exactly 200 characters", () => {
    const result = createBroadcastSchema.safeParse({
      ...validBroadcast,
      subject: "a".repeat(200),
    });
    expect(result.success).toBe(true);
  });

  it("rejects body longer than 50000 characters", () => {
    const result = createBroadcastSchema.safeParse({
      body: "a".repeat(50001),
      channel: "EMAIL",
    });
    expect(result.success).toBe(false);
  });

  it("accepts body at exactly 50000 characters", () => {
    const result = createBroadcastSchema.safeParse({
      body: "a".repeat(50000),
      channel: "EMAIL",
    });
    expect(result.success).toBe(true);
  });

  it("coerces scheduledAt string to a Date", () => {
    const result = createBroadcastSchema.safeParse({
      ...validBroadcast,
      scheduledAt: "2026-12-25T00:00:00Z",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.scheduledAt).toBeInstanceOf(Date);
    }
  });
});

describe("updateBroadcastSchema", () => {
  it("accepts valid update data", () => {
    const result = updateBroadcastSchema.safeParse({
      subject: "Updated subject",
      body: "Updated body",
      channel: "SMS",
    });
    expect(result.success).toBe(true);
  });

  it("does not include filters or scheduledAt fields", () => {
    const result = updateBroadcastSchema.safeParse({
      body: "Body",
      channel: "EMAIL",
      filters: { roles: ["admin"] },
      scheduledAt: "2026-01-01",
    });
    // The extra keys are stripped; core fields remain valid
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("filters");
      expect(result.data).not.toHaveProperty("scheduledAt");
    }
  });
});

// ──────────────────────────────────────────────────────────
// 2. Message Template schemas
// ──────────────────────────────────────────────────────────

describe("createTemplateSchema", () => {
  const validTemplate = {
    name: "Welcome Email",
    body: "<p>Hello {{name}}</p>",
    channel: "EMAIL" as const,
  };

  it("accepts valid data with required fields", () => {
    const result = createTemplateSchema.safeParse(validTemplate);
    expect(result.success).toBe(true);
  });

  it("accepts valid data with all optional fields", () => {
    const result = createTemplateSchema.safeParse({
      ...validTemplate,
      subject: "Welcome!",
      variables: ["name", "company"],
    });
    expect(result.success).toBe(true);
  });

  it("defaults variables to an empty array", () => {
    const result = createTemplateSchema.safeParse(validTemplate);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.variables).toEqual([]);
    }
  });

  it("rejects missing name", () => {
    const result = createTemplateSchema.safeParse({ body: "Hello", channel: "EMAIL" });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = createTemplateSchema.safeParse({ name: "", body: "Hello", channel: "EMAIL" });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 100 characters", () => {
    const result = createTemplateSchema.safeParse({
      name: "a".repeat(101),
      body: "Hello",
      channel: "EMAIL",
    });
    expect(result.success).toBe(false);
  });

  it("accepts name exactly 100 characters", () => {
    const result = createTemplateSchema.safeParse({
      name: "a".repeat(100),
      body: "Hello",
      channel: "EMAIL",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing body", () => {
    const result = createTemplateSchema.safeParse({ name: "Test", channel: "EMAIL" });
    expect(result.success).toBe(false);
  });

  it("rejects empty body", () => {
    const result = createTemplateSchema.safeParse({ name: "Test", body: "", channel: "EMAIL" });
    expect(result.success).toBe(false);
  });

  it("rejects body longer than 10000 characters", () => {
    const result = createTemplateSchema.safeParse({
      name: "Test",
      body: "x".repeat(10001),
      channel: "EMAIL",
    });
    expect(result.success).toBe(false);
  });

  it("accepts body exactly 10000 characters", () => {
    const result = createTemplateSchema.safeParse({
      name: "Test",
      body: "x".repeat(10000),
      channel: "EMAIL",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing channel", () => {
    const result = createTemplateSchema.safeParse({ name: "Test", body: "Body" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid channel", () => {
    const result = createTemplateSchema.safeParse({
      name: "Test",
      body: "Body",
      channel: "FAX",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid channel values", () => {
    for (const channel of MESSAGE_CHANNELS) {
      const result = createTemplateSchema.safeParse({ name: "T", body: "B", channel });
      expect(result.success).toBe(true);
    }
  });

  it("rejects subject longer than 200 characters", () => {
    const result = createTemplateSchema.safeParse({
      ...validTemplate,
      subject: "s".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty string in variables array", () => {
    const result = createTemplateSchema.safeParse({
      ...validTemplate,
      variables: ["name", ""],
    });
    expect(result.success).toBe(false);
  });
});

describe("updateTemplateSchema", () => {
  it("accepts a partial update with just name", () => {
    const result = updateTemplateSchema.safeParse({ name: "Updated Name" });
    expect(result.success).toBe(true);
  });

  it("accepts an empty object (all fields become optional)", () => {
    const result = updateTemplateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("still enforces constraints on provided fields", () => {
    const result = updateTemplateSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────
// 3. Field schemas
// ──────────────────────────────────────────────────────────

describe("fieldNameSchema", () => {
  it("accepts valid lowercase alphanumeric with underscores", () => {
    expect(fieldNameSchema.safeParse("my_field_1").success).toBe(true);
  });

  it("accepts single character name", () => {
    expect(fieldNameSchema.safeParse("a").success).toBe(true);
  });

  it("rejects empty string", () => {
    expect(fieldNameSchema.safeParse("").success).toBe(false);
  });

  it("rejects name starting with a number", () => {
    expect(fieldNameSchema.safeParse("1field").success).toBe(false);
  });

  it("rejects name starting with underscore", () => {
    expect(fieldNameSchema.safeParse("_field").success).toBe(false);
  });

  it("rejects uppercase letters", () => {
    expect(fieldNameSchema.safeParse("MyField").success).toBe(false);
  });

  it("rejects hyphens", () => {
    expect(fieldNameSchema.safeParse("my-field").success).toBe(false);
  });

  it("rejects spaces", () => {
    expect(fieldNameSchema.safeParse("my field").success).toBe(false);
  });

  it("rejects name longer than 64 characters", () => {
    expect(fieldNameSchema.safeParse("a".repeat(65)).success).toBe(false);
  });

  it("accepts name exactly 64 characters", () => {
    expect(fieldNameSchema.safeParse("a".repeat(64)).success).toBe(true);
  });
});

describe("createFieldSchema", () => {
  const validField = {
    name: "first_name",
    label: "First Name",
    dataType: "TEXT" as const,
  };

  it("accepts valid data with required fields only", () => {
    const result = createFieldSchema.safeParse(validField);
    expect(result.success).toBe(true);
  });

  it("applies defaults for optional fields", () => {
    const result = createFieldSchema.safeParse(validField);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.entityType).toBe("Generic");
      expect(result.data.isRequired).toBe(false);
      expect(result.data.isUnique).toBe(false);
      expect(result.data.isSearchable).toBe(false);
      expect(result.data.isFilterable).toBe(false);
      expect(result.data.config).toEqual({});
      expect(result.data.validation).toEqual([]);
    }
  });

  it("accepts all valid data types", () => {
    for (const dataType of FIELD_DATA_TYPES) {
      const result = createFieldSchema.safeParse({ ...validField, dataType });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid data type", () => {
    const result = createFieldSchema.safeParse({ ...validField, dataType: "BLOB" });
    expect(result.success).toBe(false);
  });

  it("rejects missing name", () => {
    const result = createFieldSchema.safeParse({ label: "First Name", dataType: "TEXT" });
    expect(result.success).toBe(false);
  });

  it("rejects missing label", () => {
    const result = createFieldSchema.safeParse({ name: "first_name", dataType: "TEXT" });
    expect(result.success).toBe(false);
  });

  it("rejects empty label", () => {
    const result = createFieldSchema.safeParse({ ...validField, label: "" });
    expect(result.success).toBe(false);
  });

  it("rejects label longer than 128 characters", () => {
    const result = createFieldSchema.safeParse({ ...validField, label: "L".repeat(129) });
    expect(result.success).toBe(false);
  });

  it("accepts label exactly 128 characters", () => {
    const result = createFieldSchema.safeParse({ ...validField, label: "L".repeat(128) });
    expect(result.success).toBe(true);
  });

  it("rejects missing dataType", () => {
    const result = createFieldSchema.safeParse({ name: "test", label: "Test" });
    expect(result.success).toBe(false);
  });

  it("rejects description longer than 500 characters", () => {
    const result = createFieldSchema.safeParse({ ...validField, description: "d".repeat(501) });
    expect(result.success).toBe(false);
  });

  it("accepts description exactly 500 characters", () => {
    const result = createFieldSchema.safeParse({ ...validField, description: "d".repeat(500) });
    expect(result.success).toBe(true);
  });

  it("coerces boolean strings for isRequired", () => {
    const result = createFieldSchema.safeParse({ ...validField, isRequired: "true" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isRequired).toBe(true);
    }
  });

  it("accepts config as a record", () => {
    const result = createFieldSchema.safeParse({
      ...validField,
      config: { options: ["a", "b"], maxLength: 100 },
    });
    expect(result.success).toBe(true);
  });

  it("accepts validation as an array of records", () => {
    const result = createFieldSchema.safeParse({
      ...validField,
      validation: [{ type: "minLength", value: 3 }],
    });
    expect(result.success).toBe(true);
  });
});

describe("updateFieldSchema", () => {
  it("accepts a partial update with just label", () => {
    const result = updateFieldSchema.safeParse({ label: "Updated Label" });
    expect(result.success).toBe(true);
  });

  it("accepts an empty object", () => {
    const result = updateFieldSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("still enforces name regex when name is provided", () => {
    const result = updateFieldSchema.safeParse({ name: "Invalid Name!" });
    expect(result.success).toBe(false);
  });
});

describe("reorderFieldsSchema", () => {
  it("accepts an array of field IDs", () => {
    const result = reorderFieldsSchema.safeParse({ fieldIds: ["f1", "f2", "f3"] });
    expect(result.success).toBe(true);
  });

  it("rejects an empty array", () => {
    const result = reorderFieldsSchema.safeParse({ fieldIds: [] });
    expect(result.success).toBe(false);
  });

  it("rejects missing fieldIds", () => {
    const result = reorderFieldsSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────
// 4. Section Template schemas
// ──────────────────────────────────────────────────────────

describe("createSectionTemplateSchema", () => {
  it("accepts valid data with name only", () => {
    const result = createSectionTemplateSchema.safeParse({ name: "General Info" });
    expect(result.success).toBe(true);
  });

  it("defaults entityType to Generic", () => {
    const result = createSectionTemplateSchema.safeParse({ name: "General Info" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.entityType).toBe("Generic");
    }
  });

  it("accepts all valid entity types", () => {
    for (const entityType of ENTITY_TYPES_LIST) {
      const result = createSectionTemplateSchema.safeParse({ name: "Test", entityType });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid entity type", () => {
    const result = createSectionTemplateSchema.safeParse({ name: "Test", entityType: "Widget" });
    expect(result.success).toBe(false);
  });

  it("accepts valid data with all fields", () => {
    const result = createSectionTemplateSchema.safeParse({
      name: "Contact Details",
      description: "Section for contact information",
      entityType: "User",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = createSectionTemplateSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = createSectionTemplateSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 100 characters", () => {
    const result = createSectionTemplateSchema.safeParse({ name: "n".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("accepts name exactly 100 characters", () => {
    const result = createSectionTemplateSchema.safeParse({ name: "n".repeat(100) });
    expect(result.success).toBe(true);
  });

  it("rejects description longer than 500 characters", () => {
    const result = createSectionTemplateSchema.safeParse({
      name: "Test",
      description: "d".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("accepts description exactly 500 characters", () => {
    const result = createSectionTemplateSchema.safeParse({
      name: "Test",
      description: "d".repeat(500),
    });
    expect(result.success).toBe(true);
  });
});

describe("updateSectionTemplateSchema", () => {
  it("behaves identically to createSectionTemplateSchema", () => {
    // updateSectionTemplateSchema is assigned directly from create, so same rules apply
    const validResult = updateSectionTemplateSchema.safeParse({ name: "Updated" });
    expect(validResult.success).toBe(true);

    const invalidResult = updateSectionTemplateSchema.safeParse({ name: "" });
    expect(invalidResult.success).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────
// 5. Invitation schemas
// ──────────────────────────────────────────────────────────

describe("inviteUserSchema", () => {
  const validInvite = {
    email: "user@example.com",
    roleIds: ["role-1"],
  };

  it("accepts valid invitation data", () => {
    const result = inviteUserSchema.safeParse(validInvite);
    expect(result.success).toBe(true);
  });

  it("accepts multiple role IDs", () => {
    const result = inviteUserSchema.safeParse({
      email: "user@example.com",
      roleIds: ["role-1", "role-2", "role-3"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing email", () => {
    const result = inviteUserSchema.safeParse({ roleIds: ["role-1"] });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email format", () => {
    const result = inviteUserSchema.safeParse({ email: "not-an-email", roleIds: ["role-1"] });
    expect(result.success).toBe(false);
  });

  it("rejects empty string email", () => {
    const result = inviteUserSchema.safeParse({ email: "", roleIds: ["role-1"] });
    expect(result.success).toBe(false);
  });

  it("rejects missing roleIds", () => {
    const result = inviteUserSchema.safeParse({ email: "user@example.com" });
    expect(result.success).toBe(false);
  });

  it("rejects empty roleIds array", () => {
    const result = inviteUserSchema.safeParse({ email: "user@example.com", roleIds: [] });
    expect(result.success).toBe(false);
  });
});

describe("acceptInviteSchema", () => {
  const validAccept = {
    token: "abc123token",
    name: "John Doe",
    username: "johndoe",
    password: "P@ssw0rd!",
  };

  it("accepts valid data", () => {
    const result = acceptInviteSchema.safeParse(validAccept);
    expect(result.success).toBe(true);
  });

  // --- token ---
  it("rejects missing token", () => {
    const { token, ...rest } = validAccept;
    const result = acceptInviteSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects empty token", () => {
    const result = acceptInviteSchema.safeParse({ ...validAccept, token: "" });
    expect(result.success).toBe(false);
  });

  // --- name ---
  it("rejects missing name", () => {
    const { name, ...rest } = validAccept;
    const result = acceptInviteSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = acceptInviteSchema.safeParse({ ...validAccept, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 100 characters", () => {
    const result = acceptInviteSchema.safeParse({ ...validAccept, name: "a".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("accepts name exactly 100 characters", () => {
    const result = acceptInviteSchema.safeParse({ ...validAccept, name: "a".repeat(100) });
    expect(result.success).toBe(true);
  });

  // --- username ---
  it("rejects missing username", () => {
    const { username, ...rest } = validAccept;
    const result = acceptInviteSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects username shorter than 3 characters", () => {
    const result = acceptInviteSchema.safeParse({ ...validAccept, username: "ab" });
    expect(result.success).toBe(false);
  });

  it("accepts username exactly 3 characters", () => {
    const result = acceptInviteSchema.safeParse({ ...validAccept, username: "abc" });
    expect(result.success).toBe(true);
  });

  it("rejects username longer than 30 characters", () => {
    const result = acceptInviteSchema.safeParse({ ...validAccept, username: "a".repeat(31) });
    expect(result.success).toBe(false);
  });

  it("accepts username exactly 30 characters", () => {
    const result = acceptInviteSchema.safeParse({ ...validAccept, username: "a".repeat(30) });
    expect(result.success).toBe(true);
  });

  it("rejects username with spaces", () => {
    const result = acceptInviteSchema.safeParse({ ...validAccept, username: "john doe" });
    expect(result.success).toBe(false);
  });

  it("rejects username with special characters other than hyphen and underscore", () => {
    const result = acceptInviteSchema.safeParse({ ...validAccept, username: "john@doe" });
    expect(result.success).toBe(false);
  });

  it("accepts username with hyphens and underscores", () => {
    const result = acceptInviteSchema.safeParse({ ...validAccept, username: "john_doe-123" });
    expect(result.success).toBe(true);
  });

  // --- password ---
  it("rejects missing password", () => {
    const { password, ...rest } = validAccept;
    const result = acceptInviteSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects password shorter than 8 characters", () => {
    const result = acceptInviteSchema.safeParse({ ...validAccept, password: "Ab1!" });
    expect(result.success).toBe(false);
  });

  it("accepts password exactly 8 characters meeting all rules", () => {
    const result = acceptInviteSchema.safeParse({ ...validAccept, password: "Abcdef1!" });
    expect(result.success).toBe(true);
  });

  it("rejects password longer than 100 characters", () => {
    // 1 + 98 + 2 = 101 chars total
    const result = acceptInviteSchema.safeParse({
      ...validAccept,
      password: "A" + "a".repeat(98) + "1!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password without uppercase letter", () => {
    const result = acceptInviteSchema.safeParse({ ...validAccept, password: "abcdefg1!" });
    expect(result.success).toBe(false);
  });

  it("rejects password without lowercase letter", () => {
    const result = acceptInviteSchema.safeParse({ ...validAccept, password: "ABCDEFG1!" });
    expect(result.success).toBe(false);
  });

  it("rejects password without digit", () => {
    const result = acceptInviteSchema.safeParse({ ...validAccept, password: "Abcdefgh!" });
    expect(result.success).toBe(false);
  });

  it("rejects password without special character", () => {
    const result = acceptInviteSchema.safeParse({ ...validAccept, password: "Abcdefg1a" });
    expect(result.success).toBe(false);
  });

  it("accepts a strong password with all requirements", () => {
    const result = acceptInviteSchema.safeParse({
      ...validAccept,
      password: "MyStr0ng#Pass",
    });
    expect(result.success).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────
// 6. Custom Object schemas
// ──────────────────────────────────────────────────────────

describe("SLUG_REGEX", () => {
  it("matches valid slugs", () => {
    expect(SLUG_REGEX.test("products")).toBe(true);
    expect(SLUG_REGEX.test("my-object")).toBe(true);
    expect(SLUG_REGEX.test("my_object")).toBe(true);
    expect(SLUG_REGEX.test("a1")).toBe(true);
  });

  it("rejects slugs starting with a number", () => {
    expect(SLUG_REGEX.test("1product")).toBe(false);
  });

  it("rejects slugs starting with a hyphen", () => {
    expect(SLUG_REGEX.test("-product")).toBe(false);
  });

  it("rejects uppercase letters", () => {
    expect(SLUG_REGEX.test("Product")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(SLUG_REGEX.test("")).toBe(false);
  });

  it("rejects slugs with spaces", () => {
    expect(SLUG_REGEX.test("my product")).toBe(false);
  });
});

describe("createCustomObjectSchema", () => {
  const validObject = {
    name: "Products",
    slug: "products",
  };

  it("accepts valid data with required fields only", () => {
    const result = createCustomObjectSchema.safeParse(validObject);
    expect(result.success).toBe(true);
  });

  it("defaults description to empty string", () => {
    const result = createCustomObjectSchema.safeParse(validObject);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe("");
    }
  });

  it("accepts valid data with all fields", () => {
    const result = createCustomObjectSchema.safeParse({
      ...validObject,
      description: "Catalog of products",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = createCustomObjectSchema.safeParse({ slug: "products" });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = createCustomObjectSchema.safeParse({ name: "", slug: "products" });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 100 characters", () => {
    const result = createCustomObjectSchema.safeParse({
      name: "a".repeat(101),
      slug: "products",
    });
    expect(result.success).toBe(false);
  });

  it("accepts name exactly 100 characters", () => {
    const result = createCustomObjectSchema.safeParse({
      name: "a".repeat(100),
      slug: "products",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing slug", () => {
    const result = createCustomObjectSchema.safeParse({ name: "Products" });
    expect(result.success).toBe(false);
  });

  it("rejects empty slug", () => {
    const result = createCustomObjectSchema.safeParse({ name: "Products", slug: "" });
    expect(result.success).toBe(false);
  });

  it("rejects slug with uppercase letters", () => {
    const result = createCustomObjectSchema.safeParse({ name: "Products", slug: "Products" });
    expect(result.success).toBe(false);
  });

  it("rejects slug starting with a number", () => {
    const result = createCustomObjectSchema.safeParse({ name: "Products", slug: "1products" });
    expect(result.success).toBe(false);
  });

  it("rejects slug with spaces", () => {
    const result = createCustomObjectSchema.safeParse({ name: "Products", slug: "my products" });
    expect(result.success).toBe(false);
  });

  it("rejects slug longer than 100 characters", () => {
    const result = createCustomObjectSchema.safeParse({
      name: "Products",
      slug: "a".repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it("accepts slug exactly 100 characters", () => {
    const result = createCustomObjectSchema.safeParse({
      name: "Products",
      slug: "a".repeat(100),
    });
    expect(result.success).toBe(true);
  });

  it("accepts slug with hyphens and underscores", () => {
    const result = createCustomObjectSchema.safeParse({
      name: "Products",
      slug: "my-custom_objects",
    });
    expect(result.success).toBe(true);
  });

  it("rejects description longer than 500 characters", () => {
    const result = createCustomObjectSchema.safeParse({
      ...validObject,
      description: "d".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("accepts description exactly 500 characters", () => {
    const result = createCustomObjectSchema.safeParse({
      ...validObject,
      description: "d".repeat(500),
    });
    expect(result.success).toBe(true);
  });
});

describe("updateCustomObjectSchema", () => {
  it("accepts valid update data", () => {
    const result = updateCustomObjectSchema.safeParse({ name: "Updated Products" });
    expect(result.success).toBe(true);
  });

  it("defaults description to empty string", () => {
    const result = updateCustomObjectSchema.safeParse({ name: "Updated" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe("");
    }
  });

  it("rejects missing name", () => {
    const result = updateCustomObjectSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = updateCustomObjectSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("does not accept a slug field (update cannot change slug)", () => {
    const result = updateCustomObjectSchema.safeParse({
      name: "Updated",
      slug: "updated-slug",
    });
    // slug is stripped from the output
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("slug");
    }
  });

  it("rejects name longer than 100 characters", () => {
    const result = updateCustomObjectSchema.safeParse({ name: "x".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("rejects description longer than 500 characters", () => {
    const result = updateCustomObjectSchema.safeParse({
      name: "Valid",
      description: "d".repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

describe("addFieldSchema", () => {
  const validAddField = {
    fieldName: "email_address",
    fieldLabel: "Email Address",
    fieldType: "EMAIL" as const,
  };

  it("accepts valid data with required fields", () => {
    const result = addFieldSchema.safeParse(validAddField);
    expect(result.success).toBe(true);
  });

  it("accepts valid data with optional fieldRequired", () => {
    const result = addFieldSchema.safeParse({ ...validAddField, fieldRequired: "on" });
    expect(result.success).toBe(true);
  });

  it("accepts all valid ADD_FIELD_DATA_TYPES", () => {
    for (const fieldType of ADD_FIELD_DATA_TYPES) {
      const result = addFieldSchema.safeParse({ ...validAddField, fieldType });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid field type", () => {
    const result = addFieldSchema.safeParse({ ...validAddField, fieldType: "JSON" });
    expect(result.success).toBe(false);
  });

  it("rejects field types valid in FIELD_DATA_TYPES but not in ADD_FIELD_DATA_TYPES", () => {
    // REFERENCE, FORMULA, JSON, etc. are in FIELD_DATA_TYPES but not ADD_FIELD_DATA_TYPES
    const result = addFieldSchema.safeParse({ ...validAddField, fieldType: "REFERENCE" });
    expect(result.success).toBe(false);
  });

  // --- fieldName ---
  it("rejects missing fieldName", () => {
    const result = addFieldSchema.safeParse({ fieldLabel: "Test", fieldType: "TEXT" });
    expect(result.success).toBe(false);
  });

  it("rejects empty fieldName", () => {
    const result = addFieldSchema.safeParse({ ...validAddField, fieldName: "" });
    expect(result.success).toBe(false);
  });

  it("rejects fieldName starting with a number", () => {
    const result = addFieldSchema.safeParse({ ...validAddField, fieldName: "1field" });
    expect(result.success).toBe(false);
  });

  it("rejects fieldName with uppercase letters", () => {
    const result = addFieldSchema.safeParse({ ...validAddField, fieldName: "MyField" });
    expect(result.success).toBe(false);
  });

  it("rejects fieldName with hyphens", () => {
    const result = addFieldSchema.safeParse({ ...validAddField, fieldName: "my-field" });
    expect(result.success).toBe(false);
  });

  it("rejects fieldName longer than 50 characters", () => {
    const result = addFieldSchema.safeParse({ ...validAddField, fieldName: "a".repeat(51) });
    expect(result.success).toBe(false);
  });

  it("accepts fieldName exactly 50 characters", () => {
    const result = addFieldSchema.safeParse({ ...validAddField, fieldName: "a".repeat(50) });
    expect(result.success).toBe(true);
  });

  // --- fieldLabel ---
  it("rejects missing fieldLabel", () => {
    const result = addFieldSchema.safeParse({ fieldName: "test", fieldType: "TEXT" });
    expect(result.success).toBe(false);
  });

  it("rejects empty fieldLabel", () => {
    const result = addFieldSchema.safeParse({ ...validAddField, fieldLabel: "" });
    expect(result.success).toBe(false);
  });

  it("rejects fieldLabel longer than 100 characters", () => {
    const result = addFieldSchema.safeParse({ ...validAddField, fieldLabel: "L".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("accepts fieldLabel exactly 100 characters", () => {
    const result = addFieldSchema.safeParse({ ...validAddField, fieldLabel: "L".repeat(100) });
    expect(result.success).toBe(true);
  });

  // --- fieldType ---
  it("rejects missing fieldType", () => {
    const result = addFieldSchema.safeParse({
      fieldName: "test",
      fieldLabel: "Test",
    });
    expect(result.success).toBe(false);
  });
});

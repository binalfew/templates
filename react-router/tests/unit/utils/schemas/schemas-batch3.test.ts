import { describe, it, expect } from "vitest";
import {
  createCountrySchema,
  updateCountrySchema,
  createTitleSchema,
  updateTitleSchema,
  createLanguageSchema,
  updateLanguageSchema,
  createCurrencySchema,
  updateCurrencySchema,
  createDocumentTypeSchema,
  updateDocumentTypeSchema,
} from "~/utils/schemas/reference-data";
import { createApiKeySchema, updateApiKeySchema } from "~/utils/schemas/api-keys";
import { exportSchema, importSchema } from "~/utils/schemas/import-export";
import {
  upsertSettingSchema,
  updateFlagSchema,
  SETTING_TYPES,
  SETTING_SCOPES,
  SETTING_CATEGORIES,
} from "~/utils/schemas/settings";
import { forgotPasswordSchema, resetPasswordSchema } from "~/utils/schemas/password-reset";
import { organizationSchema } from "~/utils/schemas/organization";

// ═══════════════════════════════════════════════════════════════
// Reference Data Schemas
// ═══════════════════════════════════════════════════════════════

describe("createCountrySchema", () => {
  const validCountry = {
    code: "US",
    name: "United States",
  };

  it("accepts valid data with required fields only", () => {
    const result = createCountrySchema.safeParse(validCountry);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe("US");
      expect(result.data.name).toBe("United States");
      expect(result.data.alpha3).toBe("");
      expect(result.data.numericCode).toBe("");
      expect(result.data.phoneCode).toBe("");
      expect(result.data.flag).toBe("");
      expect(result.data.sortOrder).toBe(0);
      expect(result.data.isActive).toBe(true);
    }
  });

  it("accepts valid data with all fields", () => {
    const result = createCountrySchema.safeParse({
      ...validCountry,
      alpha3: "USA",
      numericCode: "840",
      phoneCode: "+1",
      flag: "🇺🇸",
      sortOrder: 10,
      isActive: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.alpha3).toBe("USA");
      expect(result.data.numericCode).toBe("840");
      expect(result.data.phoneCode).toBe("+1");
      expect(result.data.isActive).toBe(false);
    }
  });

  it("rejects missing code", () => {
    const result = createCountrySchema.safeParse({ name: "United States" });
    expect(result.success).toBe(false);
  });

  it("rejects missing name", () => {
    const result = createCountrySchema.safeParse({ code: "US" });
    expect(result.success).toBe(false);
  });

  it("rejects empty code", () => {
    const result = createCountrySchema.safeParse({ code: "", name: "United States" });
    expect(result.success).toBe(false);
  });

  it("rejects code shorter than 2 characters", () => {
    const result = createCountrySchema.safeParse({ code: "U", name: "United States" });
    expect(result.success).toBe(false);
  });

  it("rejects code longer than 2 characters", () => {
    const result = createCountrySchema.safeParse({ code: "USA", name: "United States" });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 200 characters", () => {
    const result = createCountrySchema.safeParse({ code: "US", name: "A".repeat(201) });
    expect(result.success).toBe(false);
  });

  it("rejects alpha3 longer than 3 characters", () => {
    const result = createCountrySchema.safeParse({ ...validCountry, alpha3: "USAA" });
    expect(result.success).toBe(false);
  });

  it("rejects numericCode longer than 3 characters", () => {
    const result = createCountrySchema.safeParse({ ...validCountry, numericCode: "8400" });
    expect(result.success).toBe(false);
  });

  it("rejects phoneCode longer than 15 characters", () => {
    const result = createCountrySchema.safeParse({ ...validCountry, phoneCode: "1".repeat(16) });
    expect(result.success).toBe(false);
  });

  it("rejects flag longer than 10 characters", () => {
    const result = createCountrySchema.safeParse({ ...validCountry, flag: "A".repeat(11) });
    expect(result.success).toBe(false);
  });

  it("rejects negative sortOrder", () => {
    const result = createCountrySchema.safeParse({ ...validCountry, sortOrder: -1 });
    expect(result.success).toBe(false);
  });

  it("coerces sortOrder from string", () => {
    const result = createCountrySchema.safeParse({ ...validCountry, sortOrder: "5" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sortOrder).toBe(5);
    }
  });

  it("coerces isActive from string", () => {
    const result = createCountrySchema.safeParse({ ...validCountry, isActive: "false" });
    expect(result.success).toBe(true);
  });
});

describe("updateCountrySchema", () => {
  it("is the same schema as createCountrySchema", () => {
    expect(updateCountrySchema).toBe(createCountrySchema);
  });
});

describe("createTitleSchema", () => {
  const validTitle = {
    code: "MR",
    name: "Mister",
  };

  it("accepts valid data", () => {
    const result = createTitleSchema.safeParse(validTitle);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe("MR");
      expect(result.data.name).toBe("Mister");
      expect(result.data.sortOrder).toBe(0);
      expect(result.data.isActive).toBe(true);
    }
  });

  it("rejects missing code", () => {
    const result = createTitleSchema.safeParse({ name: "Mister" });
    expect(result.success).toBe(false);
  });

  it("rejects missing name", () => {
    const result = createTitleSchema.safeParse({ code: "MR" });
    expect(result.success).toBe(false);
  });

  it("rejects empty code", () => {
    const result = createTitleSchema.safeParse({ code: "", name: "Mister" });
    expect(result.success).toBe(false);
  });

  it("rejects code longer than 20 characters", () => {
    const result = createTitleSchema.safeParse({ code: "A".repeat(21), name: "Mister" });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 200 characters", () => {
    const result = createTitleSchema.safeParse({ code: "MR", name: "A".repeat(201) });
    expect(result.success).toBe(false);
  });

  it("accepts code at max length of 20", () => {
    const result = createTitleSchema.safeParse({ code: "A".repeat(20), name: "Title" });
    expect(result.success).toBe(true);
  });
});

describe("updateTitleSchema", () => {
  it("is the same schema as createTitleSchema", () => {
    expect(updateTitleSchema).toBe(createTitleSchema);
  });
});

describe("createLanguageSchema", () => {
  const validLanguage = {
    code: "en",
    name: "English",
  };

  it("accepts valid data with required fields only", () => {
    const result = createLanguageSchema.safeParse(validLanguage);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe("en");
      expect(result.data.name).toBe("English");
      expect(result.data.nativeName).toBe("");
      expect(result.data.sortOrder).toBe(0);
      expect(result.data.isActive).toBe(true);
    }
  });

  it("accepts valid data with all fields", () => {
    const result = createLanguageSchema.safeParse({
      ...validLanguage,
      nativeName: "English",
      sortOrder: 1,
      isActive: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nativeName).toBe("English");
    }
  });

  it("rejects missing code", () => {
    const result = createLanguageSchema.safeParse({ name: "English" });
    expect(result.success).toBe(false);
  });

  it("rejects missing name", () => {
    const result = createLanguageSchema.safeParse({ code: "en" });
    expect(result.success).toBe(false);
  });

  it("rejects code shorter than 2 characters", () => {
    const result = createLanguageSchema.safeParse({ code: "e", name: "English" });
    expect(result.success).toBe(false);
  });

  it("rejects code longer than 5 characters", () => {
    const result = createLanguageSchema.safeParse({ code: "englis", name: "English" });
    expect(result.success).toBe(false);
  });

  it("accepts code at boundary length of 5", () => {
    const result = createLanguageSchema.safeParse({ code: "en-US", name: "English US" });
    expect(result.success).toBe(true);
  });

  it("rejects nativeName longer than 200 characters", () => {
    const result = createLanguageSchema.safeParse({
      ...validLanguage,
      nativeName: "A".repeat(201),
    });
    expect(result.success).toBe(false);
  });
});

describe("updateLanguageSchema", () => {
  it("is the same schema as createLanguageSchema", () => {
    expect(updateLanguageSchema).toBe(createLanguageSchema);
  });
});

describe("createCurrencySchema", () => {
  const validCurrency = {
    code: "USD",
    name: "US Dollar",
  };

  it("accepts valid data with required fields only", () => {
    const result = createCurrencySchema.safeParse(validCurrency);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe("USD");
      expect(result.data.name).toBe("US Dollar");
      expect(result.data.symbol).toBe("");
      expect(result.data.decimalDigits).toBe(2);
      expect(result.data.sortOrder).toBe(0);
      expect(result.data.isActive).toBe(true);
    }
  });

  it("accepts valid data with all fields", () => {
    const result = createCurrencySchema.safeParse({
      ...validCurrency,
      symbol: "$",
      decimalDigits: 0,
      sortOrder: 5,
      isActive: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.symbol).toBe("$");
      expect(result.data.decimalDigits).toBe(0);
    }
  });

  it("rejects missing code", () => {
    const result = createCurrencySchema.safeParse({ name: "US Dollar" });
    expect(result.success).toBe(false);
  });

  it("rejects missing name", () => {
    const result = createCurrencySchema.safeParse({ code: "USD" });
    expect(result.success).toBe(false);
  });

  it("rejects code shorter than 3 characters", () => {
    const result = createCurrencySchema.safeParse({ code: "US", name: "US Dollar" });
    expect(result.success).toBe(false);
  });

  it("rejects code longer than 3 characters", () => {
    const result = createCurrencySchema.safeParse({ code: "USDD", name: "US Dollar" });
    expect(result.success).toBe(false);
  });

  it("rejects symbol longer than 10 characters", () => {
    const result = createCurrencySchema.safeParse({ ...validCurrency, symbol: "A".repeat(11) });
    expect(result.success).toBe(false);
  });

  it("rejects decimalDigits greater than 4", () => {
    const result = createCurrencySchema.safeParse({ ...validCurrency, decimalDigits: 5 });
    expect(result.success).toBe(false);
  });

  it("rejects negative decimalDigits", () => {
    const result = createCurrencySchema.safeParse({ ...validCurrency, decimalDigits: -1 });
    expect(result.success).toBe(false);
  });

  it("accepts decimalDigits at boundary value of 4", () => {
    const result = createCurrencySchema.safeParse({ ...validCurrency, decimalDigits: 4 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.decimalDigits).toBe(4);
    }
  });

  it("coerces decimalDigits from string", () => {
    const result = createCurrencySchema.safeParse({ ...validCurrency, decimalDigits: "3" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.decimalDigits).toBe(3);
    }
  });
});

describe("updateCurrencySchema", () => {
  it("is the same schema as createCurrencySchema", () => {
    expect(updateCurrencySchema).toBe(createCurrencySchema);
  });
});

describe("createDocumentTypeSchema", () => {
  const validDocType = {
    code: "PASSPORT",
    name: "Passport",
  };

  it("accepts valid data with required fields only", () => {
    const result = createDocumentTypeSchema.safeParse(validDocType);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe("PASSPORT");
      expect(result.data.name).toBe("Passport");
      expect(result.data.description).toBe("");
      expect(result.data.category).toBe("");
      expect(result.data.sortOrder).toBe(0);
      expect(result.data.isActive).toBe(true);
    }
  });

  it("accepts valid data with all fields", () => {
    const result = createDocumentTypeSchema.safeParse({
      ...validDocType,
      description: "International travel document",
      category: "IDENTITY",
      sortOrder: 1,
      isActive: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe("International travel document");
      expect(result.data.category).toBe("IDENTITY");
    }
  });

  it("rejects missing code", () => {
    const result = createDocumentTypeSchema.safeParse({ name: "Passport" });
    expect(result.success).toBe(false);
  });

  it("rejects missing name", () => {
    const result = createDocumentTypeSchema.safeParse({ code: "PASSPORT" });
    expect(result.success).toBe(false);
  });

  it("rejects empty code", () => {
    const result = createDocumentTypeSchema.safeParse({ code: "", name: "Passport" });
    expect(result.success).toBe(false);
  });

  it("rejects code longer than 50 characters", () => {
    const result = createDocumentTypeSchema.safeParse({ code: "A".repeat(51), name: "Passport" });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 200 characters", () => {
    const result = createDocumentTypeSchema.safeParse({
      code: "PASSPORT",
      name: "A".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("rejects description longer than 500 characters", () => {
    const result = createDocumentTypeSchema.safeParse({
      ...validDocType,
      description: "A".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("rejects category longer than 100 characters", () => {
    const result = createDocumentTypeSchema.safeParse({
      ...validDocType,
      category: "A".repeat(101),
    });
    expect(result.success).toBe(false);
  });
});

describe("updateDocumentTypeSchema", () => {
  it("is the same schema as createDocumentTypeSchema", () => {
    expect(updateDocumentTypeSchema).toBe(createDocumentTypeSchema);
  });
});

// ═══════════════════════════════════════════════════════════════
// API Keys Schemas
// ═══════════════════════════════════════════════════════════════

describe("createApiKeySchema", () => {
  const validApiKey = {
    name: "My API Key",
    permissions: "read:users,write:users",
  };

  it("accepts valid data with required fields only", () => {
    const result = createApiKeySchema.safeParse(validApiKey);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("My API Key");
      expect(result.data.permissions).toBe("read:users,write:users");
      expect(result.data.rateLimitTier).toBe("STANDARD");
    }
  });

  it("accepts valid data with all fields", () => {
    const result = createApiKeySchema.safeParse({
      ...validApiKey,
      description: "Key for external integrations",
      rateLimitTier: "PREMIUM",
      rateLimitCustom: 5000,
      expiresAt: "2027-01-01T00:00:00Z",
      allowedIps: "192.168.1.1,10.0.0.1",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rateLimitTier).toBe("PREMIUM");
      expect(result.data.rateLimitCustom).toBe(5000);
      expect(result.data.expiresAt).toBe("2027-01-01T00:00:00Z");
      expect(result.data.allowedIps).toBe("192.168.1.1,10.0.0.1");
    }
  });

  it("rejects missing name", () => {
    const result = createApiKeySchema.safeParse({ permissions: "read:users" });
    expect(result.success).toBe(false);
  });

  it("rejects missing permissions", () => {
    const result = createApiKeySchema.safeParse({ name: "My API Key" });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = createApiKeySchema.safeParse({ name: "", permissions: "read:users" });
    expect(result.success).toBe(false);
  });

  it("rejects empty permissions", () => {
    const result = createApiKeySchema.safeParse({ name: "My Key", permissions: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 100 characters", () => {
    const result = createApiKeySchema.safeParse({
      name: "A".repeat(101),
      permissions: "read:users",
    });
    expect(result.success).toBe(false);
  });

  it("rejects description longer than 500 characters", () => {
    const result = createApiKeySchema.safeParse({
      ...validApiKey,
      description: "A".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid rateLimitTier values", () => {
    for (const tier of ["STANDARD", "ELEVATED", "PREMIUM", "CUSTOM"] as const) {
      const result = createApiKeySchema.safeParse({ ...validApiKey, rateLimitTier: tier });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid rateLimitTier", () => {
    const result = createApiKeySchema.safeParse({ ...validApiKey, rateLimitTier: "UNLIMITED" });
    expect(result.success).toBe(false);
  });

  it("rejects rateLimitCustom less than 1", () => {
    const result = createApiKeySchema.safeParse({ ...validApiKey, rateLimitCustom: 0 });
    expect(result.success).toBe(false);
  });

  it("coerces rateLimitCustom from string", () => {
    const result = createApiKeySchema.safeParse({ ...validApiKey, rateLimitCustom: "100" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rateLimitCustom).toBe(100);
    }
  });

  it("accepts name at max length of 100", () => {
    const result = createApiKeySchema.safeParse({
      name: "A".repeat(100),
      permissions: "read:users",
    });
    expect(result.success).toBe(true);
  });

  it("accepts description at max length of 500", () => {
    const result = createApiKeySchema.safeParse({
      ...validApiKey,
      description: "A".repeat(500),
    });
    expect(result.success).toBe(true);
  });
});

describe("updateApiKeySchema", () => {
  it("accepts empty object (all fields are partial)", () => {
    const result = updateApiKeySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts partial updates with only name", () => {
    const result = updateApiKeySchema.safeParse({ name: "Updated Name" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Updated Name");
    }
  });

  it("accepts partial updates with only permissions", () => {
    const result = updateApiKeySchema.safeParse({ permissions: "read:roles" });
    expect(result.success).toBe(true);
  });

  it("still enforces max lengths on provided fields", () => {
    const result = updateApiKeySchema.safeParse({ name: "A".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("still enforces enum values on provided rateLimitTier", () => {
    const result = updateApiKeySchema.safeParse({ rateLimitTier: "INVALID" });
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// Import/Export Schemas
// ═══════════════════════════════════════════════════════════════

describe("exportSchema", () => {
  it("accepts valid export with entity and default format", () => {
    const result = exportSchema.safeParse({ entity: "users" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.entity).toBe("users");
      expect(result.data.format).toBe("csv");
    }
  });

  it("accepts valid export with json format", () => {
    const result = exportSchema.safeParse({ entity: "roles", format: "json" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.format).toBe("json");
    }
  });

  it("accepts valid export with csv format", () => {
    const result = exportSchema.safeParse({ entity: "users", format: "csv" });
    expect(result.success).toBe(true);
  });

  it("accepts custom-object-records entity", () => {
    const result = exportSchema.safeParse({
      entity: "custom-object-records",
      objectId: "obj-123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.entity).toBe("custom-object-records");
      expect(result.data.objectId).toBe("obj-123");
    }
  });

  it("rejects missing entity", () => {
    const result = exportSchema.safeParse({ format: "csv" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid entity", () => {
    const result = exportSchema.safeParse({ entity: "tenants" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid format", () => {
    const result = exportSchema.safeParse({ entity: "users", format: "xml" });
    expect(result.success).toBe(false);
  });

  it("accepts all valid entity values", () => {
    for (const entity of ["users", "roles", "custom-object-records"] as const) {
      const result = exportSchema.safeParse({ entity });
      expect(result.success).toBe(true);
    }
  });

  it("accepts optional objectId", () => {
    const result = exportSchema.safeParse({ entity: "users" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.objectId).toBeUndefined();
    }
  });
});

describe("importSchema", () => {
  it("accepts valid import with entity and default dryRun", () => {
    const result = importSchema.safeParse({ entity: "users" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.entity).toBe("users");
      expect(result.data.dryRun).toBe(false);
    }
  });

  it("accepts dryRun as boolean true", () => {
    const result = importSchema.safeParse({ entity: "users", dryRun: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dryRun).toBe(true);
    }
  });

  it("accepts dryRun as string 'true'", () => {
    const result = importSchema.safeParse({ entity: "users", dryRun: "true" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dryRun).toBe(true);
    }
  });

  it("treats dryRun string 'false' as false", () => {
    const result = importSchema.safeParse({ entity: "users", dryRun: "false" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dryRun).toBe(false);
    }
  });

  it("accepts custom-object-records entity with objectId", () => {
    const result = importSchema.safeParse({
      entity: "custom-object-records",
      objectId: "obj-456",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.objectId).toBe("obj-456");
    }
  });

  it("rejects missing entity", () => {
    const result = importSchema.safeParse({ dryRun: false });
    expect(result.success).toBe(false);
  });

  it("rejects invalid entity", () => {
    const result = importSchema.safeParse({ entity: "permissions" });
    expect(result.success).toBe(false);
  });

  it("accepts all valid entity values", () => {
    for (const entity of ["users", "roles", "custom-object-records"] as const) {
      const result = importSchema.safeParse({ entity });
      expect(result.success).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Settings Schemas
// ═══════════════════════════════════════════════════════════════

describe("upsertSettingSchema", () => {
  const validSetting = {
    key: "auth.max_attempts",
    value: "5",
    category: "auth" as const,
  };

  it("accepts valid data with required fields and defaults", () => {
    const result = upsertSettingSchema.safeParse(validSetting);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.key).toBe("auth.max_attempts");
      expect(result.data.value).toBe("5");
      expect(result.data.type).toBe("string");
      expect(result.data.category).toBe("auth");
      expect(result.data.scope).toBe("global");
      expect(result.data.scopeId).toBe("");
    }
  });

  it("accepts valid data with all fields", () => {
    const result = upsertSettingSchema.safeParse({
      ...validSetting,
      type: "number",
      scope: "tenant",
      scopeId: "tenant-123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("number");
      expect(result.data.scope).toBe("tenant");
      expect(result.data.scopeId).toBe("tenant-123");
    }
  });

  it("rejects missing key", () => {
    const result = upsertSettingSchema.safeParse({ value: "5", category: "auth" });
    expect(result.success).toBe(false);
  });

  it("rejects missing value", () => {
    const result = upsertSettingSchema.safeParse({ key: "auth.enabled", category: "auth" });
    expect(result.success).toBe(false);
  });

  it("rejects missing category", () => {
    const result = upsertSettingSchema.safeParse({ key: "auth.enabled", value: "true" });
    expect(result.success).toBe(false);
  });

  it("rejects empty key", () => {
    const result = upsertSettingSchema.safeParse({ key: "", value: "5", category: "auth" });
    expect(result.success).toBe(false);
  });

  it("rejects key longer than 100 characters", () => {
    const result = upsertSettingSchema.safeParse({
      key: "a" + ".b".repeat(50),
      value: "5",
      category: "auth",
    });
    expect(result.success).toBe(false);
  });

  it("rejects key starting with uppercase letter", () => {
    const result = upsertSettingSchema.safeParse({
      key: "Auth.enabled",
      value: "true",
      category: "auth",
    });
    expect(result.success).toBe(false);
  });

  it("rejects key starting with a digit", () => {
    const result = upsertSettingSchema.safeParse({
      key: "1auth",
      value: "true",
      category: "auth",
    });
    expect(result.success).toBe(false);
  });

  it("rejects key starting with underscore", () => {
    const result = upsertSettingSchema.safeParse({
      key: "_auth",
      value: "true",
      category: "auth",
    });
    expect(result.success).toBe(false);
  });

  it("rejects key with spaces", () => {
    const result = upsertSettingSchema.safeParse({
      key: "auth enabled",
      value: "true",
      category: "auth",
    });
    expect(result.success).toBe(false);
  });

  it("rejects key with hyphens", () => {
    const result = upsertSettingSchema.safeParse({
      key: "auth-enabled",
      value: "true",
      category: "auth",
    });
    expect(result.success).toBe(false);
  });

  it("accepts key with underscores and dots", () => {
    const result = upsertSettingSchema.safeParse({
      key: "auth.max_login_attempts",
      value: "5",
      category: "auth",
    });
    expect(result.success).toBe(true);
  });

  it("accepts key with digits after first character", () => {
    const result = upsertSettingSchema.safeParse({
      key: "setting123",
      value: "val",
      category: "general",
    });
    expect(result.success).toBe(true);
  });

  it("accepts all valid type values", () => {
    for (const type of SETTING_TYPES) {
      const result = upsertSettingSchema.safeParse({ ...validSetting, type });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid type", () => {
    const result = upsertSettingSchema.safeParse({ ...validSetting, type: "array" });
    expect(result.success).toBe(false);
  });

  it("accepts all valid scope values", () => {
    for (const scope of SETTING_SCOPES) {
      const result = upsertSettingSchema.safeParse({ ...validSetting, scope });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid scope", () => {
    const result = upsertSettingSchema.safeParse({ ...validSetting, scope: "organization" });
    expect(result.success).toBe(false);
  });

  it("accepts all valid category values", () => {
    for (const category of SETTING_CATEGORIES) {
      const result = upsertSettingSchema.safeParse({
        key: "test.key",
        value: "val",
        category,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid category", () => {
    const result = upsertSettingSchema.safeParse({
      key: "test.key",
      value: "val",
      category: "security",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateFlagSchema", () => {
  it("accepts empty object (all fields are optional)", () => {
    const result = updateFlagSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts enabled boolean", () => {
    const result = updateFlagSchema.safeParse({ enabled: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.enabled).toBe(true);
    }
  });

  it("accepts enabled as false", () => {
    const result = updateFlagSchema.safeParse({ enabled: false });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.enabled).toBe(false);
    }
  });

  it("accepts description", () => {
    const result = updateFlagSchema.safeParse({ description: "Enable dark mode" });
    expect(result.success).toBe(true);
  });

  it("rejects description longer than 500 characters", () => {
    const result = updateFlagSchema.safeParse({ description: "A".repeat(501) });
    expect(result.success).toBe(false);
  });

  it("accepts description at max length of 500", () => {
    const result = updateFlagSchema.safeParse({ description: "A".repeat(500) });
    expect(result.success).toBe(true);
  });

  it("accepts enabledForTenants array", () => {
    const result = updateFlagSchema.safeParse({
      enabledForTenants: ["tenant-1", "tenant-2"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.enabledForTenants).toEqual(["tenant-1", "tenant-2"]);
    }
  });

  it("accepts enabledForRoles array", () => {
    const result = updateFlagSchema.safeParse({
      enabledForRoles: ["admin", "editor"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.enabledForRoles).toEqual(["admin", "editor"]);
    }
  });

  it("accepts enabledForUsers array", () => {
    const result = updateFlagSchema.safeParse({
      enabledForUsers: ["user-1"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.enabledForUsers).toEqual(["user-1"]);
    }
  });

  it("accepts empty arrays for scoping fields", () => {
    const result = updateFlagSchema.safeParse({
      enabledForTenants: [],
      enabledForRoles: [],
      enabledForUsers: [],
    });
    expect(result.success).toBe(true);
  });

  it("accepts all fields together", () => {
    const result = updateFlagSchema.safeParse({
      enabled: true,
      description: "Full flag config",
      enabledForTenants: ["t1"],
      enabledForRoles: ["r1"],
      enabledForUsers: ["u1"],
    });
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// Password Reset Schemas
// ═══════════════════════════════════════════════════════════════

describe("forgotPasswordSchema", () => {
  it("accepts valid email", () => {
    const result = forgotPasswordSchema.safeParse({ email: "user@example.com" });
    expect(result.success).toBe(true);
  });

  it("rejects missing email", () => {
    const result = forgotPasswordSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects invalid email format", () => {
    const result = forgotPasswordSchema.safeParse({ email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects empty email", () => {
    const result = forgotPasswordSchema.safeParse({ email: "" });
    expect(result.success).toBe(false);
  });

  it("rejects email without domain", () => {
    const result = forgotPasswordSchema.safeParse({ email: "user@" });
    expect(result.success).toBe(false);
  });

  it("rejects email without @ symbol", () => {
    const result = forgotPasswordSchema.safeParse({ email: "userexample.com" });
    expect(result.success).toBe(false);
  });

  it("accepts email with subdomain", () => {
    const result = forgotPasswordSchema.safeParse({ email: "user@mail.example.com" });
    expect(result.success).toBe(true);
  });

  it("accepts email with plus addressing", () => {
    const result = forgotPasswordSchema.safeParse({ email: "user+tag@example.com" });
    expect(result.success).toBe(true);
  });
});

describe("resetPasswordSchema", () => {
  const validReset = {
    token: "reset-token-abc123",
    email: "user@example.com",
    password: "Str0ng!Pass",
    confirmPassword: "Str0ng!Pass",
  };

  it("accepts valid data", () => {
    const result = resetPasswordSchema.safeParse(validReset);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.token).toBe("reset-token-abc123");
      expect(result.data.email).toBe("user@example.com");
      expect(result.data.password).toBe("Str0ng!Pass");
      expect(result.data.confirmPassword).toBe("Str0ng!Pass");
    }
  });

  it("rejects missing token", () => {
    const { token, ...rest } = validReset;
    const result = resetPasswordSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects empty token", () => {
    const result = resetPasswordSchema.safeParse({ ...validReset, token: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing email", () => {
    const { email, ...rest } = validReset;
    const result = resetPasswordSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = resetPasswordSchema.safeParse({ ...validReset, email: "invalid" });
    expect(result.success).toBe(false);
  });

  it("rejects missing password", () => {
    const { password, ...rest } = validReset;
    const result = resetPasswordSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing confirmPassword", () => {
    const { confirmPassword, ...rest } = validReset;
    const result = resetPasswordSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects password shorter than 8 characters", () => {
    const result = resetPasswordSchema.safeParse({
      ...validReset,
      password: "Aa1!xyz",
      confirmPassword: "Aa1!xyz",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password longer than 100 characters", () => {
    const longPass = "Aa1!" + "x".repeat(97);
    const result = resetPasswordSchema.safeParse({
      ...validReset,
      password: longPass,
      confirmPassword: longPass,
    });
    expect(result.success).toBe(false);
  });

  it("rejects password without uppercase letter", () => {
    const result = resetPasswordSchema.safeParse({
      ...validReset,
      password: "str0ng!pass",
      confirmPassword: "str0ng!pass",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password without lowercase letter", () => {
    const result = resetPasswordSchema.safeParse({
      ...validReset,
      password: "STR0NG!PASS",
      confirmPassword: "STR0NG!PASS",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password without digit", () => {
    const result = resetPasswordSchema.safeParse({
      ...validReset,
      password: "Strong!Pass",
      confirmPassword: "Strong!Pass",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password without special character", () => {
    const result = resetPasswordSchema.safeParse({
      ...validReset,
      password: "Str0ngPassw",
      confirmPassword: "Str0ngPassw",
    });
    expect(result.success).toBe(false);
  });

  it("rejects mismatched passwords", () => {
    const result = resetPasswordSchema.safeParse({
      ...validReset,
      password: "Str0ng!Pass",
      confirmPassword: "Different!1Pass",
    });
    expect(result.success).toBe(false);
  });

  it("accepts password at minimum length of 8 characters", () => {
    const result = resetPasswordSchema.safeParse({
      ...validReset,
      password: "Aa1!xxxx",
      confirmPassword: "Aa1!xxxx",
    });
    expect(result.success).toBe(true);
  });

  it("accepts password at max length of 100 characters", () => {
    const pass = "Aa1!" + "x".repeat(96);
    const result = resetPasswordSchema.safeParse({
      ...validReset,
      password: pass,
      confirmPassword: pass,
    });
    expect(result.success).toBe(true);
  });

  it("accepts password with various special characters", () => {
    for (const special of ["@", "#", "$", "%", "^", "&", "*"]) {
      const pass = `Abcd1234${special}`;
      const result = resetPasswordSchema.safeParse({
        ...validReset,
        password: pass,
        confirmPassword: pass,
      });
      expect(result.success).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Organization Schema
// ═══════════════════════════════════════════════════════════════

describe("organizationSchema", () => {
  const validOrg = {
    name: "Acme Corp",
    email: "info@acme.com",
    phone: "+1-555-0100",
  };

  it("accepts valid data with required fields only", () => {
    const result = organizationSchema.safeParse(validOrg);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Acme Corp");
      expect(result.data.email).toBe("info@acme.com");
      expect(result.data.phone).toBe("+1-555-0100");
    }
  });

  it("accepts valid data with all fields", () => {
    const result = organizationSchema.safeParse({
      ...validOrg,
      website: "https://acme.com",
      address: "123 Main St",
      city: "Springfield",
      state: "IL",
      zip: "62701",
      country: "US",
      logoUrl: "https://acme.com/logo.png",
      brandTheme: "#FF5733",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.website).toBe("https://acme.com");
      expect(result.data.address).toBe("123 Main St");
      expect(result.data.city).toBe("Springfield");
      expect(result.data.state).toBe("IL");
      expect(result.data.zip).toBe("62701");
      expect(result.data.country).toBe("US");
      expect(result.data.logoUrl).toBe("https://acme.com/logo.png");
      expect(result.data.brandTheme).toBe("#FF5733");
    }
  });

  it("rejects missing name", () => {
    const result = organizationSchema.safeParse({ email: "info@acme.com", phone: "+1-555-0100" });
    expect(result.success).toBe(false);
  });

  it("rejects missing email", () => {
    const result = organizationSchema.safeParse({ name: "Acme Corp", phone: "+1-555-0100" });
    expect(result.success).toBe(false);
  });

  it("rejects missing phone", () => {
    const result = organizationSchema.safeParse({ name: "Acme Corp", email: "info@acme.com" });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = organizationSchema.safeParse({ ...validOrg, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects empty phone", () => {
    const result = organizationSchema.safeParse({ ...validOrg, phone: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = organizationSchema.safeParse({ ...validOrg, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 200 characters", () => {
    const result = organizationSchema.safeParse({ ...validOrg, name: "A".repeat(201) });
    expect(result.success).toBe(false);
  });

  it("accepts name at max length of 200", () => {
    const result = organizationSchema.safeParse({ ...validOrg, name: "A".repeat(200) });
    expect(result.success).toBe(true);
  });

  it("optional fields default to undefined when not provided", () => {
    const result = organizationSchema.safeParse(validOrg);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.website).toBeUndefined();
      expect(result.data.address).toBeUndefined();
      expect(result.data.city).toBeUndefined();
      expect(result.data.state).toBeUndefined();
      expect(result.data.zip).toBeUndefined();
      expect(result.data.country).toBeUndefined();
      expect(result.data.logoUrl).toBeUndefined();
      expect(result.data.brandTheme).toBeUndefined();
    }
  });

  it("accepts empty strings for optional fields", () => {
    const result = organizationSchema.safeParse({
      ...validOrg,
      website: "",
      address: "",
      city: "",
      state: "",
      zip: "",
      country: "",
      logoUrl: "",
      brandTheme: "",
    });
    expect(result.success).toBe(true);
  });

  it("accepts email with special characters in local part", () => {
    const result = organizationSchema.safeParse({
      ...validOrg,
      email: "info+billing@acme.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects completely empty object", () => {
    const result = organizationSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

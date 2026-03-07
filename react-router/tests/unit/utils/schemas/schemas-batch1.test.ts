import { describe, it, expect } from "vitest";

// ─── User Schemas ──────────────────────────────────────────────
import {
  SignupEmailSchema,
  SignupUsernameSchema,
  SignupPasswordSchema,
  SignupNameSchema,
  createUserSchema,
  updateUserSchema,
  changePasswordSchema as adminChangePasswordSchema,
} from "~/utils/schemas/user";

// ─── Role Schemas ──────────────────────────────────────────────
import { createRoleSchema, updateRoleSchema } from "~/utils/schemas/role";

// ─── Permission Schemas ────────────────────────────────────────
import { createPermissionSchema, updatePermissionSchema } from "~/utils/schemas/permission";

// ─── Tenant Schemas ────────────────────────────────────────────
import { createTenantSchema, updateTenantSchema } from "~/utils/schemas/tenant";

// ─── Auth Schemas ──────────────────────────────────────────────
import {
  loginSchema,
  signupSchema,
  onboardingSchema,
  verifyEmailSchema,
  twoFAVerifySchema,
  twoFASetupSchema,
  twoFARecoverySchema,
} from "~/utils/schemas/auth";

// ─── Profile Schemas ───────────────────────────────────────────
import {
  profileSchema,
  changePasswordSchema as profileChangePasswordSchema,
  changeEmailSchema,
  verifyProfileEmailSchema,
  profileTwoFAVerifySchema,
} from "~/utils/schemas/profile";

// ════════════════════════════════════════════════════════════════
// 1. USER SCHEMAS
// ════════════════════════════════════════════════════════════════

describe("SignupEmailSchema", () => {
  it("accepts a valid email", () => {
    const result = SignupEmailSchema.safeParse("User@Example.COM");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("user@example.com"); // lowercased + trimmed
    }
  });

  it("lowercases email after parsing", () => {
    const result = SignupEmailSchema.safeParse("Alice@Test.IO");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("alice@test.io");
    }
  });

  it("rejects email with leading/trailing spaces (validated before transform)", () => {
    const result = SignupEmailSchema.safeParse("  Alice@Test.IO  ");
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = SignupEmailSchema.safeParse("not-an-email");
    expect(result.success).toBe(false);
  });

  it("rejects an empty string", () => {
    const result = SignupEmailSchema.safeParse("");
    expect(result.success).toBe(false);
  });

  it("rejects a string longer than 100 characters", () => {
    const longEmail = "a".repeat(90) + "@test.com"; // 99 chars, but 90 + 9 = 99 so try longer
    const tooLong = "a".repeat(92) + "@test.com"; // 101 chars
    const result = SignupEmailSchema.safeParse(tooLong);
    expect(result.success).toBe(false);
  });

  it("rejects non-string input", () => {
    const result = SignupEmailSchema.safeParse(12345);
    expect(result.success).toBe(false);
  });
});

describe("SignupUsernameSchema", () => {
  it("accepts a valid username", () => {
    const result = SignupUsernameSchema.safeParse("john_doe");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("john_doe");
    }
  });

  it("lowercases username after parsing", () => {
    const result = SignupUsernameSchema.safeParse("JohnDoe");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("johndoe");
    }
  });

  it("rejects username with leading/trailing spaces (validated before transform)", () => {
    const result = SignupUsernameSchema.safeParse("  JohnDoe  ");
    expect(result.success).toBe(false);
  });

  it("accepts username with @, ., and -", () => {
    const result = SignupUsernameSchema.safeParse("user@name.test-1");
    expect(result.success).toBe(true);
  });

  it("rejects username shorter than 3 characters", () => {
    const result = SignupUsernameSchema.safeParse("ab");
    expect(result.success).toBe(false);
  });

  it("rejects username longer than 50 characters", () => {
    const result = SignupUsernameSchema.safeParse("a".repeat(51));
    expect(result.success).toBe(false);
  });

  it("rejects username with invalid characters", () => {
    const result = SignupUsernameSchema.safeParse("user name!");
    expect(result.success).toBe(false);
  });

  it("rejects empty string", () => {
    const result = SignupUsernameSchema.safeParse("");
    expect(result.success).toBe(false);
  });
});

describe("SignupPasswordSchema", () => {
  const validPassword = "StrongP@ss1";

  it("accepts a valid password", () => {
    const result = SignupPasswordSchema.safeParse(validPassword);
    expect(result.success).toBe(true);
  });

  it("rejects password shorter than 8 characters", () => {
    const result = SignupPasswordSchema.safeParse("Ab1!xyz");
    expect(result.success).toBe(false);
  });

  it("rejects password longer than 100 characters", () => {
    const result = SignupPasswordSchema.safeParse("Ab1!" + "x".repeat(97));
    expect(result.success).toBe(false);
  });

  it("rejects password without uppercase letter", () => {
    const result = SignupPasswordSchema.safeParse("nouppercase1!");
    expect(result.success).toBe(false);
  });

  it("rejects password without lowercase letter", () => {
    const result = SignupPasswordSchema.safeParse("NOLOWERCASE1!");
    expect(result.success).toBe(false);
  });

  it("rejects password without digit", () => {
    const result = SignupPasswordSchema.safeParse("NoDigitHere!");
    expect(result.success).toBe(false);
  });

  it("rejects password without special character", () => {
    const result = SignupPasswordSchema.safeParse("NoSpecial1x");
    expect(result.success).toBe(false);
  });

  it("rejects empty string", () => {
    const result = SignupPasswordSchema.safeParse("");
    expect(result.success).toBe(false);
  });
});

describe("SignupNameSchema", () => {
  it("accepts a valid name", () => {
    const result = SignupNameSchema.safeParse("John Doe");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("John Doe");
    }
  });

  it("trims whitespace", () => {
    const result = SignupNameSchema.safeParse("  Alice  ");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("Alice");
    }
  });

  it("rejects empty string", () => {
    const result = SignupNameSchema.safeParse("");
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 100 characters", () => {
    const result = SignupNameSchema.safeParse("A".repeat(101));
    expect(result.success).toBe(false);
  });

  it("accepts single character name", () => {
    const result = SignupNameSchema.safeParse("X");
    expect(result.success).toBe(true);
  });
});

describe("createUserSchema", () => {
  const validData = {
    email: "user@example.com",
    username: "testuser",
    password: "password123",
  };

  it("accepts valid data with all required fields", () => {
    const result = createUserSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("defaults name to empty string when omitted", () => {
    const result = createUserSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("");
    }
  });

  it("defaults status to ACTIVE when omitted", () => {
    const result = createUserSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("ACTIVE");
    }
  });

  it("accepts optional tenantId", () => {
    const result = createUserSchema.safeParse({ ...validData, tenantId: "tid123" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tenantId).toBe("tid123");
    }
  });

  it("accepts INACTIVE and SUSPENDED statuses", () => {
    expect(createUserSchema.safeParse({ ...validData, status: "INACTIVE" }).success).toBe(true);
    expect(createUserSchema.safeParse({ ...validData, status: "SUSPENDED" }).success).toBe(true);
  });

  it("rejects LOCKED status (not in create statuses)", () => {
    const result = createUserSchema.safeParse({ ...validData, status: "LOCKED" });
    expect(result.success).toBe(false);
  });

  it("rejects missing email", () => {
    const { email: _, ...rest } = validData;
    const result = createUserSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = createUserSchema.safeParse({ ...validData, email: "bad" });
    expect(result.success).toBe(false);
  });

  it("rejects missing username", () => {
    const { username: _, ...rest } = validData;
    const result = createUserSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects username shorter than 3 characters", () => {
    const result = createUserSchema.safeParse({ ...validData, username: "ab" });
    expect(result.success).toBe(false);
  });

  it("rejects username longer than 50 characters", () => {
    const result = createUserSchema.safeParse({ ...validData, username: "a".repeat(51) });
    expect(result.success).toBe(false);
  });

  it("rejects missing password", () => {
    const { password: _, ...rest } = validData;
    const result = createUserSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects password shorter than 8 characters", () => {
    const result = createUserSchema.safeParse({ ...validData, password: "short" });
    expect(result.success).toBe(false);
  });
});

describe("updateUserSchema", () => {
  const validData = {
    email: "user@example.com",
    username: "testuser",
  };

  it("accepts valid data", () => {
    const result = updateUserSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("defaults name to empty string", () => {
    const result = updateUserSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("");
    }
  });

  it("defaults status to ACTIVE", () => {
    const result = updateUserSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("ACTIVE");
    }
  });

  it("accepts LOCKED status (allowed in update)", () => {
    const result = updateUserSchema.safeParse({ ...validData, status: "LOCKED" });
    expect(result.success).toBe(true);
  });

  it("accepts all valid statuses: ACTIVE, INACTIVE, SUSPENDED, LOCKED", () => {
    for (const status of ["ACTIVE", "INACTIVE", "SUSPENDED", "LOCKED"]) {
      expect(updateUserSchema.safeParse({ ...validData, status }).success).toBe(true);
    }
  });

  it("rejects invalid status", () => {
    const result = updateUserSchema.safeParse({ ...validData, status: "DELETED" });
    expect(result.success).toBe(false);
  });

  it("rejects missing email", () => {
    const result = updateUserSchema.safeParse({ username: "testuser" });
    expect(result.success).toBe(false);
  });

  it("rejects missing username", () => {
    const result = updateUserSchema.safeParse({ email: "user@example.com" });
    expect(result.success).toBe(false);
  });
});

describe("adminChangePasswordSchema (user.ts)", () => {
  it("accepts a valid password", () => {
    const result = adminChangePasswordSchema.safeParse({ newPassword: "newpass12345" });
    expect(result.success).toBe(true);
  });

  it("rejects password shorter than 8 characters", () => {
    const result = adminChangePasswordSchema.safeParse({ newPassword: "short" });
    expect(result.success).toBe(false);
  });

  it("rejects missing newPassword", () => {
    const result = adminChangePasswordSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════
// 2. ROLE SCHEMAS
// ════════════════════════════════════════════════════════════════

describe("createRoleSchema", () => {
  it("accepts valid data with only name", () => {
    const result = createRoleSchema.safeParse({ name: "Admin" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe("");
    }
  });

  it("accepts valid data with name and description", () => {
    const result = createRoleSchema.safeParse({
      name: "Editor",
      description: "Can edit content",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = createRoleSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = createRoleSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 100 characters", () => {
    const result = createRoleSchema.safeParse({ name: "A".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("accepts name at exactly 100 characters", () => {
    const result = createRoleSchema.safeParse({ name: "A".repeat(100) });
    expect(result.success).toBe(true);
  });

  it("rejects description longer than 500 characters", () => {
    const result = createRoleSchema.safeParse({
      name: "Admin",
      description: "D".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("accepts description at exactly 500 characters", () => {
    const result = createRoleSchema.safeParse({
      name: "Admin",
      description: "D".repeat(500),
    });
    expect(result.success).toBe(true);
  });
});

describe("updateRoleSchema", () => {
  it("accepts valid data", () => {
    const result = updateRoleSchema.safeParse({ name: "Viewer" });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = updateRoleSchema.safeParse({ description: "some desc" });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = updateRoleSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("defaults description to empty string when omitted", () => {
    const result = updateRoleSchema.safeParse({ name: "Manager" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe("");
    }
  });
});

// ════════════════════════════════════════════════════════════════
// 3. PERMISSION SCHEMAS
// ════════════════════════════════════════════════════════════════

describe("createPermissionSchema", () => {
  const validData = { resource: "user", action: "read" };

  it("accepts valid data", () => {
    const result = createPermissionSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("defaults description to empty string", () => {
    const result = createPermissionSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe("");
    }
  });

  it("accepts optional description", () => {
    const result = createPermissionSchema.safeParse({
      ...validData,
      description: "Can read user data",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing resource", () => {
    const result = createPermissionSchema.safeParse({ action: "read" });
    expect(result.success).toBe(false);
  });

  it("rejects empty resource", () => {
    const result = createPermissionSchema.safeParse({ resource: "", action: "read" });
    expect(result.success).toBe(false);
  });

  it("rejects missing action", () => {
    const result = createPermissionSchema.safeParse({ resource: "user" });
    expect(result.success).toBe(false);
  });

  it("rejects empty action", () => {
    const result = createPermissionSchema.safeParse({ resource: "user", action: "" });
    expect(result.success).toBe(false);
  });

  it("rejects resource longer than 100 characters", () => {
    const result = createPermissionSchema.safeParse({
      resource: "R".repeat(101),
      action: "read",
    });
    expect(result.success).toBe(false);
  });

  it("rejects action longer than 100 characters", () => {
    const result = createPermissionSchema.safeParse({
      resource: "user",
      action: "A".repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it("rejects description longer than 500 characters", () => {
    const result = createPermissionSchema.safeParse({
      ...validData,
      description: "D".repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

describe("updatePermissionSchema", () => {
  it("accepts empty object (description defaults to empty string)", () => {
    const result = updatePermissionSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe("");
    }
  });

  it("accepts a description", () => {
    const result = updatePermissionSchema.safeParse({ description: "Updated desc" });
    expect(result.success).toBe(true);
  });

  it("rejects description longer than 500 characters", () => {
    const result = updatePermissionSchema.safeParse({ description: "D".repeat(501) });
    expect(result.success).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════
// 4. TENANT SCHEMAS
// ════════════════════════════════════════════════════════════════

describe("createTenantSchema", () => {
  const validData = {
    name: "Acme Corp",
    slug: "acme-corp",
    email: "admin@acme.com",
    phone: "+1234567890",
  };

  it("accepts valid data with only required fields", () => {
    const result = createTenantSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("defaults optional fields", () => {
    const result = createTenantSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.address).toBe("");
      expect(result.data.city).toBe("");
      expect(result.data.state).toBe("");
      expect(result.data.zip).toBe("");
      expect(result.data.country).toBe("");
      expect(result.data.subscriptionPlan).toBe("free");
    }
  });

  it("accepts all subscription plans", () => {
    for (const plan of ["free", "starter", "professional", "enterprise"]) {
      const result = createTenantSchema.safeParse({ ...validData, subscriptionPlan: plan });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid subscription plan", () => {
    const result = createTenantSchema.safeParse({ ...validData, subscriptionPlan: "gold" });
    expect(result.success).toBe(false);
  });

  it("rejects missing name", () => {
    const { name: _, ...rest } = validData;
    const result = createTenantSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = createTenantSchema.safeParse({ ...validData, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 200 characters", () => {
    const result = createTenantSchema.safeParse({ ...validData, name: "N".repeat(201) });
    expect(result.success).toBe(false);
  });

  // ─── Slug validation ───────────────────────────────────────
  it("rejects missing slug", () => {
    const { slug: _, ...rest } = validData;
    const result = createTenantSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects empty slug", () => {
    const result = createTenantSchema.safeParse({ ...validData, slug: "" });
    expect(result.success).toBe(false);
  });

  it("rejects slug starting with a hyphen", () => {
    const result = createTenantSchema.safeParse({ ...validData, slug: "-my-slug" });
    expect(result.success).toBe(false);
  });

  it("rejects slug ending with a hyphen", () => {
    const result = createTenantSchema.safeParse({ ...validData, slug: "my-slug-" });
    expect(result.success).toBe(false);
  });

  it("rejects slug with uppercase letters", () => {
    const result = createTenantSchema.safeParse({ ...validData, slug: "MySlug" });
    expect(result.success).toBe(false);
  });

  it("rejects slug with special characters", () => {
    const result = createTenantSchema.safeParse({ ...validData, slug: "my_slug!" });
    expect(result.success).toBe(false);
  });

  it("accepts single character slug", () => {
    const result = createTenantSchema.safeParse({ ...validData, slug: "a" });
    expect(result.success).toBe(true);
  });

  it("accepts slug with hyphens in the middle", () => {
    const result = createTenantSchema.safeParse({ ...validData, slug: "my-cool-slug" });
    expect(result.success).toBe(true);
  });

  it("rejects slug longer than 50 characters", () => {
    const result = createTenantSchema.safeParse({ ...validData, slug: "a".repeat(51) });
    expect(result.success).toBe(false);
  });

  it("rejects reserved slugs", () => {
    for (const reserved of ["auth", "api", "kiosk", "delegation", "resources", "up"]) {
      const result = createTenantSchema.safeParse({ ...validData, slug: reserved });
      expect(result.success).toBe(false);
    }
  });

  // ─── Email & Phone ─────────────────────────────────────────
  it("rejects missing email", () => {
    const { email: _, ...rest } = validData;
    const result = createTenantSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = createTenantSchema.safeParse({ ...validData, email: "not-email" });
    expect(result.success).toBe(false);
  });

  it("rejects missing phone", () => {
    const { phone: _, ...rest } = validData;
    const result = createTenantSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects empty phone", () => {
    const result = createTenantSchema.safeParse({ ...validData, phone: "" });
    expect(result.success).toBe(false);
  });

  // ─── Website ───────────────────────────────────────────────
  it("accepts valid website URL", () => {
    const result = createTenantSchema.safeParse({
      ...validData,
      website: "https://acme.com",
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty string for website", () => {
    const result = createTenantSchema.safeParse({ ...validData, website: "" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid website URL", () => {
    const result = createTenantSchema.safeParse({ ...validData, website: "not-a-url" });
    expect(result.success).toBe(false);
  });

  // ─── Admin user refinement ────────────────────────────────
  it("accepts when both admin email and password are provided", () => {
    const result = createTenantSchema.safeParse({
      ...validData,
      adminEmail: "admin@test.com",
      adminPassword: "securepass1",
    });
    expect(result.success).toBe(true);
  });

  it("accepts when neither admin email nor password is provided", () => {
    const result = createTenantSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("rejects when admin email is provided without password", () => {
    const result = createTenantSchema.safeParse({
      ...validData,
      adminEmail: "admin@test.com",
    });
    expect(result.success).toBe(false);
  });

  it("rejects when admin password is provided without email", () => {
    const result = createTenantSchema.safeParse({
      ...validData,
      adminPassword: "securepass1",
    });
    expect(result.success).toBe(false);
  });

  it("accepts when both admin email and password are empty strings", () => {
    const result = createTenantSchema.safeParse({
      ...validData,
      adminEmail: "",
      adminPassword: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects admin password shorter than 8 characters when provided", () => {
    const result = createTenantSchema.safeParse({
      ...validData,
      adminEmail: "admin@test.com",
      adminPassword: "short",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateTenantSchema", () => {
  const validData = {
    name: "Acme Corp",
    slug: "acme-corp",
    email: "admin@acme.com",
    phone: "+1234567890",
    subscriptionPlan: "free" as const,
  };

  it("accepts valid data", () => {
    const result = updateTenantSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("requires subscriptionPlan (no default)", () => {
    const { subscriptionPlan: _, ...rest } = validData;
    const result = updateTenantSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing slug", () => {
    const { slug: _, ...rest } = validData;
    const result = updateTenantSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects reserved slug", () => {
    const result = updateTenantSchema.safeParse({ ...validData, slug: "api" });
    expect(result.success).toBe(false);
  });

  it("defaults optional string fields", () => {
    const result = updateTenantSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.address).toBe("");
      expect(result.data.city).toBe("");
      expect(result.data.state).toBe("");
      expect(result.data.zip).toBe("");
      expect(result.data.country).toBe("");
    }
  });

  it("accepts empty string for logoUrl and brandTheme", () => {
    const result = updateTenantSchema.safeParse({
      ...validData,
      logoUrl: "",
      brandTheme: "",
    });
    expect(result.success).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════
// 5. AUTH SCHEMAS
// ════════════════════════════════════════════════════════════════

describe("loginSchema", () => {
  it("accepts valid email and password", () => {
    const result = loginSchema.safeParse({
      email: "user@test.com",
      password: "mypassword",
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional redirectTo", () => {
    const result = loginSchema.safeParse({
      email: "user@test.com",
      password: "pass",
      redirectTo: "/dashboard",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = loginSchema.safeParse({
      email: "not-email",
      password: "pass",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing email", () => {
    const result = loginSchema.safeParse({ password: "pass" });
    expect(result.success).toBe(false);
  });

  it("rejects missing password", () => {
    const result = loginSchema.safeParse({ email: "user@test.com" });
    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({ email: "user@test.com", password: "" });
    expect(result.success).toBe(false);
  });
});

describe("signupSchema", () => {
  it("accepts a valid email", () => {
    const result = signupSchema.safeParse({ email: "user@test.com" });
    expect(result.success).toBe(true);
  });

  it("lowercases email after parsing", () => {
    const result = signupSchema.safeParse({ email: "USER@TEST.COM" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@test.com");
    }
  });

  it("rejects email with leading/trailing spaces (validated before transform)", () => {
    const result = signupSchema.safeParse({ email: "  USER@TEST.COM  " });
    expect(result.success).toBe(false);
  });

  it("rejects missing email", () => {
    const result = signupSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = signupSchema.safeParse({ email: "bad" });
    expect(result.success).toBe(false);
  });
});

describe("onboardingSchema", () => {
  const validData = {
    username: "johndoe",
    name: "John Doe",
    password: "Str0ng!Pass",
    confirmPassword: "Str0ng!Pass",
    agreeToTerms: "on",
  };

  it("accepts valid data", () => {
    const result = onboardingSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("accepts agreeToTerms as boolean true", () => {
    const result = onboardingSchema.safeParse({ ...validData, agreeToTerms: true });
    expect(result.success).toBe(true);
  });

  it("rejects when passwords do not match", () => {
    const result = onboardingSchema.safeParse({
      ...validData,
      confirmPassword: "Different1!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects when agreeToTerms is false", () => {
    const result = onboardingSchema.safeParse({ ...validData, agreeToTerms: false });
    expect(result.success).toBe(false);
  });

  it("rejects when agreeToTerms is missing", () => {
    const { agreeToTerms: _, ...rest } = validData;
    const result = onboardingSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing username", () => {
    const { username: _, ...rest } = validData;
    const result = onboardingSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing name", () => {
    const { name: _, ...rest } = validData;
    const result = onboardingSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects empty confirmPassword", () => {
    const result = onboardingSchema.safeParse({ ...validData, confirmPassword: "" });
    expect(result.success).toBe(false);
  });

  it("rejects weak password (no uppercase)", () => {
    const result = onboardingSchema.safeParse({
      ...validData,
      password: "weakpass1!",
      confirmPassword: "weakpass1!",
    });
    expect(result.success).toBe(false);
  });
});

describe("verifyEmailSchema", () => {
  it("accepts valid code with verify intent", () => {
    const result = verifyEmailSchema.safeParse({ code: "123456", intent: "verify" });
    expect(result.success).toBe(true);
  });

  it("accepts valid code with resend intent", () => {
    const result = verifyEmailSchema.safeParse({ code: "abcdef", intent: "resend" });
    expect(result.success).toBe(true);
  });

  it("rejects code shorter than 6 characters", () => {
    const result = verifyEmailSchema.safeParse({ code: "12345", intent: "verify" });
    expect(result.success).toBe(false);
  });

  it("rejects code longer than 6 characters", () => {
    const result = verifyEmailSchema.safeParse({ code: "1234567", intent: "verify" });
    expect(result.success).toBe(false);
  });

  it("rejects missing code", () => {
    const result = verifyEmailSchema.safeParse({ intent: "verify" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid intent", () => {
    const result = verifyEmailSchema.safeParse({ code: "123456", intent: "other" });
    expect(result.success).toBe(false);
  });

  it("rejects missing intent", () => {
    const result = verifyEmailSchema.safeParse({ code: "123456" });
    expect(result.success).toBe(false);
  });
});

describe("twoFAVerifySchema", () => {
  it("accepts a 6-character code", () => {
    const result = twoFAVerifySchema.safeParse({ code: "123456" });
    expect(result.success).toBe(true);
  });

  it("rejects code shorter than 6 characters", () => {
    const result = twoFAVerifySchema.safeParse({ code: "12345" });
    expect(result.success).toBe(false);
  });

  it("rejects code longer than 6 characters", () => {
    const result = twoFAVerifySchema.safeParse({ code: "1234567" });
    expect(result.success).toBe(false);
  });

  it("rejects missing code", () => {
    const result = twoFAVerifySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("twoFASetupSchema", () => {
  it("accepts a 6-character code", () => {
    const result = twoFASetupSchema.safeParse({ code: "654321" });
    expect(result.success).toBe(true);
  });

  it("rejects code shorter than 6 characters", () => {
    const result = twoFASetupSchema.safeParse({ code: "123" });
    expect(result.success).toBe(false);
  });

  it("rejects code longer than 6 characters", () => {
    const result = twoFASetupSchema.safeParse({ code: "12345678" });
    expect(result.success).toBe(false);
  });
});

describe("twoFARecoverySchema", () => {
  it("accepts a non-empty recovery code", () => {
    const result = twoFARecoverySchema.safeParse({ code: "recovery-code-123" });
    expect(result.success).toBe(true);
  });

  it("rejects empty recovery code", () => {
    const result = twoFARecoverySchema.safeParse({ code: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing code", () => {
    const result = twoFARecoverySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════
// 6. PROFILE SCHEMAS
// ════════════════════════════════════════════════════════════════

describe("profileSchema", () => {
  const validData = {
    name: "Jane Doe",
    username: "janedoe",
  };

  it("accepts valid data", () => {
    const result = profileSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("accepts optional photoUrl", () => {
    const result = profileSchema.safeParse({ ...validData, photoUrl: "https://example.com/pic.jpg" });
    expect(result.success).toBe(true);
  });

  it("accepts data without photoUrl", () => {
    const result = profileSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.photoUrl).toBeUndefined();
    }
  });

  it("rejects missing name", () => {
    const result = profileSchema.safeParse({ username: "janedoe" });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = profileSchema.safeParse({ ...validData, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 200 characters", () => {
    const result = profileSchema.safeParse({ ...validData, name: "N".repeat(201) });
    expect(result.success).toBe(false);
  });

  it("rejects missing username", () => {
    const result = profileSchema.safeParse({ name: "Jane" });
    expect(result.success).toBe(false);
  });

  it("rejects username shorter than 3 characters", () => {
    const result = profileSchema.safeParse({ ...validData, username: "ab" });
    expect(result.success).toBe(false);
  });

  it("rejects username longer than 50 characters", () => {
    const result = profileSchema.safeParse({ ...validData, username: "a".repeat(51) });
    expect(result.success).toBe(false);
  });

  it("accepts username with hyphens and underscores", () => {
    const result = profileSchema.safeParse({ ...validData, username: "jane-doe_1" });
    expect(result.success).toBe(true);
  });

  it("rejects username with invalid characters (spaces, @, .)", () => {
    expect(profileSchema.safeParse({ ...validData, username: "jane doe" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...validData, username: "jane@doe" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...validData, username: "jane.doe" }).success).toBe(false);
  });
});

describe("profileChangePasswordSchema (profile.ts)", () => {
  const validData = {
    currentPassword: "OldPass123!",
    newPassword: "NewPass456!",
    confirmPassword: "NewPass456!",
  };

  it("accepts valid data", () => {
    const result = profileChangePasswordSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("rejects when passwords do not match", () => {
    const result = profileChangePasswordSchema.safeParse({
      ...validData,
      confirmPassword: "Mismatch1!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing currentPassword", () => {
    const { currentPassword: _, ...rest } = validData;
    const result = profileChangePasswordSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects empty currentPassword", () => {
    const result = profileChangePasswordSchema.safeParse({
      ...validData,
      currentPassword: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects newPassword shorter than 8 characters", () => {
    const result = profileChangePasswordSchema.safeParse({
      ...validData,
      newPassword: "Ab1!",
      confirmPassword: "Ab1!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects newPassword without uppercase letter", () => {
    const result = profileChangePasswordSchema.safeParse({
      ...validData,
      newPassword: "nouppercase1!",
      confirmPassword: "nouppercase1!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects newPassword without lowercase letter", () => {
    const result = profileChangePasswordSchema.safeParse({
      ...validData,
      newPassword: "NOLOWERCASE1!",
      confirmPassword: "NOLOWERCASE1!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects newPassword without digit", () => {
    const result = profileChangePasswordSchema.safeParse({
      ...validData,
      newPassword: "NoDigitHere!",
      confirmPassword: "NoDigitHere!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects newPassword without special character", () => {
    const result = profileChangePasswordSchema.safeParse({
      ...validData,
      newPassword: "NoSpecial1x",
      confirmPassword: "NoSpecial1x",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty confirmPassword", () => {
    const result = profileChangePasswordSchema.safeParse({
      ...validData,
      confirmPassword: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("changeEmailSchema", () => {
  it("accepts a valid email", () => {
    const result = changeEmailSchema.safeParse({ newEmail: "new@example.com" });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = changeEmailSchema.safeParse({ newEmail: "not-email" });
    expect(result.success).toBe(false);
  });

  it("rejects missing newEmail", () => {
    const result = changeEmailSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects empty newEmail", () => {
    const result = changeEmailSchema.safeParse({ newEmail: "" });
    expect(result.success).toBe(false);
  });
});

describe("verifyProfileEmailSchema", () => {
  it("accepts valid code with verify intent", () => {
    const result = verifyProfileEmailSchema.safeParse({ code: "123456", intent: "verify" });
    expect(result.success).toBe(true);
  });

  it("accepts valid code with resend intent", () => {
    const result = verifyProfileEmailSchema.safeParse({ code: "abcdef", intent: "resend" });
    expect(result.success).toBe(true);
  });

  it("rejects code shorter than 6 characters", () => {
    const result = verifyProfileEmailSchema.safeParse({ code: "12345", intent: "verify" });
    expect(result.success).toBe(false);
  });

  it("rejects code longer than 6 characters", () => {
    const result = verifyProfileEmailSchema.safeParse({ code: "1234567", intent: "verify" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid intent", () => {
    const result = verifyProfileEmailSchema.safeParse({ code: "123456", intent: "cancel" });
    expect(result.success).toBe(false);
  });
});

describe("profileTwoFAVerifySchema", () => {
  it("accepts valid code with verify intent", () => {
    const result = profileTwoFAVerifySchema.safeParse({ code: "123456", intent: "verify" });
    expect(result.success).toBe(true);
  });

  it("accepts valid code with cancel intent", () => {
    const result = profileTwoFAVerifySchema.safeParse({ code: "654321", intent: "cancel" });
    expect(result.success).toBe(true);
  });

  it("rejects code shorter than 6 characters", () => {
    const result = profileTwoFAVerifySchema.safeParse({ code: "123", intent: "verify" });
    expect(result.success).toBe(false);
  });

  it("rejects code longer than 6 characters", () => {
    const result = profileTwoFAVerifySchema.safeParse({ code: "1234567", intent: "verify" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid intent", () => {
    const result = profileTwoFAVerifySchema.safeParse({ code: "123456", intent: "resend" });
    expect(result.success).toBe(false);
  });

  it("rejects missing intent", () => {
    const result = profileTwoFAVerifySchema.safeParse({ code: "123456" });
    expect(result.success).toBe(false);
  });

  it("rejects missing code", () => {
    const result = profileTwoFAVerifySchema.safeParse({ intent: "verify" });
    expect(result.success).toBe(false);
  });
});

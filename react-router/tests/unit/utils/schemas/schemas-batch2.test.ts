import { describe, it, expect } from "vitest";

import { inviteUserSchema, acceptInviteSchema } from "~/utils/schemas/invitation";

// ──────────────────────────────────────────────────────────
// Invitation schemas
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

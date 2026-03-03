import { describe, it, expect, vi } from "vitest";

vi.mock("~/lib/env.server", () => ({
  env: {
    BCRYPT_ROUNDS: 4,
  },
}));

import { hashPassword, verifyPassword } from "../auth.server";

describe("auth.server", () => {
  describe("hashPassword", () => {
    it("should produce a bcrypt hash", async () => {
      const hash = await hashPassword("my-password");
      expect(hash).toMatch(/^\$2[aby]?\$/);
    });

    it("should produce different hashes for the same password", async () => {
      const hash1 = await hashPassword("same-password");
      const hash2 = await hashPassword("same-password");
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("verifyPassword", () => {
    it("should return true for correct password", async () => {
      const hash = await hashPassword("correct-password");
      const result = await verifyPassword("correct-password", hash);
      expect(result).toBe(true);
    });

    it("should return false for incorrect password", async () => {
      const hash = await hashPassword("correct-password");
      const result = await verifyPassword("wrong-password", hash);
      expect(result).toBe(false);
    });

    it("should return false for invalid hash (fail-safe)", async () => {
      const result = await verifyPassword("any-password", "not-a-valid-hash");
      expect(result).toBe(false);
    });
  });
});

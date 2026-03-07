import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRecoveryCodeDeleteMany = vi.fn();
const mockRecoveryCodeCreate = vi.fn();
const mockRecoveryCodeFindMany = vi.fn();
const mockRecoveryCodeUpdate = vi.fn();
const mockRecoveryCodeCount = vi.fn();

vi.mock("~/utils/db/db.server", () => ({
  prisma: {
    recoveryCode: {
      deleteMany: (...args: unknown[]) => mockRecoveryCodeDeleteMany(...args),
      create: (...args: unknown[]) => mockRecoveryCodeCreate(...args),
      findMany: (...args: unknown[]) => mockRecoveryCodeFindMany(...args),
      update: (...args: unknown[]) => mockRecoveryCodeUpdate(...args),
      count: (...args: unknown[]) => mockRecoveryCodeCount(...args),
    },
  },
}));

vi.mock("~/utils/config/env.server", () => ({
  env: { BCRYPT_ROUNDS: 4 },
}));

describe("recovery-codes.server", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ─── generateRecoveryCodes ──────────────────────────────

  describe("generateRecoveryCodes", () => {
    it("deletes existing codes before generating new ones", async () => {
      const { generateRecoveryCodes } = await import("~/services/recovery-codes.server");
      mockRecoveryCodeDeleteMany.mockResolvedValue({ count: 3 });
      mockRecoveryCodeCreate.mockResolvedValue({});

      await generateRecoveryCodes("user-1");

      expect(mockRecoveryCodeDeleteMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
      });
      expect(mockRecoveryCodeDeleteMany).toHaveBeenCalledTimes(1);
    });

    it("generates exactly 10 codes", async () => {
      const { generateRecoveryCodes } = await import("~/services/recovery-codes.server");
      mockRecoveryCodeDeleteMany.mockResolvedValue({ count: 0 });
      mockRecoveryCodeCreate.mockResolvedValue({});

      const codes = await generateRecoveryCodes("user-1");

      expect(codes).toHaveLength(10);
      expect(mockRecoveryCodeCreate).toHaveBeenCalledTimes(10);
    });

    it("returns codes that are 8-character lowercase alphanumeric strings", async () => {
      const { generateRecoveryCodes } = await import("~/services/recovery-codes.server");
      mockRecoveryCodeDeleteMany.mockResolvedValue({ count: 0 });
      mockRecoveryCodeCreate.mockResolvedValue({});

      const codes = await generateRecoveryCodes("user-1");

      for (const code of codes) {
        expect(code).toMatch(/^[a-z0-9]{8}$/);
      }
    });

    it("stores bcrypt hashes, not raw codes", async () => {
      const { generateRecoveryCodes } = await import("~/services/recovery-codes.server");
      mockRecoveryCodeDeleteMany.mockResolvedValue({ count: 0 });
      mockRecoveryCodeCreate.mockResolvedValue({});

      const codes = await generateRecoveryCodes("user-1");

      for (let i = 0; i < 10; i++) {
        const createCall = mockRecoveryCodeCreate.mock.calls[i][0];
        expect(createCall.data.userId).toBe("user-1");
        // The stored hash should NOT be the raw code
        expect(createCall.data.codeHash).not.toBe(codes[i]);
        // It should be a bcrypt hash
        expect(createCall.data.codeHash).toMatch(/^\$2[aby]?\$/);
      }
    });

    it("generates unique codes", async () => {
      const { generateRecoveryCodes } = await import("~/services/recovery-codes.server");
      mockRecoveryCodeDeleteMany.mockResolvedValue({ count: 0 });
      mockRecoveryCodeCreate.mockResolvedValue({});

      const codes = await generateRecoveryCodes("user-1");
      const unique = new Set(codes);

      // With 36^8 possible codes, collisions are astronomically unlikely
      expect(unique.size).toBe(10);
    });

    it("creates each code with the correct userId", async () => {
      const { generateRecoveryCodes } = await import("~/services/recovery-codes.server");
      mockRecoveryCodeDeleteMany.mockResolvedValue({ count: 0 });
      mockRecoveryCodeCreate.mockResolvedValue({});

      await generateRecoveryCodes("user-42");

      for (let i = 0; i < 10; i++) {
        const createCall = mockRecoveryCodeCreate.mock.calls[i][0];
        expect(createCall.data.userId).toBe("user-42");
      }
    });
  });

  // ─── validateRecoveryCode ───────────────────────────────

  describe("validateRecoveryCode", () => {
    it("returns true and marks code as used when code matches", async () => {
      const bcryptjs = await import("bcryptjs");
      const rawCode = "abcd1234";
      const codeHash = await bcryptjs.hash(rawCode, 4);

      mockRecoveryCodeFindMany.mockResolvedValue([
        { id: "rc-1", codeHash },
      ]);
      mockRecoveryCodeUpdate.mockResolvedValue({});

      const { validateRecoveryCode } = await import("~/services/recovery-codes.server");
      const result = await validateRecoveryCode("user-1", rawCode);

      expect(result).toBe(true);
      expect(mockRecoveryCodeUpdate).toHaveBeenCalledWith({
        where: { id: "rc-1" },
        data: { usedAt: expect.any(Date) },
      });
    });

    it("returns false when no codes exist for user", async () => {
      mockRecoveryCodeFindMany.mockResolvedValue([]);

      const { validateRecoveryCode } = await import("~/services/recovery-codes.server");
      const result = await validateRecoveryCode("user-1", "abcd1234");

      expect(result).toBe(false);
      expect(mockRecoveryCodeUpdate).not.toHaveBeenCalled();
    });

    it("returns false when code does not match any stored hash", async () => {
      const bcryptjs = await import("bcryptjs");
      const storedHash = await bcryptjs.hash("realcode", 4);

      mockRecoveryCodeFindMany.mockResolvedValue([
        { id: "rc-1", codeHash: storedHash },
      ]);

      const { validateRecoveryCode } = await import("~/services/recovery-codes.server");
      const result = await validateRecoveryCode("user-1", "wrongcode");

      expect(result).toBe(false);
      expect(mockRecoveryCodeUpdate).not.toHaveBeenCalled();
    });

    it("only queries unused codes (usedAt: null)", async () => {
      mockRecoveryCodeFindMany.mockResolvedValue([]);

      const { validateRecoveryCode } = await import("~/services/recovery-codes.server");
      await validateRecoveryCode("user-1", "testcode");

      expect(mockRecoveryCodeFindMany).toHaveBeenCalledWith({
        where: { userId: "user-1", usedAt: null },
      });
    });

    it("trims and lowercases the input code before comparing", async () => {
      const bcryptjs = await import("bcryptjs");
      const rawCode = "abcd1234";
      const codeHash = await bcryptjs.hash(rawCode, 4);

      mockRecoveryCodeFindMany.mockResolvedValue([
        { id: "rc-1", codeHash },
      ]);
      mockRecoveryCodeUpdate.mockResolvedValue({});

      const { validateRecoveryCode } = await import("~/services/recovery-codes.server");
      // Pass with leading/trailing spaces and uppercase
      const result = await validateRecoveryCode("user-1", "  ABCD1234  ");

      expect(result).toBe(true);
    });

    it("matches the correct code among multiple stored codes", async () => {
      const bcryptjs = await import("bcryptjs");
      const code1Hash = await bcryptjs.hash("aaaaaaaa", 4);
      const code2Hash = await bcryptjs.hash("bbbbbbbb", 4);
      const code3Hash = await bcryptjs.hash("cccccccc", 4);

      mockRecoveryCodeFindMany.mockResolvedValue([
        { id: "rc-1", codeHash: code1Hash },
        { id: "rc-2", codeHash: code2Hash },
        { id: "rc-3", codeHash: code3Hash },
      ]);
      mockRecoveryCodeUpdate.mockResolvedValue({});

      const { validateRecoveryCode } = await import("~/services/recovery-codes.server");
      const result = await validateRecoveryCode("user-1", "bbbbbbbb");

      expect(result).toBe(true);
      expect(mockRecoveryCodeUpdate).toHaveBeenCalledWith({
        where: { id: "rc-2" },
        data: { usedAt: expect.any(Date) },
      });
    });

    it("only marks the first matching code as used", async () => {
      const bcryptjs = await import("bcryptjs");
      // In practice codes are unique, but verify only first match is consumed
      const codeHash = await bcryptjs.hash("abcd1234", 4);

      mockRecoveryCodeFindMany.mockResolvedValue([
        { id: "rc-1", codeHash },
      ]);
      mockRecoveryCodeUpdate.mockResolvedValue({});

      const { validateRecoveryCode } = await import("~/services/recovery-codes.server");
      await validateRecoveryCode("user-1", "abcd1234");

      expect(mockRecoveryCodeUpdate).toHaveBeenCalledTimes(1);
    });
  });

  // ─── getRemainingCodeCount ──────────────────────────────

  describe("getRemainingCodeCount", () => {
    it("returns count of unused codes", async () => {
      const { getRemainingCodeCount } = await import("~/services/recovery-codes.server");
      mockRecoveryCodeCount.mockResolvedValue(7);

      const count = await getRemainingCodeCount("user-1");

      expect(count).toBe(7);
      expect(mockRecoveryCodeCount).toHaveBeenCalledWith({
        where: { userId: "user-1", usedAt: null },
      });
    });

    it("returns 0 when all codes are used", async () => {
      const { getRemainingCodeCount } = await import("~/services/recovery-codes.server");
      mockRecoveryCodeCount.mockResolvedValue(0);

      const count = await getRemainingCodeCount("user-1");

      expect(count).toBe(0);
    });

    it("returns 10 when no codes have been used", async () => {
      const { getRemainingCodeCount } = await import("~/services/recovery-codes.server");
      mockRecoveryCodeCount.mockResolvedValue(10);

      const count = await getRemainingCodeCount("user-1");

      expect(count).toBe(10);
    });
  });
});

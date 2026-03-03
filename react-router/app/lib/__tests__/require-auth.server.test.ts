import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCount = vi.fn();

vi.mock("~/lib/env.server", () => ({
  env: {
    SESSION_SECRET: "test-secret-at-least-16-chars-long",
    SESSION_MAX_AGE: 2592000000,
    NODE_ENV: "test",
  },
}));

vi.mock("~/lib/db.server", () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
    },
    userRole: {
      count: mockCount,
    },
  },
}));

vi.mock("~/lib/session.server", () => ({
  requireUser: vi.fn(),
  getUserId: vi.fn(),
}));

describe("require-auth.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("hasPermission", () => {
    it("should return true when user has the permission", async () => {
      mockCount.mockResolvedValue(1);
      const { hasPermission } = await import("../require-auth.server");

      const result = await hasPermission("user-1", "participant", "read");
      expect(result).toBe(true);
      expect(mockCount).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          role: {
            rolePermissions: {
              some: {
                permission: { resource: "participant", action: "read" },
              },
            },
          },
        },
      });
    });

    it("should return false when user lacks the permission", async () => {
      mockCount.mockResolvedValue(0);
      const { hasPermission } = await import("../require-auth.server");

      const result = await hasPermission("user-1", "settings", "manage");
      expect(result).toBe(false);
    });

    it("should return false on database error (fail-safe)", async () => {
      mockCount.mockRejectedValue(new Error("DB error"));
      const { hasPermission } = await import("../require-auth.server");

      const result = await hasPermission("user-1", "participant", "read");
      expect(result).toBe(false);
    });
  });
});

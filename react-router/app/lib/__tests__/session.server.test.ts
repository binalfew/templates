import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("~/lib/config/env.server", () => ({
  env: {
    SESSION_SECRET: "test-secret-at-least-16-chars-long",
    SESSION_MAX_AGE: 2592000000,
    NODE_ENV: "test",
  },
}));

vi.mock("~/lib/db/db.server", () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
    },
  },
}));

describe("session.server", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe("getUserId", () => {
    it("should return null when no session cookie is present", async () => {
      const { getUserId } = await import("../auth/session.server");
      const request = new Request("http://localhost:3000/admin");
      const userId = await getUserId(request);
      expect(userId).toBeNull();
    });
  });

  describe("requireUserId", () => {
    it("should throw a redirect to /auth/login when no session", async () => {
      const { requireUserId } = await import("../auth/session.server");
      const request = new Request("http://localhost:3000/admin");

      try {
        await requireUserId(request);
        expect.fail("Should have thrown a redirect");
      } catch (response) {
        expect(response).toBeInstanceOf(Response);
        const res = response as Response;
        expect(res.status).toBe(302);
        const location = res.headers.get("Location");
        expect(location).toContain("/auth/login");
        expect(location).toContain("redirectTo=%2Fadmin");
      }
    });

    it("should preserve custom redirectTo path", async () => {
      const { requireUserId } = await import("../auth/session.server");
      const request = new Request("http://localhost:3000/admin/settings");

      try {
        await requireUserId(request, "/custom-path");
        expect.fail("Should have thrown a redirect");
      } catch (response) {
        const res = response as Response;
        const location = res.headers.get("Location");
        expect(location).toContain("redirectTo=%2Fcustom-path");
      }
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

describe("request-context.server", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("buildServiceContext", () => {
    it("should build context with userId and no tenantId when not provided", async () => {
      const { buildServiceContext } = await import("~/lib/request-context.server");

      const request = new Request("http://localhost:3000/test");
      const user = { id: "user-1" };

      const ctx = buildServiceContext(request, user);

      expect(ctx.userId).toBe("user-1");
      expect(ctx.tenantId).toBeUndefined();
      expect(ctx.ipAddress).toBeUndefined();
      expect(ctx.userAgent).toBeUndefined();
    });

    it("should use user.tenantId when tenantId argument is not provided", async () => {
      const { buildServiceContext } = await import("~/lib/request-context.server");

      const request = new Request("http://localhost:3000/test");
      const user = { id: "user-1", tenantId: "tenant-from-user" };

      const ctx = buildServiceContext(request, user);

      expect(ctx.userId).toBe("user-1");
      expect(ctx.tenantId).toBe("tenant-from-user");
    });

    it("should prefer explicit tenantId argument over user.tenantId", async () => {
      const { buildServiceContext } = await import("~/lib/request-context.server");

      const request = new Request("http://localhost:3000/test");
      const user = { id: "user-1", tenantId: "tenant-from-user" };

      const ctx = buildServiceContext(request, user, "explicit-tenant");

      expect(ctx.tenantId).toBe("explicit-tenant");
    });

    it("should extract x-forwarded-for header as ipAddress", async () => {
      const { buildServiceContext } = await import("~/lib/request-context.server");

      const request = new Request("http://localhost:3000/test", {
        headers: { "x-forwarded-for": "192.168.1.100" },
      });
      const user = { id: "user-1" };

      const ctx = buildServiceContext(request, user);

      expect(ctx.ipAddress).toBe("192.168.1.100");
    });

    it("should extract user-agent header", async () => {
      const { buildServiceContext } = await import("~/lib/request-context.server");

      const request = new Request("http://localhost:3000/test", {
        headers: { "user-agent": "Mozilla/5.0 TestBrowser" },
      });
      const user = { id: "user-1" };

      const ctx = buildServiceContext(request, user);

      expect(ctx.userAgent).toBe("Mozilla/5.0 TestBrowser");
    });

    it("should extract both headers when present", async () => {
      const { buildServiceContext } = await import("~/lib/request-context.server");

      const request = new Request("http://localhost:3000/test", {
        headers: {
          "x-forwarded-for": "10.0.0.1",
          "user-agent": "TestAgent/1.0",
        },
      });
      const user = { id: "user-2" };

      const ctx = buildServiceContext(request, user);

      expect(ctx.userId).toBe("user-2");
      expect(ctx.ipAddress).toBe("10.0.0.1");
      expect(ctx.userAgent).toBe("TestAgent/1.0");
    });

    it("should handle user with null tenantId", async () => {
      const { buildServiceContext } = await import("~/lib/request-context.server");

      const request = new Request("http://localhost:3000/test");
      const user = { id: "user-1", tenantId: null };

      const ctx = buildServiceContext(request, user);

      expect(ctx.tenantId).toBeUndefined();
    });

    it("should handle user with undefined tenantId", async () => {
      const { buildServiceContext } = await import("~/lib/request-context.server");

      const request = new Request("http://localhost:3000/test");
      const user = { id: "user-1", tenantId: undefined };

      const ctx = buildServiceContext(request, user);

      expect(ctx.tenantId).toBeUndefined();
    });

    it("should return TenantServiceContext when tenantId argument is provided", async () => {
      const { buildServiceContext } = await import("~/lib/request-context.server");

      const request = new Request("http://localhost:3000/test", {
        headers: {
          "x-forwarded-for": "127.0.0.1",
          "user-agent": "Chrome/100",
        },
      });
      const user = { id: "user-3" };

      const ctx = buildServiceContext(request, user, "tenant-abc");

      expect(ctx).toEqual({
        userId: "user-3",
        tenantId: "tenant-abc",
        ipAddress: "127.0.0.1",
        userAgent: "Chrome/100",
      });
    });

    it("should handle multiple comma-separated forwarded IPs", async () => {
      const { buildServiceContext } = await import("~/lib/request-context.server");

      const request = new Request("http://localhost:3000/test", {
        headers: { "x-forwarded-for": "203.0.113.50, 70.41.3.18, 150.172.238.178" },
      });
      const user = { id: "user-1" };

      const ctx = buildServiceContext(request, user);

      // The full header value is returned as-is
      expect(ctx.ipAddress).toBe("203.0.113.50, 70.41.3.18, 150.172.238.178");
    });
  });
});

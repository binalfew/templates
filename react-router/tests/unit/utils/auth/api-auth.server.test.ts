import { describe, it, expect, vi, beforeEach } from "vitest";

const mockValidateApiKey = vi.fn();
const mockTrackApiKeyUsage = vi.fn();

vi.mock("~/services/api-keys.server", () => ({
  validateApiKey: (...args: unknown[]) => mockValidateApiKey(...args),
  trackApiKeyUsage: (...args: unknown[]) => mockTrackApiKeyUsage(...args),
}));

describe("api-auth.server", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("apiAuth", () => {
    it("returns auth result for a valid bearer token", async () => {
      const { apiAuth } = await import("~/utils/auth/api-auth.server");

      mockValidateApiKey.mockResolvedValue({
        tenantId: "tenant-1",
        apiKeyId: "key-1",
        permissions: ["events:read", "events:write"],
        rateLimitTier: "STANDARD",
        rateLimitCustom: null,
      });

      const request = new Request("http://localhost/api/v1/events", {
        headers: { Authorization: "Bearer ak_test_abc123" },
      });

      const result = await apiAuth(request);

      expect(result).toEqual({
        tenantId: "tenant-1",
        apiKeyId: "key-1",
        permissions: ["events:read", "events:write"],
      });
      expect(mockValidateApiKey).toHaveBeenCalledWith("ak_test_abc123");
      expect(mockTrackApiKeyUsage).toHaveBeenCalledWith("key-1", "unknown");
    });

    it("throws 401 Response when Authorization header is missing", async () => {
      const { apiAuth } = await import("~/utils/auth/api-auth.server");

      const request = new Request("http://localhost/api/v1/events");

      try {
        await apiAuth(request);
        expect.fail("Expected apiAuth to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        const response = error as Response;
        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.error.code).toBe("UNAUTHORIZED");
        expect(body.error.message).toBe("Missing or invalid Authorization header");
      }
    });

    it("throws 401 Response when Authorization header does not start with Bearer", async () => {
      const { apiAuth } = await import("~/utils/auth/api-auth.server");

      const request = new Request("http://localhost/api/v1/events", {
        headers: { Authorization: "Basic dXNlcjpwYXNz" },
      });

      try {
        await apiAuth(request);
        expect.fail("Expected apiAuth to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        const response = error as Response;
        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.error.code).toBe("UNAUTHORIZED");
        expect(body.error.message).toBe("Missing or invalid Authorization header");
      }
    });

    it("throws 401 Response when Authorization header is empty string", async () => {
      const { apiAuth } = await import("~/utils/auth/api-auth.server");

      const request = new Request("http://localhost/api/v1/events", {
        headers: { Authorization: "" },
      });

      try {
        await apiAuth(request);
        expect.fail("Expected apiAuth to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        const response = error as Response;
        expect(response.status).toBe(401);
      }
    });

    it("throws 401 Response when validateApiKey returns null", async () => {
      const { apiAuth } = await import("~/utils/auth/api-auth.server");

      mockValidateApiKey.mockResolvedValue(null);

      const request = new Request("http://localhost/api/v1/events", {
        headers: { Authorization: "Bearer ak_test_invalid_key" },
      });

      try {
        await apiAuth(request);
        expect.fail("Expected apiAuth to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        const response = error as Response;
        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.error.code).toBe("UNAUTHORIZED");
        expect(body.error.message).toBe("Invalid or expired API key");
      }
    });

    it("extracts token correctly from Bearer prefix", async () => {
      const { apiAuth } = await import("~/utils/auth/api-auth.server");

      mockValidateApiKey.mockResolvedValue({
        tenantId: "tenant-2",
        apiKeyId: "key-2",
        permissions: ["*"],
        rateLimitTier: "STANDARD",
        rateLimitCustom: null,
      });

      const longToken = "ak_prod_" + "f".repeat(64);
      const request = new Request("http://localhost/api/v1/events", {
        headers: { Authorization: `Bearer ${longToken}` },
      });

      await apiAuth(request);

      expect(mockValidateApiKey).toHaveBeenCalledWith(longToken);
    });

    it("returns only tenantId, apiKeyId, and permissions from validated key", async () => {
      const { apiAuth } = await import("~/utils/auth/api-auth.server");

      mockValidateApiKey.mockResolvedValue({
        tenantId: "tenant-1",
        apiKeyId: "key-1",
        permissions: ["events:read"],
        rateLimitTier: "STANDARD",
        rateLimitCustom: null,
        extraField: "should-not-appear",
      });

      const request = new Request("http://localhost/api/v1/events", {
        headers: { Authorization: "Bearer ak_test_abc123" },
      });

      const result = await apiAuth(request);

      expect(result).toEqual({
        tenantId: "tenant-1",
        apiKeyId: "key-1",
        permissions: ["events:read"],
      });
      expect(result).not.toHaveProperty("rateLimitTier");
      expect(result).not.toHaveProperty("extraField");
    });

    it("response has Content-Type application/json on auth failure", async () => {
      const { apiAuth } = await import("~/utils/auth/api-auth.server");

      const request = new Request("http://localhost/api/v1/events");

      try {
        await apiAuth(request);
        expect.fail("Expected apiAuth to throw");
      } catch (error) {
        const response = error as Response;
        expect(response.headers.get("Content-Type")).toBe("application/json");
      }
    });
  });

  describe("requireApiPermission", () => {
    it("does not throw when permission is present", async () => {
      const { requireApiPermission } = await import("~/utils/auth/api-auth.server");

      const auth = {
        tenantId: "tenant-1",
        apiKeyId: "key-1",
        permissions: ["events:read", "events:write", "users:read"],
      };

      expect(() => requireApiPermission(auth, "events:read")).not.toThrow();
    });

    it("does not throw when permissions include wildcard", async () => {
      const { requireApiPermission } = await import("~/utils/auth/api-auth.server");

      const auth = {
        tenantId: "tenant-1",
        apiKeyId: "key-1",
        permissions: ["*"],
      };

      expect(() => requireApiPermission(auth, "events:read")).not.toThrow();
      expect(() => requireApiPermission(auth, "users:write")).not.toThrow();
      expect(() => requireApiPermission(auth, "any:permission")).not.toThrow();
    });

    it("throws 403 Response when permission is missing", async () => {
      const { requireApiPermission } = await import("~/utils/auth/api-auth.server");

      const auth = {
        tenantId: "tenant-1",
        apiKeyId: "key-1",
        permissions: ["events:read"],
      };

      try {
        requireApiPermission(auth, "events:write");
        expect.fail("Expected requireApiPermission to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        const response = error as Response;
        expect(response.status).toBe(403);
        const body = await response.json();
        expect(body.error.code).toBe("FORBIDDEN");
        expect(body.error.message).toBe("Missing permission: events:write");
      }
    });

    it("throws 403 Response when permissions array is empty", async () => {
      const { requireApiPermission } = await import("~/utils/auth/api-auth.server");

      const auth = {
        tenantId: "tenant-1",
        apiKeyId: "key-1",
        permissions: [],
      };

      try {
        requireApiPermission(auth, "events:read");
        expect.fail("Expected requireApiPermission to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        const response = error as Response;
        expect(response.status).toBe(403);
        const body = await response.json();
        expect(body.error.code).toBe("FORBIDDEN");
        expect(body.error.message).toBe("Missing permission: events:read");
      }
    });

    it("response has Content-Type application/json on permission failure", async () => {
      const { requireApiPermission } = await import("~/utils/auth/api-auth.server");

      const auth = {
        tenantId: "tenant-1",
        apiKeyId: "key-1",
        permissions: ["events:read"],
      };

      try {
        requireApiPermission(auth, "users:write");
        expect.fail("Expected requireApiPermission to throw");
      } catch (error) {
        const response = error as Response;
        expect(response.headers.get("Content-Type")).toBe("application/json");
      }
    });

    it("checks exact permission match, not partial", async () => {
      const { requireApiPermission } = await import("~/utils/auth/api-auth.server");

      const auth = {
        tenantId: "tenant-1",
        apiKeyId: "key-1",
        permissions: ["events:read"],
      };

      // "events:read" should not match "events:readAll"
      try {
        requireApiPermission(auth, "events:readAll");
        expect.fail("Expected requireApiPermission to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        const response = error as Response;
        expect(response.status).toBe(403);
      }
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

describe("cache.server", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("generateETag", () => {
    it("should return a quoted SHA-256 hash prefix", async () => {
      const { generateETag } = await import("~/utils/db/cache.server");

      const etag = generateETag("hello world");
      // Must be quoted, 16 hex chars inside quotes
      expect(etag).toMatch(/^"[0-9a-f]{16}"$/);
    });

    it("should produce deterministic output for the same input", async () => {
      const { generateETag } = await import("~/utils/db/cache.server");

      const a = generateETag("deterministic");
      const b = generateETag("deterministic");
      expect(a).toBe(b);
    });

    it("should produce different ETags for different content", async () => {
      const { generateETag } = await import("~/utils/db/cache.server");

      const a = generateETag("content-a");
      const b = generateETag("content-b");
      expect(a).not.toBe(b);
    });

    it("should handle empty string input", async () => {
      const { generateETag } = await import("~/utils/db/cache.server");

      const etag = generateETag("");
      expect(etag).toMatch(/^"[0-9a-f]{16}"$/);
    });

    it("should handle large body input", async () => {
      const { generateETag } = await import("~/utils/db/cache.server");

      const largeBody = "x".repeat(100_000);
      const etag = generateETag(largeBody);
      expect(etag).toMatch(/^"[0-9a-f]{16}"$/);
    });

    it("should handle unicode content", async () => {
      const { generateETag } = await import("~/utils/db/cache.server");

      const etag = generateETag("Hello, monde! Emoji: \u{1F60A}");
      expect(etag).toMatch(/^"[0-9a-f]{16}"$/);
    });
  });

  describe("handleConditionalRequest", () => {
    it("should return 200 with body and ETag when no If-None-Match header", async () => {
      const { handleConditionalRequest } = await import("~/utils/db/cache.server");

      const body = JSON.stringify({ data: "test" });
      const request = new Request("http://localhost:3000/api/data");
      const response = handleConditionalRequest(request, body);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/json");
      expect(response.headers.get("Cache-Control")).toBe("private, no-cache");
      expect(response.headers.get("ETag")).toMatch(/^"[0-9a-f]{16}"$/);
      expect(await response.text()).toBe(body);
    });

    it("should return 304 when If-None-Match matches the ETag", async () => {
      const { generateETag, handleConditionalRequest } = await import("~/utils/db/cache.server");

      const body = JSON.stringify({ data: "cached" });
      const etag = generateETag(body);
      const request = new Request("http://localhost:3000/api/data", {
        headers: { "If-None-Match": etag },
      });

      const response = handleConditionalRequest(request, body);

      expect(response.status).toBe(304);
      expect(response.headers.get("ETag")).toBe(etag);
      // 304 should have no body
      expect(await response.text()).toBe("");
    });

    it("should return 200 when If-None-Match does not match", async () => {
      const { handleConditionalRequest } = await import("~/utils/db/cache.server");

      const body = JSON.stringify({ data: "updated" });
      const request = new Request("http://localhost:3000/api/data", {
        headers: { "If-None-Match": '"stale-etag-value1"' },
      });

      const response = handleConditionalRequest(request, body);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe(body);
    });

    it("should merge custom headers into the 200 response", async () => {
      const { handleConditionalRequest } = await import("~/utils/db/cache.server");

      const body = JSON.stringify({ data: "with-headers" });
      const request = new Request("http://localhost:3000/api/data");
      const customHeaders = {
        "X-Custom-Header": "custom-value",
        "X-Request-Id": "req-123",
      };

      const response = handleConditionalRequest(request, body, customHeaders);

      expect(response.status).toBe(200);
      expect(response.headers.get("X-Custom-Header")).toBe("custom-value");
      expect(response.headers.get("X-Request-Id")).toBe("req-123");
      expect(response.headers.get("ETag")).toMatch(/^"[0-9a-f]{16}"$/);
      expect(response.headers.get("Content-Type")).toBe("application/json");
    });

    it("should allow custom headers to override defaults", async () => {
      const { handleConditionalRequest } = await import("~/utils/db/cache.server");

      const body = JSON.stringify({ data: "override" });
      const request = new Request("http://localhost:3000/api/data");
      const customHeaders = {
        "Content-Type": "text/plain",
      };

      const response = handleConditionalRequest(request, body, customHeaders);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("text/plain");
    });

    it("should use empty object for headers when none provided", async () => {
      const { handleConditionalRequest } = await import("~/utils/db/cache.server");

      const body = "simple body";
      const request = new Request("http://localhost:3000/api/data");
      const response = handleConditionalRequest(request, body);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/json");
      expect(response.headers.get("Cache-Control")).toBe("private, no-cache");
    });
  });

  describe("CACHE_HEADERS", () => {
    it("should have correct static cache headers", async () => {
      const { CACHE_HEADERS } = await import("~/utils/db/cache.server");

      expect(CACHE_HEADERS.static).toEqual({
        "Cache-Control": "public, max-age=31536000, immutable",
      });
    });

    it("should have correct noStore cache headers", async () => {
      const { CACHE_HEADERS } = await import("~/utils/db/cache.server");

      expect(CACHE_HEADERS.noStore).toEqual({
        "Cache-Control": "no-store",
      });
    });

    it("should have correct privateNoCache headers", async () => {
      const { CACHE_HEADERS } = await import("~/utils/db/cache.server");

      expect(CACHE_HEADERS.privateNoCache).toEqual({
        "Cache-Control": "private, no-cache",
      });
    });

    it("should be a readonly object with exactly three presets", async () => {
      const { CACHE_HEADERS } = await import("~/utils/db/cache.server");

      expect(Object.keys(CACHE_HEADERS)).toHaveLength(3);
      expect(Object.keys(CACHE_HEADERS)).toEqual(
        expect.arrayContaining(["static", "noStore", "privateNoCache"]),
      );
    });
  });
});

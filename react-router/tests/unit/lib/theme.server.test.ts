import { describe, it, expect, vi, beforeEach } from "vitest";

describe("theme.server", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("getTheme", () => {
    it("should return 'light' when theme cookie is 'light'", async () => {
      const { getTheme } = await import("~/lib/theme.server");

      const request = new Request("http://localhost:3000/", {
        headers: { cookie: "theme=light" },
      });

      expect(getTheme(request)).toBe("light");
    });

    it("should return 'dark' when theme cookie is 'dark'", async () => {
      const { getTheme } = await import("~/lib/theme.server");

      const request = new Request("http://localhost:3000/", {
        headers: { cookie: "theme=dark" },
      });

      expect(getTheme(request)).toBe("dark");
    });

    it("should return null when no cookie header is present", async () => {
      const { getTheme } = await import("~/lib/theme.server");

      const request = new Request("http://localhost:3000/");

      expect(getTheme(request)).toBeNull();
    });

    it("should return null when theme cookie is not set", async () => {
      const { getTheme } = await import("~/lib/theme.server");

      const request = new Request("http://localhost:3000/", {
        headers: { cookie: "other=value" },
      });

      expect(getTheme(request)).toBeNull();
    });

    it("should return null when theme cookie has an invalid value", async () => {
      const { getTheme } = await import("~/lib/theme.server");

      const request = new Request("http://localhost:3000/", {
        headers: { cookie: "theme=blue" },
      });

      expect(getTheme(request)).toBeNull();
    });

    it("should return null when theme cookie is 'system'", async () => {
      const { getTheme } = await import("~/lib/theme.server");

      const request = new Request("http://localhost:3000/", {
        headers: { cookie: "theme=system" },
      });

      expect(getTheme(request)).toBeNull();
    });

    it("should return null when theme cookie is empty string", async () => {
      const { getTheme } = await import("~/lib/theme.server");

      const request = new Request("http://localhost:3000/", {
        headers: { cookie: "theme=" },
      });

      expect(getTheme(request)).toBeNull();
    });

    it("should handle multiple cookies correctly", async () => {
      const { getTheme } = await import("~/lib/theme.server");

      const request = new Request("http://localhost:3000/", {
        headers: { cookie: "session=abc123; theme=dark; lang=en" },
      });

      expect(getTheme(request)).toBe("dark");
    });
  });

  describe("setTheme", () => {
    it("should serialize a 'light' theme cookie with long maxAge", async () => {
      const { setTheme } = await import("~/lib/theme.server");

      const result = setTheme("light");

      expect(result).toContain("theme=light");
      expect(result).toContain("Path=/");
      expect(result).toContain("Max-Age=31536000");
    });

    it("should serialize a 'dark' theme cookie with long maxAge", async () => {
      const { setTheme } = await import("~/lib/theme.server");

      const result = setTheme("dark");

      expect(result).toContain("theme=dark");
      expect(result).toContain("Path=/");
      expect(result).toContain("Max-Age=31536000");
    });

    it("should delete the cookie when theme is 'system'", async () => {
      const { setTheme } = await import("~/lib/theme.server");

      const result = setTheme("system");

      expect(result).toContain("theme=");
      expect(result).toContain("Path=/");
      // Negative Max-Age tells the browser to delete the cookie
      expect(result).toContain("Max-Age=-1");
    });

    it("should not contain the value 'system' in the serialized cookie", async () => {
      const { setTheme } = await import("~/lib/theme.server");

      const result = setTheme("system");

      // The cookie value should be empty, not "system"
      expect(result).not.toContain("theme=system");
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

describe("sidebar.server", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("getSidebarState", () => {
    it("should return true when no cookie header is present (default open)", async () => {
      const { getSidebarState } = await import("~/utils/sidebar.server");

      const request = new Request("http://localhost:3000/");

      expect(getSidebarState(request)).toBe(true);
    });

    it("should return true when sidebar_state cookie is not set", async () => {
      const { getSidebarState } = await import("~/utils/sidebar.server");

      const request = new Request("http://localhost:3000/", {
        headers: { cookie: "other=value" },
      });

      expect(getSidebarState(request)).toBe(true);
    });

    it("should return true when sidebar_state cookie is 'true'", async () => {
      const { getSidebarState } = await import("~/utils/sidebar.server");

      const request = new Request("http://localhost:3000/", {
        headers: { cookie: "sidebar_state=true" },
      });

      expect(getSidebarState(request)).toBe(true);
    });

    it("should return false when sidebar_state cookie is 'false'", async () => {
      const { getSidebarState } = await import("~/utils/sidebar.server");

      const request = new Request("http://localhost:3000/", {
        headers: { cookie: "sidebar_state=false" },
      });

      expect(getSidebarState(request)).toBe(false);
    });

    it("should return true for any non-'false' value", async () => {
      const { getSidebarState } = await import("~/utils/sidebar.server");

      const request = new Request("http://localhost:3000/", {
        headers: { cookie: "sidebar_state=open" },
      });

      expect(getSidebarState(request)).toBe(true);
    });

    it("should return true for empty string value", async () => {
      const { getSidebarState } = await import("~/utils/sidebar.server");

      const request = new Request("http://localhost:3000/", {
        headers: { cookie: "sidebar_state=" },
      });

      expect(getSidebarState(request)).toBe(true);
    });

    it("should handle multiple cookies correctly", async () => {
      const { getSidebarState } = await import("~/utils/sidebar.server");

      const request = new Request("http://localhost:3000/", {
        headers: { cookie: "session=abc; sidebar_state=false; theme=dark" },
      });

      expect(getSidebarState(request)).toBe(false);
    });
  });

  describe("getSidebarGroupState", () => {
    it("should return empty object when no cookie header is present", async () => {
      const { getSidebarGroupState } = await import("~/utils/sidebar.server");

      const request = new Request("http://localhost:3000/");

      expect(getSidebarGroupState(request)).toEqual({});
    });

    it("should return empty object when sidebar_groups cookie is not set", async () => {
      const { getSidebarGroupState } = await import("~/utils/sidebar.server");

      const request = new Request("http://localhost:3000/", {
        headers: { cookie: "other=value" },
      });

      expect(getSidebarGroupState(request)).toEqual({});
    });

    it("should parse valid JSON cookie value", async () => {
      const { getSidebarGroupState } = await import("~/utils/sidebar.server");

      const groups = { settings: true, analytics: false, users: true };
      const request = new Request("http://localhost:3000/", {
        headers: {
          cookie: `sidebar_groups=${encodeURIComponent(JSON.stringify(groups))}`,
        },
      });

      expect(getSidebarGroupState(request)).toEqual(groups);
    });

    it("should return empty object for invalid JSON", async () => {
      const { getSidebarGroupState } = await import("~/utils/sidebar.server");

      const request = new Request("http://localhost:3000/", {
        headers: { cookie: "sidebar_groups=not-valid-json" },
      });

      expect(getSidebarGroupState(request)).toEqual({});
    });

    it("should return empty object for empty string value", async () => {
      const { getSidebarGroupState } = await import("~/utils/sidebar.server");

      const request = new Request("http://localhost:3000/", {
        headers: { cookie: "sidebar_groups=" },
      });

      expect(getSidebarGroupState(request)).toEqual({});
    });

    it("should handle JSON with all groups collapsed", async () => {
      const { getSidebarGroupState } = await import("~/utils/sidebar.server");

      const groups = { main: false, settings: false, admin: false };
      const request = new Request("http://localhost:3000/", {
        headers: {
          cookie: `sidebar_groups=${encodeURIComponent(JSON.stringify(groups))}`,
        },
      });

      expect(getSidebarGroupState(request)).toEqual(groups);
    });

    it("should handle JSON with all groups expanded", async () => {
      const { getSidebarGroupState } = await import("~/utils/sidebar.server");

      const groups = { main: true, settings: true, admin: true };
      const request = new Request("http://localhost:3000/", {
        headers: {
          cookie: `sidebar_groups=${encodeURIComponent(JSON.stringify(groups))}`,
        },
      });

      expect(getSidebarGroupState(request)).toEqual(groups);
    });

    it("should return empty object for malformed JSON (truncated)", async () => {
      const { getSidebarGroupState } = await import("~/utils/sidebar.server");

      const request = new Request("http://localhost:3000/", {
        headers: {
          cookie: `sidebar_groups=${encodeURIComponent('{"main":true,')}`,
        },
      });

      expect(getSidebarGroupState(request)).toEqual({});
    });

    it("should handle empty JSON object", async () => {
      const { getSidebarGroupState } = await import("~/utils/sidebar.server");

      const request = new Request("http://localhost:3000/", {
        headers: {
          cookie: `sidebar_groups=${encodeURIComponent("{}")}`,
        },
      });

      expect(getSidebarGroupState(request)).toEqual({});
    });
  });
});

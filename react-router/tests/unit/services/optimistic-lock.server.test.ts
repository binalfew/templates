import { describe, it, expect } from "vitest";
import {
  checkOptimisticLock,
  getExpectedVersion,
  withVersionCheck,
  ConflictError,
  PreconditionRequiredError,
  NotFoundError,
  isPrismaNotFoundError,
} from "~/services/optimistic-lock.server";

describe("optimistic-lock.server", () => {
  const now = new Date("2026-02-15T10:00:00.000Z");

  describe("checkOptimisticLock", () => {
    it("returns resource when version matches", () => {
      const resource = { id: "r-1", name: "Test", updatedAt: now };
      const result = checkOptimisticLock(resource, now.toISOString(), "Resource");
      expect(result).toBe(resource);
    });

    it("throws ConflictError when version does not match", () => {
      const resource = { id: "r-1", name: "Test", updatedAt: now };
      const oldVersion = new Date("2026-02-15T09:00:00.000Z").toISOString();
      expect(() => checkOptimisticLock(resource, oldVersion, "Resource")).toThrow(ConflictError);
    });

    it("conflict error includes current resource", () => {
      const resource = { id: "r-1", name: "Test", updatedAt: now };
      const oldVersion = new Date("2026-02-15T09:00:00.000Z").toISOString();
      try {
        checkOptimisticLock(resource, oldVersion, "Resource");
      } catch (error) {
        expect(error).toBeInstanceOf(ConflictError);
        expect((error as ConflictError).status).toBe(409);
        expect((error as ConflictError).currentResource).toEqual(resource);
      }
    });

    it("throws PreconditionRequiredError when no version provided", () => {
      const resource = { id: "r-1", name: "Test", updatedAt: now };
      expect(() => checkOptimisticLock(resource, null, "Resource")).toThrow(PreconditionRequiredError);
    });

    it("throws NotFoundError when resource is null", () => {
      expect(() => checkOptimisticLock(null, now.toISOString(), "Resource")).toThrow(NotFoundError);
    });

    it("NotFoundError has correct status code", () => {
      try {
        checkOptimisticLock(null, now.toISOString(), "Resource");
      } catch (error) {
        expect((error as NotFoundError).status).toBe(404);
      }
    });
  });

  describe("getExpectedVersion", () => {
    it("extracts version from If-Match header", () => {
      const request = new Request("http://localhost", {
        headers: { "If-Match": "2026-02-15T10:00:00.000Z" },
      });
      expect(getExpectedVersion(request)).toBe("2026-02-15T10:00:00.000Z");
    });

    it("strips quotes from If-Match header", () => {
      const request = new Request("http://localhost", {
        headers: { "If-Match": '"2026-02-15T10:00:00.000Z"' },
      });
      expect(getExpectedVersion(request)).toBe("2026-02-15T10:00:00.000Z");
    });

    it("strips weak validator prefix", () => {
      const request = new Request("http://localhost", {
        headers: { "If-Match": 'W/"2026-02-15T10:00:00.000Z"' },
      });
      expect(getExpectedVersion(request)).toBe("2026-02-15T10:00:00.000Z");
    });

    it("returns null when no If-Match header", () => {
      const request = new Request("http://localhost");
      expect(getExpectedVersion(request)).toBeNull();
    });
  });

  describe("withVersionCheck", () => {
    it("adds updatedAt to where clause", () => {
      const where = { id: "r-1" };
      const result = withVersionCheck(where, now);
      expect(result).toEqual({ id: "r-1", updatedAt: now });
    });

    it("preserves existing where conditions", () => {
      const where = { id: "r-1", tenantId: "t-1" };
      const result = withVersionCheck(where, now);
      expect(result).toEqual({ id: "r-1", tenantId: "t-1", updatedAt: now });
    });
  });

  describe("isPrismaNotFoundError", () => {
    it("returns true for P2025 error", () => {
      expect(isPrismaNotFoundError({ code: "P2025" })).toBe(true);
    });

    it("returns false for other errors", () => {
      expect(isPrismaNotFoundError({ code: "P2002" })).toBe(false);
      expect(isPrismaNotFoundError(new Error("test"))).toBe(false);
      expect(isPrismaNotFoundError(null)).toBe(false);
    });
  });
});

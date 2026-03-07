import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock functions per Prisma model/method ─────────────────
const mockUserFindMany = vi.fn();
const mockRoleFindMany = vi.fn();
const mockPermissionFindMany = vi.fn();
const mockCustomObjectDefFindMany = vi.fn();
const mockAuditLogFindMany = vi.fn();

vi.mock("~/utils/db/db.server", () => ({
  prisma: {
    user: {
      findMany: (...args: unknown[]) => mockUserFindMany(...args),
    },
    role: {
      findMany: (...args: unknown[]) => mockRoleFindMany(...args),
    },
    permission: {
      findMany: (...args: unknown[]) => mockPermissionFindMany(...args),
    },
    customObjectDefinition: {
      findMany: (...args: unknown[]) => mockCustomObjectDefFindMany(...args),
    },
    auditLog: {
      findMany: (...args: unknown[]) => mockAuditLogFindMany(...args),
    },
  },
}));

describe("search.server", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default all model queries to empty arrays
    mockUserFindMany.mockResolvedValue([]);
    mockRoleFindMany.mockResolvedValue([]);
    mockPermissionFindMany.mockResolvedValue([]);
    mockCustomObjectDefFindMany.mockResolvedValue([]);
    mockAuditLogFindMany.mockResolvedValue([]);
  });

  // ─── Empty / short query edge cases ─────────────────────

  describe("globalSearch - short/empty queries", () => {
    it("returns empty results for empty query string", async () => {
      const { globalSearch } = await import("~/services/search.server");

      const result = await globalSearch("", "t-1");

      expect(result).toEqual({ results: [], total: 0, query: "" });
      expect(mockUserFindMany).not.toHaveBeenCalled();
    });

    it("returns empty results for single character query", async () => {
      const { globalSearch } = await import("~/services/search.server");

      const result = await globalSearch("a", "t-1");

      expect(result).toEqual({ results: [], total: 0, query: "a" });
      expect(mockUserFindMany).not.toHaveBeenCalled();
    });

    it("returns empty results for whitespace-only query", async () => {
      const { globalSearch } = await import("~/services/search.server");

      const result = await globalSearch("   ", "t-1");

      expect(result).toEqual({ results: [], total: 0, query: "   " });
    });

    it("returns empty results for single char after trimming", async () => {
      const { globalSearch } = await import("~/services/search.server");

      const result = await globalSearch(" x ", "t-1");

      expect(result).toEqual({ results: [], total: 0, query: " x " });
    });
  });

  // ─── Happy path: results from all entity types ──────────

  describe("globalSearch - happy path", () => {
    it("returns combined results from all entity types", async () => {
      const { globalSearch } = await import("~/services/search.server");

      mockUserFindMany.mockResolvedValue([
        { id: "u-1", name: "Alice Admin", email: "alice@example.com", username: "alice" },
      ]);
      mockRoleFindMany.mockResolvedValue([
        { id: "r-1", name: "Admin", description: "Administrator role" },
      ]);
      mockPermissionFindMany.mockResolvedValue([
        { id: "p-1", resource: "admin", action: "read", description: "Admin read" },
      ]);
      mockCustomObjectDefFindMany.mockResolvedValue([
        { id: "co-1", name: "Admin Panel", slug: "admin-panel", description: null },
      ]);
      mockAuditLogFindMany.mockResolvedValue([
        {
          id: "al-1",
          action: "CREATE",
          entityType: "Admin",
          description: "Created admin",
          createdAt: new Date("2026-03-01"),
        },
      ]);

      const result = await globalSearch("admin", "t-1");

      expect(result.total).toBe(5);
      expect(result.query).toBe("admin");
      expect(result.results).toHaveLength(5);

      const types = result.results.map((r) => r.type);
      expect(types).toContain("User");
      expect(types).toContain("Role");
      expect(types).toContain("Permission");
      expect(types).toContain("CustomObject");
      expect(types).toContain("AuditLog");
    });

    it("formats User results correctly", async () => {
      const { globalSearch } = await import("~/services/search.server");

      mockUserFindMany.mockResolvedValue([
        { id: "u-1", name: "John Doe", email: "john@example.com", username: "johnd" },
      ]);

      const result = await globalSearch("john", "t-1");

      const user = result.results.find((r) => r.type === "User");
      expect(user).toBeDefined();
      expect(user?.id).toBe("u-1");
      expect(user?.title).toBe("John Doe");
      expect(user?.subtitle).toBe("john@example.com");
      expect(user?.url).toBe("security/users/u-1");
    });

    it("uses email as title when user name is null", async () => {
      const { globalSearch } = await import("~/services/search.server");

      mockUserFindMany.mockResolvedValue([
        { id: "u-2", name: null, email: "noname@example.com", username: "noname" },
      ]);

      const result = await globalSearch("noname", "t-1");

      const user = result.results.find((r) => r.type === "User");
      expect(user?.title).toBe("noname@example.com");
    });

    it("formats Role results correctly", async () => {
      const { globalSearch } = await import("~/services/search.server");

      mockRoleFindMany.mockResolvedValue([
        { id: "r-1", name: "Manager", description: "Manages teams" },
      ]);

      const result = await globalSearch("manager", "t-1");

      const role = result.results.find((r) => r.type === "Role");
      expect(role?.title).toBe("Manager");
      expect(role?.subtitle).toBe("Manages teams");
      expect(role?.url).toBe("security/roles/r-1");
    });

    it("formats Role with null description as undefined subtitle", async () => {
      const { globalSearch } = await import("~/services/search.server");

      mockRoleFindMany.mockResolvedValue([
        { id: "r-2", name: "NoDesc", description: null },
      ]);

      const result = await globalSearch("nodesc", "t-1");

      const role = result.results.find((r) => r.type === "Role");
      expect(role?.subtitle).toBeUndefined();
    });

    it("formats Permission results correctly", async () => {
      const { globalSearch } = await import("~/services/search.server");

      mockPermissionFindMany.mockResolvedValue([
        { id: "p-1", resource: "user", action: "write", description: "Write users" },
      ]);

      const result = await globalSearch("user", "t-1");

      const perm = result.results.find((r) => r.type === "Permission");
      expect(perm?.title).toBe("user:write");
      expect(perm?.subtitle).toBe("Write users");
      expect(perm?.url).toBe("security/permissions/p-1");
    });

    it("formats CustomObject results with slug as subtitle when description is null", async () => {
      const { globalSearch } = await import("~/services/search.server");

      mockCustomObjectDefFindMany.mockResolvedValue([
        { id: "co-1", name: "Vehicles", slug: "vehicles", description: null },
      ]);

      const result = await globalSearch("vehicles", "t-1");

      const co = result.results.find((r) => r.type === "CustomObject");
      expect(co?.title).toBe("Vehicles");
      expect(co?.subtitle).toBe("vehicles");
      expect(co?.url).toBe("objects/vehicles");
    });

    it("formats CustomObject results with description as subtitle when present", async () => {
      const { globalSearch } = await import("~/services/search.server");

      mockCustomObjectDefFindMany.mockResolvedValue([
        { id: "co-2", name: "Assets", slug: "assets", description: "Company assets" },
      ]);

      const result = await globalSearch("assets", "t-1");

      const co = result.results.find((r) => r.type === "CustomObject");
      expect(co?.subtitle).toBe("Company assets");
    });

    it("formats AuditLog results correctly", async () => {
      const { globalSearch } = await import("~/services/search.server");

      mockAuditLogFindMany.mockResolvedValue([
        {
          id: "al-1",
          action: "DELETE",
          entityType: "User",
          description: "Deleted a user",
          createdAt: new Date("2026-03-01"),
        },
      ]);

      const result = await globalSearch("delete", "t-1");

      const audit = result.results.find((r) => r.type === "AuditLog");
      expect(audit?.title).toBe("DELETE User");
      expect(audit?.subtitle).toBe("Deleted a user");
      expect(audit?.url).toBe("logs");
    });
  });

  // ─── Sorting by relevance score ─────────────────────────

  describe("globalSearch - scoring and sorting", () => {
    it("sorts results by relevance score descending", async () => {
      const { globalSearch } = await import("~/services/search.server");

      // Exact match should score 1.0
      mockUserFindMany.mockResolvedValue([
        { id: "u-exact", name: "admin", email: "other@example.com", username: "other" },
      ]);
      // Starts-with match should score 0.8
      mockRoleFindMany.mockResolvedValue([
        { id: "r-starts", name: "administrator", description: null },
      ]);
      // Contains match should score 0.5
      mockPermissionFindMany.mockResolvedValue([
        { id: "p-contains", resource: "superadmin", action: "read", description: null },
      ]);

      const result = await globalSearch("admin", "t-1");

      expect(result.results[0].id).toBe("u-exact");
      expect(result.results[0].score).toBe(1.0);
      expect(result.results[1].id).toBe("r-starts");
      expect(result.results[1].score).toBe(0.8);
      expect(result.results[2].id).toBe("p-contains");
      expect(result.results[2].score).toBe(0.5);
    });

    it("returns score 0 when no fields match the query text", async () => {
      const { globalSearch } = await import("~/services/search.server");

      // The DB returned a result (prisma uses case-insensitive contains),
      // but scoreMatch gets fields that don't actually match the query
      mockUserFindMany.mockResolvedValue([
        { id: "u-nomatch", name: null, email: null, username: null },
      ]);

      const result = await globalSearch("test", "t-1");

      const user = result.results.find((r) => r.id === "u-nomatch");
      expect(user?.score).toBe(0);
    });
  });

  // ─── Pagination ─────────────────────────────────────────

  describe("globalSearch - pagination", () => {
    it("applies limit and page offset correctly", async () => {
      const { globalSearch } = await import("~/services/search.server");

      // Create 5 users to test pagination
      const users = Array.from({ length: 5 }, (_, i) => ({
        id: `u-${i}`,
        name: `Tester ${i}`,
        email: `tester${i}@example.com`,
        username: `tester${i}`,
      }));
      mockUserFindMany.mockResolvedValue(users);

      const page1 = await globalSearch("tester", "t-1", { limit: 2, page: 1 });

      expect(page1.total).toBe(5);
      expect(page1.results).toHaveLength(2);
    });

    it("returns correct page 2 results", async () => {
      const { globalSearch } = await import("~/services/search.server");

      const users = Array.from({ length: 5 }, (_, i) => ({
        id: `u-${i}`,
        name: `Tester ${i}`,
        email: `tester${i}@example.com`,
        username: `tester${i}`,
      }));
      mockUserFindMany.mockResolvedValue(users);

      const page2 = await globalSearch("tester", "t-1", { limit: 2, page: 2 });

      expect(page2.total).toBe(5);
      expect(page2.results).toHaveLength(2);
    });

    it("caps limit at 100", async () => {
      const { globalSearch } = await import("~/services/search.server");

      await globalSearch("test", "t-1", { limit: 200 });

      // The take parameter passed to prisma should be capped at 100
      expect(mockUserFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        }),
      );
    });

    it("defaults limit to 50 and page to 1", async () => {
      const { globalSearch } = await import("~/services/search.server");

      await globalSearch("test", "t-1");

      expect(mockUserFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        }),
      );
    });

    it("returns empty results array for out-of-range page", async () => {
      const { globalSearch } = await import("~/services/search.server");

      mockUserFindMany.mockResolvedValue([
        { id: "u-1", name: "Test User", email: "test@example.com", username: "test" },
      ]);

      const result = await globalSearch("test", "t-1", { limit: 10, page: 100 });

      expect(result.total).toBe(1);
      expect(result.results).toHaveLength(0);
    });
  });

  // ─── Audit log limit ────────────────────────────────────

  describe("globalSearch - audit log limit", () => {
    it("limits audit log results to 10 even if limit is higher", async () => {
      const { globalSearch } = await import("~/services/search.server");

      await globalSearch("test", "t-1", { limit: 50 });

      expect(mockAuditLogFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        }),
      );
    });

    it("uses the provided limit for audit logs when it is less than 10", async () => {
      const { globalSearch } = await import("~/services/search.server");

      await globalSearch("test", "t-1", { limit: 5 });

      expect(mockAuditLogFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
        }),
      );
    });
  });

  // ─── Prisma query structure ──────────────────────────────

  describe("globalSearch - query structure", () => {
    it("passes tenantId and contains filter to user query", async () => {
      const { globalSearch } = await import("~/services/search.server");

      await globalSearch("alice", "t-1");

      expect(mockUserFindMany).toHaveBeenCalledWith({
        where: {
          tenantId: "t-1",
          deletedAt: null,
          OR: [
            { name: { contains: "alice", mode: "insensitive" } },
            { email: { contains: "alice", mode: "insensitive" } },
            { username: { contains: "alice", mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, email: true, username: true },
        take: 50,
      });
    });

    it("passes tenantId and contains filter to role query", async () => {
      const { globalSearch } = await import("~/services/search.server");

      await globalSearch("admin", "t-1");

      expect(mockRoleFindMany).toHaveBeenCalledWith({
        where: {
          tenantId: "t-1",
          deletedAt: null,
          OR: [
            { name: { contains: "admin", mode: "insensitive" } },
            { description: { contains: "admin", mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, description: true },
        take: 50,
      });
    });

    it("does not pass tenantId to permission query", async () => {
      const { globalSearch } = await import("~/services/search.server");

      await globalSearch("read", "t-1");

      expect(mockPermissionFindMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { resource: { contains: "read", mode: "insensitive" } },
            { action: { contains: "read", mode: "insensitive" } },
            { description: { contains: "read", mode: "insensitive" } },
          ],
        },
        select: { id: true, resource: true, action: true, description: true },
        take: 50,
      });
    });

    it("trims the query before searching", async () => {
      const { globalSearch } = await import("~/services/search.server");

      await globalSearch("  admin  ", "t-1");

      expect(mockUserFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { name: { contains: "admin", mode: "insensitive" } },
            ]),
          }),
        }),
      );
    });
  });

  // ─── No results ──────────────────────────────────────────

  describe("globalSearch - no results", () => {
    it("returns empty results when nothing matches", async () => {
      const { globalSearch } = await import("~/services/search.server");

      const result = await globalSearch("zzzzzzzzz", "t-1");

      expect(result.total).toBe(0);
      expect(result.results).toEqual([]);
      expect(result.query).toBe("zzzzzzzzz");
    });
  });
});

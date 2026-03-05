import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTenantCreate = vi.fn();
const mockTenantUpdate = vi.fn();
const mockTenantDelete = vi.fn();
const mockTenantFindFirst = vi.fn();
const mockTenantFindMany = vi.fn();
const mockTenantCount = vi.fn();
const mockAuditLogCreate = vi.fn();
const mockRoleCreate = vi.fn();
const mockRoleFindFirst = vi.fn();
const mockPermissionFindMany = vi.fn();
const mockRolePermissionCreateMany = vi.fn();
const mockUserCreate = vi.fn();
const mockUserRoleCreate = vi.fn();
const mockHashPassword = vi.fn();

vi.mock("~/lib/db/db.server", () => ({
  prisma: {
    tenant: {
      create: (...args: unknown[]) => mockTenantCreate(...args),
      update: (...args: unknown[]) => mockTenantUpdate(...args),
      delete: (...args: unknown[]) => mockTenantDelete(...args),
      findFirst: (...args: unknown[]) => mockTenantFindFirst(...args),
      findMany: (...args: unknown[]) => mockTenantFindMany(...args),
      count: (...args: unknown[]) => mockTenantCount(...args),
    },
    auditLog: {
      create: (...args: unknown[]) => mockAuditLogCreate(...args),
    },
    role: {
      create: (...args: unknown[]) => mockRoleCreate(...args),
      findFirst: (...args: unknown[]) => mockRoleFindFirst(...args),
    },
    permission: {
      findMany: (...args: unknown[]) => mockPermissionFindMany(...args),
    },
    rolePermission: {
      createMany: (...args: unknown[]) => mockRolePermissionCreateMany(...args),
    },
    user: {
      create: (...args: unknown[]) => mockUserCreate(...args),
    },
    userRole: {
      create: (...args: unknown[]) => mockUserRoleCreate(...args),
    },
  },
}));

vi.mock("~/lib/auth/auth.server", () => ({
  hashPassword: (...args: unknown[]) => mockHashPassword(...args),
}));

vi.mock("~/lib/monitoring/logger.server", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const baseCtx = {
  userId: "ctx-user-1",
  tenantId: "admin-tenant",
  ipAddress: "127.0.0.1",
  userAgent: "test-agent",
};

describe("tenants.server", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockHashPassword.mockResolvedValue("hashed-admin-password");
  });

  // ---------------------------------------------------------------------------
  // listTenants
  // ---------------------------------------------------------------------------
  describe("listTenants", () => {
    it("lists all tenants excluding admin", async () => {
      const { listTenants } = await import("../tenants.server");
      const mockTenants = [
        { id: "t-1", name: "Acme Corp", slug: "acme", _count: { users: 5, roles: 3 } },
        { id: "t-2", name: "Beta Inc", slug: "beta", _count: { users: 2, roles: 2 } },
      ];
      mockTenantFindMany.mockResolvedValue(mockTenants);

      const result = await listTenants();

      expect(result).toHaveLength(2);
      expect(mockTenantFindMany).toHaveBeenCalledWith({
        where: { slug: { not: "admin" } },
        orderBy: { name: "asc" },
        include: {
          _count: { select: { users: true, roles: true } },
        },
      });
    });

    it("returns empty array when no tenants exist", async () => {
      const { listTenants } = await import("../tenants.server");
      mockTenantFindMany.mockResolvedValue([]);

      const result = await listTenants();

      expect(result).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // listTenantsPaginated
  // ---------------------------------------------------------------------------
  describe("listTenantsPaginated", () => {
    it("returns paginated tenants with totalCount", async () => {
      const { listTenantsPaginated } = await import("../tenants.server");
      const mockTenants = [
        { id: "t-1", name: "Acme Corp", _count: { users: 5, roles: 3 } },
      ];
      mockTenantFindMany.mockResolvedValue(mockTenants);
      mockTenantCount.mockResolvedValue(15);

      const result = await listTenantsPaginated({ page: 2, pageSize: 10 });

      expect(result.items).toEqual(mockTenants);
      expect(result.totalCount).toBe(15);
      expect(mockTenantFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
    });

    it("applies default orderBy when none provided", async () => {
      const { listTenantsPaginated } = await import("../tenants.server");
      mockTenantFindMany.mockResolvedValue([]);
      mockTenantCount.mockResolvedValue(0);

      await listTenantsPaginated({ page: 1, pageSize: 10 });

      const callArgs = mockTenantFindMany.mock.calls[0][0];
      expect(callArgs.orderBy).toEqual({ name: "asc" });
    });

    it("uses custom orderBy when provided", async () => {
      const { listTenantsPaginated } = await import("../tenants.server");
      mockTenantFindMany.mockResolvedValue([]);
      mockTenantCount.mockResolvedValue(0);

      await listTenantsPaginated({
        page: 1,
        pageSize: 10,
        orderBy: [{ createdAt: "desc" }],
      });

      const callArgs = mockTenantFindMany.mock.calls[0][0];
      expect(callArgs.orderBy).toEqual([{ createdAt: "desc" }]);
    });

    it("merges base where with options.where using AND", async () => {
      const { listTenantsPaginated } = await import("../tenants.server");
      mockTenantFindMany.mockResolvedValue([]);
      mockTenantCount.mockResolvedValue(0);

      await listTenantsPaginated({
        page: 1,
        pageSize: 10,
        where: { name: { contains: "Acme" } },
      });

      const callArgs = mockTenantFindMany.mock.calls[0][0];
      expect(callArgs.where).toEqual({
        AND: [
          { slug: { not: "admin" } },
          { name: { contains: "Acme" } },
        ],
      });
    });

    it("uses only base where when options.where is empty", async () => {
      const { listTenantsPaginated } = await import("../tenants.server");
      mockTenantFindMany.mockResolvedValue([]);
      mockTenantCount.mockResolvedValue(0);

      await listTenantsPaginated({ page: 1, pageSize: 10, where: {} });

      const callArgs = mockTenantFindMany.mock.calls[0][0];
      expect(callArgs.where).toEqual({ slug: { not: "admin" } });
    });
  });

  // ---------------------------------------------------------------------------
  // getTenant
  // ---------------------------------------------------------------------------
  describe("getTenant", () => {
    it("returns a tenant by id", async () => {
      const { getTenant } = await import("../tenants.server");
      const mockTenant = { id: "t-1", name: "Acme Corp", slug: "acme" };
      mockTenantFindFirst.mockResolvedValue(mockTenant);

      const result = await getTenant("t-1");

      expect(result.id).toBe("t-1");
      expect(result.name).toBe("Acme Corp");
      expect(mockTenantFindFirst).toHaveBeenCalledWith({ where: { id: "t-1" } });
    });

    it("throws TenantError when not found", async () => {
      const { getTenant, TenantError } = await import("../tenants.server");
      mockTenantFindFirst.mockResolvedValue(null);

      await expect(getTenant("missing-id")).rejects.toThrow(TenantError);
      await expect(getTenant("missing-id")).rejects.toThrow("Tenant not found");
    });
  });

  // ---------------------------------------------------------------------------
  // getTenantBySlug
  // ---------------------------------------------------------------------------
  describe("getTenantBySlug", () => {
    it("returns a tenant by slug", async () => {
      const { getTenantBySlug } = await import("../tenants.server");
      const mockTenant = { id: "t-1", name: "Acme Corp", slug: "acme" };
      mockTenantFindFirst.mockResolvedValue(mockTenant);

      const result = await getTenantBySlug("acme");

      expect(result.slug).toBe("acme");
      expect(mockTenantFindFirst).toHaveBeenCalledWith({ where: { slug: "acme" } });
    });

    it("throws TenantError when not found", async () => {
      const { getTenantBySlug, TenantError } = await import("../tenants.server");
      mockTenantFindFirst.mockResolvedValue(null);

      await expect(getTenantBySlug("nonexistent")).rejects.toThrow(TenantError);
      await expect(getTenantBySlug("nonexistent")).rejects.toThrow("Tenant not found");
    });
  });

  // ---------------------------------------------------------------------------
  // getTenantWithCounts
  // ---------------------------------------------------------------------------
  describe("getTenantWithCounts", () => {
    it("returns a tenant with user and role counts", async () => {
      const { getTenantWithCounts } = await import("../tenants.server");
      const mockTenant = {
        id: "t-1",
        name: "Acme Corp",
        _count: { users: 10, roles: 5 },
      };
      mockTenantFindFirst.mockResolvedValue(mockTenant);

      const result = await getTenantWithCounts("t-1");

      expect(result._count.users).toBe(10);
      expect(result._count.roles).toBe(5);
      expect(mockTenantFindFirst).toHaveBeenCalledWith({
        where: { id: "t-1" },
        include: { _count: { select: { users: true, roles: true } } },
      });
    });

    it("throws TenantError when not found", async () => {
      const { getTenantWithCounts, TenantError } = await import("../tenants.server");
      mockTenantFindFirst.mockResolvedValue(null);

      await expect(getTenantWithCounts("missing-id")).rejects.toThrow(TenantError);
    });
  });

  // ---------------------------------------------------------------------------
  // getTenantDetail
  // ---------------------------------------------------------------------------
  describe("getTenantDetail", () => {
    it("returns a tenant detail wrapped in { tenant }", async () => {
      const { getTenantDetail } = await import("../tenants.server");
      const mockTenant = {
        id: "t-1",
        name: "Acme Corp",
        _count: { users: 10, roles: 5 },
      };
      mockTenantFindFirst.mockResolvedValue(mockTenant);

      const result = await getTenantDetail("t-1");

      expect(result.tenant).toBeDefined();
      expect(result.tenant.id).toBe("t-1");
    });

    it("throws TenantError when not found", async () => {
      const { getTenantDetail, TenantError } = await import("../tenants.server");
      mockTenantFindFirst.mockResolvedValue(null);

      await expect(getTenantDetail("missing-id")).rejects.toThrow(TenantError);
    });
  });

  // ---------------------------------------------------------------------------
  // createTenant
  // ---------------------------------------------------------------------------
  describe("createTenant", () => {
    const validInput = {
      name: "New Org",
      slug: "new-org",
      email: "info@neworg.com",
      phone: "+1234567890",
      website: "https://neworg.com",
      address: "123 Main St",
      city: "Springfield",
      state: "IL",
      zip: "62704",
      country: "US",
      subscriptionPlan: "pro",
    };

    it("creates a tenant with default roles and audit log", async () => {
      const { createTenant } = await import("../tenants.server");
      const createdTenant = { id: "t-new", name: "New Org", subscriptionPlan: "pro" };
      mockTenantCreate.mockResolvedValue(createdTenant);
      mockRoleCreate.mockResolvedValue({});
      mockRoleFindFirst.mockResolvedValue({ id: "role-ta", name: "TENANT_ADMIN" });
      mockPermissionFindMany.mockResolvedValue([
        { id: "p-1" },
        { id: "p-2" },
      ]);
      mockRolePermissionCreateMany.mockResolvedValue({ count: 2 });
      mockAuditLogCreate.mockResolvedValue({});

      const result = await createTenant(validInput, baseCtx);

      expect(result.id).toBe("t-new");
      expect(mockTenantCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "New Org",
          slug: "new-org",
          email: "info@neworg.com",
          phone: "+1234567890",
          subscriptionPlan: "pro",
        }),
      });
      // 6 default roles are created
      expect(mockRoleCreate).toHaveBeenCalledTimes(6);
      // Permissions assigned to TENANT_ADMIN
      expect(mockRolePermissionCreateMany).toHaveBeenCalledWith({
        data: [
          { roleId: "role-ta", permissionId: "p-1", access: "any" },
          { roleId: "role-ta", permissionId: "p-2", access: "any" },
        ],
        skipDuplicates: true,
      });
      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "CREATE",
          entityType: "Tenant",
          entityId: "t-new",
        }),
      });
    });

    it("creates tenant with admin user when admin fields are provided", async () => {
      const { createTenant } = await import("../tenants.server");
      const createdTenant = { id: "t-new", name: "New Org", subscriptionPlan: "pro" };
      mockTenantCreate.mockResolvedValue(createdTenant);
      mockRoleCreate.mockResolvedValue({});
      mockRoleFindFirst.mockResolvedValue({ id: "role-ta", name: "TENANT_ADMIN" });
      mockPermissionFindMany.mockResolvedValue([]);
      mockRolePermissionCreateMany.mockResolvedValue({ count: 0 });
      const adminUser = { id: "admin-u-1", email: "admin@neworg.com" };
      mockUserCreate.mockResolvedValue(adminUser);
      mockUserRoleCreate.mockResolvedValue({});
      mockAuditLogCreate.mockResolvedValue({});

      const inputWithAdmin = {
        ...validInput,
        adminEmail: "admin@neworg.com",
        adminName: "Admin User",
        adminPassword: "admin-secret",
      };

      const result = await createTenant(inputWithAdmin, baseCtx);

      expect(result.id).toBe("t-new");
      expect(mockUserCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: "admin@neworg.com",
          username: "admin",
          name: "Admin User",
          status: "ACTIVE",
          tenantId: "t-new",
          password: { create: { hash: "hashed-admin-password" } },
        }),
      });
      expect(mockUserRoleCreate).toHaveBeenCalledWith({
        data: {
          userId: "admin-u-1",
          roleId: "role-ta",
          eventId: null,
        },
      });
      // Audit log should mention admin user
      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          description: expect.stringContaining("admin@neworg.com"),
          metadata: expect.objectContaining({ adminEmail: "admin@neworg.com" }),
        }),
      });
    });

    it("does not create admin user when admin fields are missing", async () => {
      const { createTenant } = await import("../tenants.server");
      mockTenantCreate.mockResolvedValue({ id: "t-new", name: "New Org", subscriptionPlan: "free" });
      mockRoleCreate.mockResolvedValue({});
      mockRoleFindFirst.mockResolvedValue(null);
      mockAuditLogCreate.mockResolvedValue({});

      await createTenant(validInput, baseCtx);

      expect(mockUserCreate).not.toHaveBeenCalled();
    });

    it("defaults subscriptionPlan to free", async () => {
      const { createTenant } = await import("../tenants.server");
      mockTenantCreate.mockResolvedValue({ id: "t-new", name: "Org", subscriptionPlan: "free" });
      mockRoleCreate.mockResolvedValue({});
      mockRoleFindFirst.mockResolvedValue(null);
      mockAuditLogCreate.mockResolvedValue({});

      const inputNoplan = { ...validInput, subscriptionPlan: undefined };
      await createTenant(inputNoplan, baseCtx);

      const callArgs = mockTenantCreate.mock.calls[0][0];
      expect(callArgs.data.subscriptionPlan).toBe("free");
    });

    it("throws TenantError on duplicate name/email (P2002)", async () => {
      const { createTenant, TenantError } = await import("../tenants.server");
      const prismaError = new Error("Unique constraint failed");
      (prismaError as any).code = "P2002";
      mockTenantCreate.mockRejectedValue(prismaError);

      await expect(createTenant(validInput, baseCtx)).rejects.toThrow(TenantError);
      await expect(createTenant(validInput, baseCtx)).rejects.toThrow(
        "A tenant with this name or email already exists",
      );
    });

    it("rethrows non-P2002 errors from tenant create", async () => {
      const { createTenant, TenantError } = await import("../tenants.server");
      const genericError = new Error("DB connection timeout");
      mockTenantCreate.mockRejectedValue(genericError);

      await expect(createTenant(validInput, baseCtx)).rejects.toThrow("DB connection timeout");

      try {
        await createTenant(validInput, baseCtx);
      } catch (error) {
        expect(error).not.toBeInstanceOf(TenantError);
      }
    });

    it("throws TenantError on duplicate admin user (P2002)", async () => {
      const { createTenant, TenantError } = await import("../tenants.server");
      mockTenantCreate.mockResolvedValue({ id: "t-new", name: "Org", subscriptionPlan: "free" });
      mockRoleCreate.mockResolvedValue({});
      mockRoleFindFirst.mockResolvedValue({ id: "role-ta" });
      mockPermissionFindMany.mockResolvedValue([]);
      mockRolePermissionCreateMany.mockResolvedValue({ count: 0 });
      const prismaError = new Error("Unique constraint failed");
      (prismaError as any).code = "P2002";
      mockUserCreate.mockRejectedValue(prismaError);

      const inputWithAdmin = {
        ...validInput,
        adminEmail: "dup@example.com",
        adminPassword: "pw",
      };

      await expect(createTenant(inputWithAdmin, baseCtx)).rejects.toThrow(TenantError);
      await expect(createTenant(inputWithAdmin, baseCtx)).rejects.toThrow(
        "A user with this admin email or username already exists",
      );
    });

    it("skips permission assignment when TENANT_ADMIN role not found", async () => {
      const { createTenant } = await import("../tenants.server");
      mockTenantCreate.mockResolvedValue({ id: "t-new", name: "Org", subscriptionPlan: "free" });
      mockRoleCreate.mockResolvedValue({});
      mockRoleFindFirst.mockResolvedValue(null);
      mockAuditLogCreate.mockResolvedValue({});

      await createTenant(validInput, baseCtx);

      expect(mockPermissionFindMany).not.toHaveBeenCalled();
      expect(mockRolePermissionCreateMany).not.toHaveBeenCalled();
    });

    it("sets optional fields to empty/null when not provided", async () => {
      const { createTenant } = await import("../tenants.server");
      mockTenantCreate.mockResolvedValue({ id: "t-new", name: "Minimal", subscriptionPlan: "free" });
      mockRoleCreate.mockResolvedValue({});
      mockRoleFindFirst.mockResolvedValue(null);
      mockAuditLogCreate.mockResolvedValue({});

      const minimalInput = {
        name: "Minimal",
        slug: "minimal",
        email: "info@minimal.com",
        phone: "123",
      };
      await createTenant(minimalInput, baseCtx);

      const callArgs = mockTenantCreate.mock.calls[0][0];
      expect(callArgs.data.website).toBeNull();
      expect(callArgs.data.address).toBe("");
      expect(callArgs.data.logoUrl).toBeNull();
      expect(callArgs.data.brandTheme).toBe("");
    });
  });

  // ---------------------------------------------------------------------------
  // updateTenant
  // ---------------------------------------------------------------------------
  describe("updateTenant", () => {
    const updateInput = {
      name: "Updated Org",
      slug: "updated-org",
      email: "updated@org.com",
      phone: "+9876543210",
      subscriptionPlan: "enterprise",
    };

    it("updates a tenant and creates audit log", async () => {
      const { updateTenant } = await import("../tenants.server");
      const existingTenant = { id: "t-1", name: "Old Org" };
      const updatedTenant = { id: "t-1", name: "Updated Org", subscriptionPlan: "enterprise" };
      mockTenantFindFirst.mockResolvedValue(existingTenant);
      mockTenantUpdate.mockResolvedValue(updatedTenant);
      mockAuditLogCreate.mockResolvedValue({});

      const result = await updateTenant("t-1", updateInput, baseCtx);

      expect(result.name).toBe("Updated Org");
      expect(mockTenantUpdate).toHaveBeenCalledWith({
        where: { id: "t-1" },
        data: expect.objectContaining({
          name: "Updated Org",
          slug: "updated-org",
          subscriptionPlan: "enterprise",
        }),
      });
      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "UPDATE",
          entityType: "Tenant",
          entityId: "t-1",
        }),
      });
    });

    it("throws TenantError when tenant not found", async () => {
      const { updateTenant, TenantError } = await import("../tenants.server");
      mockTenantFindFirst.mockResolvedValue(null);

      await expect(updateTenant("missing-id", updateInput, baseCtx)).rejects.toThrow(TenantError);
      await expect(updateTenant("missing-id", updateInput, baseCtx)).rejects.toThrow(
        "Tenant not found",
      );
    });

    it("throws TenantError on duplicate name/email (P2002)", async () => {
      const { updateTenant, TenantError } = await import("../tenants.server");
      mockTenantFindFirst.mockResolvedValue({ id: "t-1", name: "Old" });
      const prismaError = new Error("Unique constraint failed");
      (prismaError as any).code = "P2002";
      mockTenantUpdate.mockRejectedValue(prismaError);

      await expect(updateTenant("t-1", updateInput, baseCtx)).rejects.toThrow(TenantError);
      await expect(updateTenant("t-1", updateInput, baseCtx)).rejects.toThrow(
        "A tenant with this name or email already exists",
      );
    });

    it("rethrows non-P2002 errors", async () => {
      const { updateTenant, TenantError } = await import("../tenants.server");
      mockTenantFindFirst.mockResolvedValue({ id: "t-1" });
      const genericError = new Error("Unexpected failure");
      mockTenantUpdate.mockRejectedValue(genericError);

      await expect(updateTenant("t-1", updateInput, baseCtx)).rejects.toThrow("Unexpected failure");

      try {
        await updateTenant("t-1", updateInput, baseCtx);
      } catch (error) {
        expect(error).not.toBeInstanceOf(TenantError);
      }
    });

    it("sets optional fields to empty strings when not provided", async () => {
      const { updateTenant } = await import("../tenants.server");
      mockTenantFindFirst.mockResolvedValue({ id: "t-1" });
      mockTenantUpdate.mockResolvedValue({ id: "t-1", name: "Org", subscriptionPlan: "free" });
      mockAuditLogCreate.mockResolvedValue({});

      const minimalUpdate = {
        name: "Org",
        slug: "org",
        email: "e@e.com",
        phone: "123",
        subscriptionPlan: "free",
      };
      await updateTenant("t-1", minimalUpdate, baseCtx);

      const callArgs = mockTenantUpdate.mock.calls[0][0];
      expect(callArgs.data.website).toBe("");
      expect(callArgs.data.address).toBe("");
      expect(callArgs.data.logoUrl).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // deleteTenant
  // ---------------------------------------------------------------------------
  describe("deleteTenant", () => {
    it("hard-deletes a tenant with no users and creates audit log", async () => {
      const { deleteTenant } = await import("../tenants.server");
      mockTenantFindFirst.mockResolvedValue({
        id: "t-1",
        name: "Empty Org",
        _count: { users: 0 },
      });
      mockTenantDelete.mockResolvedValue({});
      mockAuditLogCreate.mockResolvedValue({});

      await deleteTenant("t-1", baseCtx);

      expect(mockTenantDelete).toHaveBeenCalledWith({ where: { id: "t-1" } });
      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "DELETE",
          entityType: "Tenant",
          entityId: "t-1",
          description: 'Deleted tenant "Empty Org"',
        }),
      });
    });

    it("throws TenantError when tenant not found", async () => {
      const { deleteTenant, TenantError } = await import("../tenants.server");
      mockTenantFindFirst.mockResolvedValue(null);

      await expect(deleteTenant("missing-id", baseCtx)).rejects.toThrow(TenantError);
      await expect(deleteTenant("missing-id", baseCtx)).rejects.toThrow("Tenant not found");
    });

    it("throws TenantError when tenant has users", async () => {
      const { deleteTenant, TenantError } = await import("../tenants.server");
      mockTenantFindFirst.mockResolvedValue({
        id: "t-1",
        name: "Busy Org",
        _count: { users: 7 },
      });

      await expect(deleteTenant("t-1", baseCtx)).rejects.toThrow(TenantError);
      await expect(deleteTenant("t-1", baseCtx)).rejects.toThrow(
        "Cannot delete tenant with 7 user(s). Remove all users first.",
      );
    });

    it("does not call delete when tenant has users", async () => {
      const { deleteTenant } = await import("../tenants.server");
      mockTenantFindFirst.mockResolvedValue({
        id: "t-1",
        name: "Busy Org",
        _count: { users: 3 },
      });

      try {
        await deleteTenant("t-1", baseCtx);
      } catch {
        // expected
      }

      expect(mockTenantDelete).not.toHaveBeenCalled();
      expect(mockAuditLogCreate).not.toHaveBeenCalled();
    });
  });
});

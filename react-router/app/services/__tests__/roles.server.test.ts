import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRoleCreate = vi.fn();
const mockRoleUpdate = vi.fn();
const mockRoleFindFirst = vi.fn();
const mockRoleFindMany = vi.fn();
const mockRoleCount = vi.fn();
const mockRolePermissionDeleteMany = vi.fn();
const mockRolePermissionCreateMany = vi.fn();
const mockAuditLogCreate = vi.fn();

vi.mock("~/lib/db/db.server", () => ({
  prisma: {
    role: {
      create: (...args: unknown[]) => mockRoleCreate(...args),
      update: (...args: unknown[]) => mockRoleUpdate(...args),
      findFirst: (...args: unknown[]) => mockRoleFindFirst(...args),
      findMany: (...args: unknown[]) => mockRoleFindMany(...args),
      count: (...args: unknown[]) => mockRoleCount(...args),
    },
    rolePermission: {
      deleteMany: (...args: unknown[]) => mockRolePermissionDeleteMany(...args),
      createMany: (...args: unknown[]) => mockRolePermissionCreateMany(...args),
    },
    auditLog: {
      create: (...args: unknown[]) => mockAuditLogCreate(...args),
    },
  },
}));

vi.mock("~/lib/monitoring/logger.server", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Mock the re-exported listPermissions from permissions.server
vi.mock("~/services/permissions.server", () => ({
  listPermissions: vi.fn(),
}));

const mockCtx = {
  userId: "user-1",
  tenantId: "tenant-1",
  ipAddress: "127.0.0.1",
  userAgent: "vitest",
};

const mockRole = {
  id: "role-1",
  tenantId: "tenant-1",
  name: "Editor",
  description: "Can edit content",
  scope: "TENANT",
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
};

describe("roles.server", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ---------------------------------------------------------------------------
  // listRoles
  // ---------------------------------------------------------------------------
  describe("listRoles", () => {
    it("lists roles for a tenant with default ordering", async () => {
      const { listRoles } = await import("../roles.server");
      const roles = [
        { ...mockRole, _count: { userRoles: 5, rolePermissions: 3 } },
        {
          ...mockRole,
          id: "role-2",
          name: "Viewer",
          _count: { userRoles: 10, rolePermissions: 1 },
        },
      ];
      mockRoleFindMany.mockResolvedValue(roles);

      const result = await listRoles("tenant-1");

      expect(result).toHaveLength(2);
      expect(mockRoleFindMany).toHaveBeenCalledWith({
        where: { tenantId: "tenant-1" },
        orderBy: { name: "asc" },
        include: {
          _count: { select: { userRoles: true, rolePermissions: true } },
        },
      });
    });

    it("applies custom where and orderBy options", async () => {
      const { listRoles } = await import("../roles.server");
      mockRoleFindMany.mockResolvedValue([]);

      await listRoles("tenant-1", {
        where: { scope: "GLOBAL" },
        orderBy: [{ createdAt: "desc" }],
      });

      expect(mockRoleFindMany).toHaveBeenCalledWith({
        where: { tenantId: "tenant-1", scope: "GLOBAL" },
        orderBy: [{ createdAt: "desc" }],
        include: {
          _count: { select: { userRoles: true, rolePermissions: true } },
        },
      });
    });

    it("returns empty array when no roles exist", async () => {
      const { listRoles } = await import("../roles.server");
      mockRoleFindMany.mockResolvedValue([]);

      const result = await listRoles("tenant-1");

      expect(result).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // listRolesPaginated
  // ---------------------------------------------------------------------------
  describe("listRolesPaginated", () => {
    it("returns paginated results with default ordering", async () => {
      const { listRolesPaginated } = await import("../roles.server");
      const items = [{ ...mockRole, _count: { userRoles: 2, rolePermissions: 4 } }];
      mockRoleFindMany.mockResolvedValue(items);
      mockRoleCount.mockResolvedValue(25);

      const result = await listRolesPaginated("tenant-1", {
        page: 3,
        pageSize: 10,
      });

      expect(result.items).toEqual(items);
      expect(result.totalCount).toBe(25);
      expect(mockRoleFindMany).toHaveBeenCalledWith({
        where: { tenantId: "tenant-1" },
        orderBy: { name: "asc" },
        include: { _count: { select: { userRoles: true, rolePermissions: true } } },
        skip: 20,
        take: 10,
      });
      expect(mockRoleCount).toHaveBeenCalledWith({ where: { tenantId: "tenant-1" } });
    });

    it("applies custom where and orderBy", async () => {
      const { listRolesPaginated } = await import("../roles.server");
      mockRoleFindMany.mockResolvedValue([]);
      mockRoleCount.mockResolvedValue(0);

      await listRolesPaginated("tenant-1", {
        page: 1,
        pageSize: 5,
        where: { name: { contains: "admin" } },
        orderBy: [{ name: "desc" }],
      });

      expect(mockRoleFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: "tenant-1", name: { contains: "admin" } },
          orderBy: [{ name: "desc" }],
          skip: 0,
          take: 5,
        }),
      );
    });

    it("calculates correct skip for first page", async () => {
      const { listRolesPaginated } = await import("../roles.server");
      mockRoleFindMany.mockResolvedValue([]);
      mockRoleCount.mockResolvedValue(0);

      await listRolesPaginated("tenant-1", { page: 1, pageSize: 20 });

      expect(mockRoleFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getRole
  // ---------------------------------------------------------------------------
  describe("getRole", () => {
    it("returns a role with permissions by id and tenantId", async () => {
      const { getRole } = await import("../roles.server");
      const roleWithPermissions = {
        ...mockRole,
        rolePermissions: [
          { permission: { id: "perm-1", resource: "user", action: "read" } },
          { permission: { id: "perm-2", resource: "user", action: "write" } },
        ],
      };
      mockRoleFindFirst.mockResolvedValue(roleWithPermissions);

      const result = await getRole("role-1", "tenant-1");

      expect(result).toEqual(roleWithPermissions);
      expect(result.rolePermissions).toHaveLength(2);
      expect(mockRoleFindFirst).toHaveBeenCalledWith({
        where: { id: "role-1", tenantId: "tenant-1" },
        include: {
          rolePermissions: { include: { permission: true } },
        },
      });
    });

    it("throws RoleError when not found", async () => {
      const { getRole, RoleError } = await import("../roles.server");
      mockRoleFindFirst.mockResolvedValue(null);

      await expect(getRole("nonexistent", "tenant-1")).rejects.toThrow(RoleError);
      await expect(getRole("nonexistent", "tenant-1")).rejects.toThrow("Role not found");
    });

    it("throws with 404 status when not found", async () => {
      const { getRole } = await import("../roles.server");
      mockRoleFindFirst.mockResolvedValue(null);

      try {
        await getRole("nonexistent", "tenant-1");
        expect.unreachable("Should have thrown");
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // getRoleWithCounts
  // ---------------------------------------------------------------------------
  describe("getRoleWithCounts", () => {
    it("returns a role with user and permission counts", async () => {
      const { getRoleWithCounts } = await import("../roles.server");
      const roleWithCounts = {
        ...mockRole,
        _count: { userRoles: 12, rolePermissions: 5 },
      };
      mockRoleFindFirst.mockResolvedValue(roleWithCounts);

      const result = await getRoleWithCounts("role-1", "tenant-1");

      expect(result._count.userRoles).toBe(12);
      expect(result._count.rolePermissions).toBe(5);
      expect(mockRoleFindFirst).toHaveBeenCalledWith({
        where: { id: "role-1", tenantId: "tenant-1" },
        include: {
          _count: { select: { userRoles: true, rolePermissions: true } },
        },
      });
    });

    it("throws RoleError when not found", async () => {
      const { getRoleWithCounts, RoleError } = await import("../roles.server");
      mockRoleFindFirst.mockResolvedValue(null);

      await expect(getRoleWithCounts("nonexistent", "tenant-1")).rejects.toThrow(RoleError);
      await expect(getRoleWithCounts("nonexistent", "tenant-1")).rejects.toThrow(
        "Role not found",
      );
    });
  });

  // ---------------------------------------------------------------------------
  // createRole
  // ---------------------------------------------------------------------------
  describe("createRole", () => {
    it("creates a role and logs an audit entry", async () => {
      const { createRole } = await import("../roles.server");
      const created = {
        id: "role-new",
        tenantId: "tenant-1",
        name: "Moderator",
        description: "Can moderate content",
      };
      mockRoleCreate.mockResolvedValue(created);
      mockAuditLogCreate.mockResolvedValue({});

      const result = await createRole(
        { name: "Moderator", description: "Can moderate content" },
        mockCtx,
      );

      expect(result).toEqual(created);
      expect(mockRoleCreate).toHaveBeenCalledWith({
        data: {
          tenantId: "tenant-1",
          name: "Moderator",
          description: "Can moderate content",
        },
      });
      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: "tenant-1",
          userId: "user-1",
          action: "CREATE",
          entityType: "Role",
          entityId: "role-new",
          description: 'Created role "Moderator"',
          ipAddress: "127.0.0.1",
          userAgent: "vitest",
          metadata: { name: "Moderator" },
        }),
      });
    });

    it("creates a role without description (sets null)", async () => {
      const { createRole } = await import("../roles.server");
      const created = { id: "role-new", tenantId: "tenant-1", name: "Basic", description: null };
      mockRoleCreate.mockResolvedValue(created);
      mockAuditLogCreate.mockResolvedValue({});

      await createRole({ name: "Basic" }, mockCtx);

      expect(mockRoleCreate).toHaveBeenCalledWith({
        data: {
          tenantId: "tenant-1",
          name: "Basic",
          description: null,
        },
      });
    });

    it("throws RoleError on duplicate name (P2002)", async () => {
      const { createRole, RoleError } = await import("../roles.server");
      const prismaError = new Error("Unique constraint failed");
      (prismaError as any).code = "P2002";
      mockRoleCreate.mockRejectedValue(prismaError);

      await expect(createRole({ name: "Admin" }, mockCtx)).rejects.toThrow(RoleError);
      await expect(createRole({ name: "Admin" }, mockCtx)).rejects.toThrow(
        "A role with this name already exists",
      );
    });

    it("throws RoleError with 409 status on duplicate", async () => {
      const { createRole } = await import("../roles.server");
      const prismaError = new Error("Unique constraint failed");
      (prismaError as any).code = "P2002";
      mockRoleCreate.mockRejectedValue(prismaError);

      try {
        await createRole({ name: "Admin" }, mockCtx);
        expect.unreachable("Should have thrown");
      } catch (error: any) {
        expect(error.status).toBe(409);
      }
    });

    it("re-throws non-P2002 errors", async () => {
      const { createRole } = await import("../roles.server");
      const genericError = new Error("Database timeout");
      mockRoleCreate.mockRejectedValue(genericError);

      await expect(createRole({ name: "Admin" }, mockCtx)).rejects.toThrow("Database timeout");
    });
  });

  // ---------------------------------------------------------------------------
  // updateRole
  // ---------------------------------------------------------------------------
  describe("updateRole", () => {
    it("updates a role name and description, and logs audit", async () => {
      const { updateRole } = await import("../roles.server");
      const existing = { ...mockRole };
      const updated = { ...mockRole, name: "Senior Editor", description: "Senior editing role" };
      mockRoleFindFirst.mockResolvedValue(existing);
      mockRoleUpdate.mockResolvedValue(updated);
      mockAuditLogCreate.mockResolvedValue({});

      const result = await updateRole(
        "role-1",
        { name: "Senior Editor", description: "Senior editing role" },
        mockCtx,
      );

      expect(result.name).toBe("Senior Editor");
      expect(mockRoleUpdate).toHaveBeenCalledWith({
        where: { id: "role-1" },
        data: {
          name: "Senior Editor",
          description: "Senior editing role",
        },
      });
      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "UPDATE",
          entityType: "Role",
          entityId: "role-1",
          metadata: {
            before: { name: "Editor", description: "Can edit content" },
            after: { name: "Senior Editor", description: "Senior editing role" },
          },
        }),
      });
    });

    it("sets description to null when empty string is provided", async () => {
      const { updateRole } = await import("../roles.server");
      mockRoleFindFirst.mockResolvedValue(mockRole);
      mockRoleUpdate.mockResolvedValue({ ...mockRole, name: "Editor", description: null });
      mockAuditLogCreate.mockResolvedValue({});

      await updateRole("role-1", { name: "Editor", description: "" }, mockCtx);

      expect(mockRoleUpdate).toHaveBeenCalledWith({
        where: { id: "role-1" },
        data: { name: "Editor", description: null },
      });
    });

    it("throws RoleError when role not found", async () => {
      const { updateRole, RoleError } = await import("../roles.server");
      mockRoleFindFirst.mockResolvedValue(null);

      await expect(
        updateRole("nonexistent", { name: "Updated" }, mockCtx),
      ).rejects.toThrow(RoleError);
      await expect(
        updateRole("nonexistent", { name: "Updated" }, mockCtx),
      ).rejects.toThrow("Role not found");
    });

    it("throws RoleError on duplicate name during update (P2002)", async () => {
      const { updateRole, RoleError } = await import("../roles.server");
      mockRoleFindFirst.mockResolvedValue(mockRole);
      const prismaError = new Error("Unique constraint failed");
      (prismaError as any).code = "P2002";
      mockRoleUpdate.mockRejectedValue(prismaError);

      await expect(
        updateRole("role-1", { name: "Admin" }, mockCtx),
      ).rejects.toThrow(RoleError);
      await expect(
        updateRole("role-1", { name: "Admin" }, mockCtx),
      ).rejects.toThrow("A role with this name already exists");
    });

    it("re-throws non-P2002 errors during update", async () => {
      const { updateRole } = await import("../roles.server");
      mockRoleFindFirst.mockResolvedValue(mockRole);
      const genericError = new Error("Connection reset");
      mockRoleUpdate.mockRejectedValue(genericError);

      await expect(updateRole("role-1", { name: "Test" }, mockCtx)).rejects.toThrow(
        "Connection reset",
      );
    });

    it("does not call update or audit when role is not found", async () => {
      const { updateRole } = await import("../roles.server");
      mockRoleFindFirst.mockResolvedValue(null);

      await expect(
        updateRole("nonexistent", { name: "Updated" }, mockCtx),
      ).rejects.toThrow();

      expect(mockRoleUpdate).not.toHaveBeenCalled();
      expect(mockAuditLogCreate).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // deleteRole
  // ---------------------------------------------------------------------------
  describe("deleteRole", () => {
    it("soft-deletes a role with no assigned users and logs audit", async () => {
      const { deleteRole } = await import("../roles.server");
      const existing = {
        ...mockRole,
        _count: { userRoles: 0, rolePermissions: 2 },
      };
      mockRoleFindFirst.mockResolvedValue(existing);
      mockRoleUpdate.mockResolvedValue({});
      mockAuditLogCreate.mockResolvedValue({});

      await deleteRole("role-1", mockCtx);

      expect(mockRoleUpdate).toHaveBeenCalledWith({
        where: { id: "role-1" },
        data: { deletedAt: expect.any(Date) },
      });
      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "DELETE",
          entityType: "Role",
          entityId: "role-1",
          description: 'Deleted role "Editor"',
          metadata: { name: "Editor" },
        }),
      });
    });

    it("throws RoleError when role not found", async () => {
      const { deleteRole, RoleError } = await import("../roles.server");
      mockRoleFindFirst.mockResolvedValue(null);

      await expect(deleteRole("nonexistent", mockCtx)).rejects.toThrow(RoleError);
      await expect(deleteRole("nonexistent", mockCtx)).rejects.toThrow("Role not found");
    });

    it("throws RoleError when role has assigned users", async () => {
      const { deleteRole, RoleError } = await import("../roles.server");
      mockRoleFindFirst.mockResolvedValue({
        ...mockRole,
        _count: { userRoles: 7, rolePermissions: 3 },
      });

      await expect(deleteRole("role-1", mockCtx)).rejects.toThrow(RoleError);
      await expect(deleteRole("role-1", mockCtx)).rejects.toThrow(
        "Cannot delete role with 7 assigned user(s). Unassign all users first.",
      );
    });

    it("throws with 409 status when role has assigned users", async () => {
      const { deleteRole } = await import("../roles.server");
      mockRoleFindFirst.mockResolvedValue({
        ...mockRole,
        _count: { userRoles: 1, rolePermissions: 0 },
      });

      try {
        await deleteRole("role-1", mockCtx);
        expect.unreachable("Should have thrown");
      } catch (error: any) {
        expect(error.status).toBe(409);
      }
    });

    it("does not call update or audit when role is not found", async () => {
      const { deleteRole } = await import("../roles.server");
      mockRoleFindFirst.mockResolvedValue(null);

      await expect(deleteRole("nonexistent", mockCtx)).rejects.toThrow();

      expect(mockRoleUpdate).not.toHaveBeenCalled();
      expect(mockAuditLogCreate).not.toHaveBeenCalled();
    });

    it("does not call update when role has assigned users", async () => {
      const { deleteRole } = await import("../roles.server");
      mockRoleFindFirst.mockResolvedValue({
        ...mockRole,
        _count: { userRoles: 5, rolePermissions: 0 },
      });

      await expect(deleteRole("role-1", mockCtx)).rejects.toThrow();

      expect(mockRoleUpdate).not.toHaveBeenCalled();
      expect(mockAuditLogCreate).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // assignPermissions
  // ---------------------------------------------------------------------------
  describe("assignPermissions", () => {
    it("replaces all permissions for a role and logs audit", async () => {
      const { assignPermissions } = await import("../roles.server");
      mockRoleFindFirst.mockResolvedValue(mockRole);
      mockRolePermissionDeleteMany.mockResolvedValue({ count: 2 });
      mockRolePermissionCreateMany.mockResolvedValue({ count: 3 });
      mockAuditLogCreate.mockResolvedValue({});

      const assignments = [
        { permissionId: "perm-1" },
        { permissionId: "perm-2", access: "own" },
        { permissionId: "perm-3", access: "any" },
      ];

      await assignPermissions("role-1", assignments, mockCtx);

      expect(mockRolePermissionDeleteMany).toHaveBeenCalledWith({
        where: { roleId: "role-1" },
      });
      expect(mockRolePermissionCreateMany).toHaveBeenCalledWith({
        data: [
          { roleId: "role-1", permissionId: "perm-1", access: "any" },
          { roleId: "role-1", permissionId: "perm-2", access: "own" },
          { roleId: "role-1", permissionId: "perm-3", access: "any" },
        ],
        skipDuplicates: true,
      });
      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "UPDATE",
          entityType: "Role",
          entityId: "role-1",
          description: 'Updated permission assignments for role "Editor"',
          metadata: { permissionCount: 3 },
        }),
      });
    });

    it("handles empty assignments (clears all permissions)", async () => {
      const { assignPermissions } = await import("../roles.server");
      mockRoleFindFirst.mockResolvedValue(mockRole);
      mockRolePermissionDeleteMany.mockResolvedValue({ count: 5 });
      mockAuditLogCreate.mockResolvedValue({});

      await assignPermissions("role-1", [], mockCtx);

      expect(mockRolePermissionDeleteMany).toHaveBeenCalledWith({
        where: { roleId: "role-1" },
      });
      expect(mockRolePermissionCreateMany).not.toHaveBeenCalled();
      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: { permissionCount: 0 },
        }),
      });
    });

    it("defaults access to 'any' when not specified", async () => {
      const { assignPermissions } = await import("../roles.server");
      mockRoleFindFirst.mockResolvedValue(mockRole);
      mockRolePermissionDeleteMany.mockResolvedValue({ count: 0 });
      mockRolePermissionCreateMany.mockResolvedValue({ count: 1 });
      mockAuditLogCreate.mockResolvedValue({});

      await assignPermissions("role-1", [{ permissionId: "perm-1" }], mockCtx);

      expect(mockRolePermissionCreateMany).toHaveBeenCalledWith({
        data: [{ roleId: "role-1", permissionId: "perm-1", access: "any" }],
        skipDuplicates: true,
      });
    });

    it("throws RoleError when role not found", async () => {
      const { assignPermissions, RoleError } = await import("../roles.server");
      mockRoleFindFirst.mockResolvedValue(null);

      await expect(
        assignPermissions("nonexistent", [{ permissionId: "perm-1" }], mockCtx),
      ).rejects.toThrow(RoleError);
      await expect(
        assignPermissions("nonexistent", [{ permissionId: "perm-1" }], mockCtx),
      ).rejects.toThrow("Role not found");
    });

    it("does not call deleteMany or createMany when role is not found", async () => {
      const { assignPermissions } = await import("../roles.server");
      mockRoleFindFirst.mockResolvedValue(null);

      await expect(
        assignPermissions("nonexistent", [{ permissionId: "perm-1" }], mockCtx),
      ).rejects.toThrow();

      expect(mockRolePermissionDeleteMany).not.toHaveBeenCalled();
      expect(mockRolePermissionCreateMany).not.toHaveBeenCalled();
      expect(mockAuditLogCreate).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // RoleError
  // ---------------------------------------------------------------------------
  describe("RoleError", () => {
    it("is an instance of ServiceError", async () => {
      const { RoleError } = await import("../roles.server");
      const { ServiceError } = await import("~/lib/errors/service-error.server");

      const error = new RoleError("test", 400);

      expect(error).toBeInstanceOf(ServiceError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("RoleError");
      expect(error.message).toBe("test");
      expect(error.status).toBe(400);
    });
  });
});

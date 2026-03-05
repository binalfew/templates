import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPermissionCreate = vi.fn();
const mockPermissionUpdate = vi.fn();
const mockPermissionDelete = vi.fn();
const mockPermissionFindFirst = vi.fn();
const mockPermissionFindMany = vi.fn();
const mockPermissionCount = vi.fn();
const mockAuditLogCreate = vi.fn();

vi.mock("~/lib/db/db.server", () => ({
  prisma: {
    permission: {
      create: (...args: unknown[]) => mockPermissionCreate(...args),
      update: (...args: unknown[]) => mockPermissionUpdate(...args),
      delete: (...args: unknown[]) => mockPermissionDelete(...args),
      findFirst: (...args: unknown[]) => mockPermissionFindFirst(...args),
      findMany: (...args: unknown[]) => mockPermissionFindMany(...args),
      count: (...args: unknown[]) => mockPermissionCount(...args),
    },
    auditLog: {
      create: (...args: unknown[]) => mockAuditLogCreate(...args),
    },
  },
}));

vi.mock("~/lib/monitoring/logger.server", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockCtx = {
  userId: "user-1",
  tenantId: "tenant-1",
  ipAddress: "127.0.0.1",
  userAgent: "vitest",
};

const mockPermission = {
  id: "perm-1",
  resource: "user",
  action: "read",
  description: "Read users",
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
};

describe("permissions.server", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ---------------------------------------------------------------------------
  // listPermissions
  // ---------------------------------------------------------------------------
  describe("listPermissions", () => {
    it("lists permissions with default ordering", async () => {
      const { listPermissions } = await import("~/services/permissions.server");
      mockPermissionFindMany.mockResolvedValue([
        { ...mockPermission, _count: { rolePermissions: 2 } },
      ]);

      const result = await listPermissions();

      expect(result).toHaveLength(1);
      expect(mockPermissionFindMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: [{ resource: "asc" }, { action: "asc" }],
        include: { _count: { select: { rolePermissions: true } } },
      });
    });

    it("applies custom where and orderBy options", async () => {
      const { listPermissions } = await import("~/services/permissions.server");
      mockPermissionFindMany.mockResolvedValue([]);

      await listPermissions({
        where: { resource: "user" },
        orderBy: [{ action: "desc" }],
      });

      expect(mockPermissionFindMany).toHaveBeenCalledWith({
        where: { resource: "user" },
        orderBy: [{ action: "desc" }],
        include: { _count: { select: { rolePermissions: true } } },
      });
    });

    it("returns empty array when no permissions exist", async () => {
      const { listPermissions } = await import("~/services/permissions.server");
      mockPermissionFindMany.mockResolvedValue([]);

      const result = await listPermissions();

      expect(result).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // listPermissionsPaginated
  // ---------------------------------------------------------------------------
  describe("listPermissionsPaginated", () => {
    it("returns paginated results with default ordering", async () => {
      const { listPermissionsPaginated } = await import("~/services/permissions.server");
      const items = [{ ...mockPermission, _count: { rolePermissions: 1 } }];
      mockPermissionFindMany.mockResolvedValue(items);
      mockPermissionCount.mockResolvedValue(15);

      const result = await listPermissionsPaginated({
        page: 2,
        pageSize: 10,
      });

      expect(result.items).toEqual(items);
      expect(result.totalCount).toBe(15);
      expect(mockPermissionFindMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ resource: "asc" }, { action: "asc" }],
        include: { _count: { select: { rolePermissions: true } } },
        skip: 10,
        take: 10,
      });
      expect(mockPermissionCount).toHaveBeenCalledWith({ where: {} });
    });

    it("applies custom where and orderBy", async () => {
      const { listPermissionsPaginated } = await import("~/services/permissions.server");
      mockPermissionFindMany.mockResolvedValue([]);
      mockPermissionCount.mockResolvedValue(0);

      await listPermissionsPaginated({
        page: 1,
        pageSize: 5,
        where: { resource: "role" },
        orderBy: [{ action: "desc" }],
      });

      expect(mockPermissionFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { resource: "role" },
          orderBy: [{ action: "desc" }],
          skip: 0,
          take: 5,
        }),
      );
    });

    it("calculates correct skip for first page", async () => {
      const { listPermissionsPaginated } = await import("~/services/permissions.server");
      mockPermissionFindMany.mockResolvedValue([]);
      mockPermissionCount.mockResolvedValue(0);

      await listPermissionsPaginated({ page: 1, pageSize: 20 });

      expect(mockPermissionFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getPermission
  // ---------------------------------------------------------------------------
  describe("getPermission", () => {
    it("returns a permission by id", async () => {
      const { getPermission } = await import("~/services/permissions.server");
      mockPermissionFindFirst.mockResolvedValue(mockPermission);

      const result = await getPermission("perm-1");

      expect(result).toEqual(mockPermission);
      expect(mockPermissionFindFirst).toHaveBeenCalledWith({
        where: { id: "perm-1" },
      });
    });

    it("throws PermissionError when not found", async () => {
      const { getPermission, PermissionError } = await import("~/services/permissions.server");
      mockPermissionFindFirst.mockResolvedValue(null);

      await expect(getPermission("nonexistent")).rejects.toThrow(PermissionError);
      await expect(getPermission("nonexistent")).rejects.toThrow("Permission not found");
    });

    it("throws with 404 status when not found", async () => {
      const { getPermission } = await import("~/services/permissions.server");
      mockPermissionFindFirst.mockResolvedValue(null);

      try {
        await getPermission("nonexistent");
        expect.unreachable("Should have thrown");
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // getPermissionWithCounts
  // ---------------------------------------------------------------------------
  describe("getPermissionWithCounts", () => {
    it("returns a permission with role counts and role details", async () => {
      const { getPermissionWithCounts } = await import("~/services/permissions.server");
      const permWithCounts = {
        ...mockPermission,
        _count: { rolePermissions: 3 },
        rolePermissions: [
          { role: { id: "role-1", name: "Admin" } },
          { role: { id: "role-2", name: "Editor" } },
          { role: { id: "role-3", name: "Viewer" } },
        ],
      };
      mockPermissionFindFirst.mockResolvedValue(permWithCounts);

      const result = await getPermissionWithCounts("perm-1");

      expect(result._count.rolePermissions).toBe(3);
      expect(result.rolePermissions).toHaveLength(3);
      expect(mockPermissionFindFirst).toHaveBeenCalledWith({
        where: { id: "perm-1" },
        include: {
          _count: { select: { rolePermissions: true } },
          rolePermissions: {
            include: { role: { select: { id: true, name: true } } },
          },
        },
      });
    });

    it("throws PermissionError when not found", async () => {
      const { getPermissionWithCounts, PermissionError } = await import(
        "~/services/permissions.server"
      );
      mockPermissionFindFirst.mockResolvedValue(null);

      await expect(getPermissionWithCounts("nonexistent")).rejects.toThrow(PermissionError);
      await expect(getPermissionWithCounts("nonexistent")).rejects.toThrow(
        "Permission not found",
      );
    });
  });

  // ---------------------------------------------------------------------------
  // createPermission
  // ---------------------------------------------------------------------------
  describe("createPermission", () => {
    it("creates a permission and logs an audit entry", async () => {
      const { createPermission } = await import("~/services/permissions.server");
      const created = { id: "perm-new", resource: "tenant", action: "write", description: null };
      mockPermissionCreate.mockResolvedValue(created);
      mockAuditLogCreate.mockResolvedValue({});

      const result = await createPermission(
        { resource: "tenant", action: "write" },
        mockCtx,
      );

      expect(result).toEqual(created);
      expect(mockPermissionCreate).toHaveBeenCalledWith({
        data: {
          resource: "tenant",
          action: "write",
          description: null,
        },
      });
      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: "tenant-1",
          userId: "user-1",
          action: "CREATE",
          entityType: "Permission",
          entityId: "perm-new",
          description: 'Created permission "tenant:write"',
          ipAddress: "127.0.0.1",
          userAgent: "vitest",
        }),
      });
    });

    it("creates a permission with a description", async () => {
      const { createPermission } = await import("~/services/permissions.server");
      const created = {
        id: "perm-new",
        resource: "user",
        action: "delete",
        description: "Delete users",
      };
      mockPermissionCreate.mockResolvedValue(created);
      mockAuditLogCreate.mockResolvedValue({});

      const result = await createPermission(
        { resource: "user", action: "delete", description: "Delete users" },
        mockCtx,
      );

      expect(result.description).toBe("Delete users");
      expect(mockPermissionCreate).toHaveBeenCalledWith({
        data: {
          resource: "user",
          action: "delete",
          description: "Delete users",
        },
      });
    });

    it("throws PermissionError on duplicate resource+action (P2002)", async () => {
      const { createPermission, PermissionError } = await import("~/services/permissions.server");
      const prismaError = new Error("Unique constraint failed");
      (prismaError as any).code = "P2002";
      mockPermissionCreate.mockRejectedValue(prismaError);

      await expect(
        createPermission({ resource: "user", action: "read" }, mockCtx),
      ).rejects.toThrow(PermissionError);
      await expect(
        createPermission({ resource: "user", action: "read" }, mockCtx),
      ).rejects.toThrow("A permission with this resource and action already exists");
    });

    it("throws PermissionError with 409 status on duplicate", async () => {
      const { createPermission } = await import("~/services/permissions.server");
      const prismaError = new Error("Unique constraint failed");
      (prismaError as any).code = "P2002";
      mockPermissionCreate.mockRejectedValue(prismaError);

      try {
        await createPermission({ resource: "user", action: "read" }, mockCtx);
        expect.unreachable("Should have thrown");
      } catch (error: any) {
        expect(error.status).toBe(409);
      }
    });

    it("re-throws non-P2002 errors", async () => {
      const { createPermission } = await import("~/services/permissions.server");
      const genericError = new Error("Connection lost");
      mockPermissionCreate.mockRejectedValue(genericError);

      await expect(
        createPermission({ resource: "user", action: "read" }, mockCtx),
      ).rejects.toThrow("Connection lost");
    });
  });

  // ---------------------------------------------------------------------------
  // updatePermission
  // ---------------------------------------------------------------------------
  describe("updatePermission", () => {
    it("updates a permission description and logs audit", async () => {
      const { updatePermission } = await import("~/services/permissions.server");
      const existing = { ...mockPermission, description: "Old description" };
      const updated = { ...mockPermission, description: "New description" };
      mockPermissionFindFirst.mockResolvedValue(existing);
      mockPermissionUpdate.mockResolvedValue(updated);
      mockAuditLogCreate.mockResolvedValue({});

      const result = await updatePermission("perm-1", { description: "New description" }, mockCtx);

      expect(result.description).toBe("New description");
      expect(mockPermissionUpdate).toHaveBeenCalledWith({
        where: { id: "perm-1" },
        data: { description: "New description" },
      });
      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "UPDATE",
          entityType: "Permission",
          entityId: "perm-1",
          metadata: {
            before: { description: "Old description" },
            after: { description: "New description" },
          },
        }),
      });
    });

    it("sets description to null when empty string is provided", async () => {
      const { updatePermission } = await import("~/services/permissions.server");
      mockPermissionFindFirst.mockResolvedValue(mockPermission);
      mockPermissionUpdate.mockResolvedValue({ ...mockPermission, description: null });
      mockAuditLogCreate.mockResolvedValue({});

      await updatePermission("perm-1", { description: "" }, mockCtx);

      expect(mockPermissionUpdate).toHaveBeenCalledWith({
        where: { id: "perm-1" },
        data: { description: null },
      });
    });

    it("throws PermissionError when permission not found", async () => {
      const { updatePermission, PermissionError } = await import("~/services/permissions.server");
      mockPermissionFindFirst.mockResolvedValue(null);

      await expect(
        updatePermission("nonexistent", { description: "Updated" }, mockCtx),
      ).rejects.toThrow(PermissionError);
      await expect(
        updatePermission("nonexistent", { description: "Updated" }, mockCtx),
      ).rejects.toThrow("Permission not found");
    });

    it("does not call update or audit when permission is not found", async () => {
      const { updatePermission } = await import("~/services/permissions.server");
      mockPermissionFindFirst.mockResolvedValue(null);

      await expect(
        updatePermission("nonexistent", { description: "Updated" }, mockCtx),
      ).rejects.toThrow();

      expect(mockPermissionUpdate).not.toHaveBeenCalled();
      expect(mockAuditLogCreate).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // deletePermission
  // ---------------------------------------------------------------------------
  describe("deletePermission", () => {
    it("deletes a permission with no role assignments and logs audit", async () => {
      const { deletePermission } = await import("~/services/permissions.server");
      const existing = {
        ...mockPermission,
        _count: { rolePermissions: 0 },
      };
      mockPermissionFindFirst.mockResolvedValue(existing);
      mockPermissionDelete.mockResolvedValue({});
      mockAuditLogCreate.mockResolvedValue({});

      await deletePermission("perm-1", mockCtx);

      expect(mockPermissionDelete).toHaveBeenCalledWith({ where: { id: "perm-1" } });
      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "DELETE",
          entityType: "Permission",
          entityId: "perm-1",
          description: 'Deleted permission "user:read"',
          metadata: { resource: "user", action: "read" },
        }),
      });
    });

    it("throws PermissionError when permission not found", async () => {
      const { deletePermission, PermissionError } = await import("~/services/permissions.server");
      mockPermissionFindFirst.mockResolvedValue(null);

      await expect(deletePermission("nonexistent", mockCtx)).rejects.toThrow(PermissionError);
      await expect(deletePermission("nonexistent", mockCtx)).rejects.toThrow(
        "Permission not found",
      );
    });

    it("throws PermissionError when permission is assigned to roles", async () => {
      const { deletePermission, PermissionError } = await import("~/services/permissions.server");
      mockPermissionFindFirst.mockResolvedValue({
        ...mockPermission,
        _count: { rolePermissions: 3 },
      });

      await expect(deletePermission("perm-1", mockCtx)).rejects.toThrow(PermissionError);
      await expect(deletePermission("perm-1", mockCtx)).rejects.toThrow(
        "Cannot delete permission assigned to 3 role(s). Unassign from all roles first.",
      );
    });

    it("throws with 409 status when assigned to roles", async () => {
      const { deletePermission } = await import("~/services/permissions.server");
      mockPermissionFindFirst.mockResolvedValue({
        ...mockPermission,
        _count: { rolePermissions: 1 },
      });

      try {
        await deletePermission("perm-1", mockCtx);
        expect.unreachable("Should have thrown");
      } catch (error: any) {
        expect(error.status).toBe(409);
      }
    });

    it("does not call delete or audit when permission is not found", async () => {
      const { deletePermission } = await import("~/services/permissions.server");
      mockPermissionFindFirst.mockResolvedValue(null);

      await expect(deletePermission("nonexistent", mockCtx)).rejects.toThrow();

      expect(mockPermissionDelete).not.toHaveBeenCalled();
      expect(mockAuditLogCreate).not.toHaveBeenCalled();
    });

    it("does not call delete when permission has role assignments", async () => {
      const { deletePermission } = await import("~/services/permissions.server");
      mockPermissionFindFirst.mockResolvedValue({
        ...mockPermission,
        _count: { rolePermissions: 5 },
      });

      await expect(deletePermission("perm-1", mockCtx)).rejects.toThrow();

      expect(mockPermissionDelete).not.toHaveBeenCalled();
      expect(mockAuditLogCreate).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // PermissionError
  // ---------------------------------------------------------------------------
  describe("PermissionError", () => {
    it("is an instance of ServiceError", async () => {
      const { PermissionError } = await import("~/services/permissions.server");
      const { ServiceError } = await import("~/lib/errors/service-error.server");

      const error = new PermissionError("test", 400);

      expect(error).toBeInstanceOf(ServiceError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("PermissionError");
      expect(error.message).toBe("test");
      expect(error.status).toBe(400);
    });
  });
});

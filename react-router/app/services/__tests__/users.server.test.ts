import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUserCreate = vi.fn();
const mockUserUpdate = vi.fn();
const mockUserFindFirst = vi.fn();
const mockUserFindMany = vi.fn();
const mockUserCount = vi.fn();
const mockAuditLogCreate = vi.fn();
const mockPasswordUpsert = vi.fn();
const mockUserRoleFindFirst = vi.fn();
const mockUserRoleFindMany = vi.fn();
const mockUserRoleDeleteMany = vi.fn();
const mockUserRoleCreateMany = vi.fn();
const mockRoleCount = vi.fn();
const mockHashPassword = vi.fn();

vi.mock("~/lib/db/db.server", () => ({
  prisma: {
    user: {
      create: (...args: unknown[]) => mockUserCreate(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
      findFirst: (...args: unknown[]) => mockUserFindFirst(...args),
      findMany: (...args: unknown[]) => mockUserFindMany(...args),
      count: (...args: unknown[]) => mockUserCount(...args),
    },
    auditLog: {
      create: (...args: unknown[]) => mockAuditLogCreate(...args),
    },
    password: {
      upsert: (...args: unknown[]) => mockPasswordUpsert(...args),
    },
    userRole: {
      findFirst: (...args: unknown[]) => mockUserRoleFindFirst(...args),
      findMany: (...args: unknown[]) => mockUserRoleFindMany(...args),
      deleteMany: (...args: unknown[]) => mockUserRoleDeleteMany(...args),
      createMany: (...args: unknown[]) => mockUserRoleCreateMany(...args),
    },
    role: {
      count: (...args: unknown[]) => mockRoleCount(...args),
    },
  },
}));

vi.mock("~/lib/auth/auth.server", () => ({
  hashPassword: (...args: unknown[]) => mockHashPassword(...args),
}));

vi.mock("~/lib/monitoring/logger.server", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const baseTenantCtx = {
  userId: "ctx-user-1",
  tenantId: "tenant-1",
  isSuperAdmin: false,
  ipAddress: "127.0.0.1",
  userAgent: "test-agent",
};

const superAdminCtx = {
  ...baseTenantCtx,
  userId: "admin-user-1",
  isSuperAdmin: true,
};

describe("users.server", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockHashPassword.mockResolvedValue("hashed-password-123");
  });

  // ---------------------------------------------------------------------------
  // listUsers
  // ---------------------------------------------------------------------------
  describe("listUsers", () => {
    it("lists users for a specific tenant", async () => {
      const { listUsers } = await import("../users.server");
      const mockUsers = [
        { id: "u-1", name: "Alice", email: "alice@example.com" },
        { id: "u-2", name: "Bob", email: "bob@example.com" },
      ];
      mockUserFindMany.mockResolvedValue(mockUsers);

      const result = await listUsers("tenant-1");

      expect(result).toHaveLength(2);
      expect(mockUserFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: "tenant-1", deletedAt: null }),
          orderBy: { name: "asc" },
        }),
      );
    });

    it("lists all users when no tenantId provided", async () => {
      const { listUsers } = await import("../users.server");
      mockUserFindMany.mockResolvedValue([]);

      await listUsers();

      expect(mockUserFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
        }),
      );
      const callArgs = mockUserFindMany.mock.calls[0][0];
      expect(callArgs.where.tenantId).toBeUndefined();
    });

    it("applies custom where and orderBy options", async () => {
      const { listUsers } = await import("../users.server");
      mockUserFindMany.mockResolvedValue([]);

      await listUsers("tenant-1", {
        where: { status: "ACTIVE" },
        orderBy: [{ email: "desc" }],
      });

      const callArgs = mockUserFindMany.mock.calls[0][0];
      expect(callArgs.where.status).toBe("ACTIVE");
      expect(callArgs.orderBy).toEqual([{ email: "desc" }]);
    });
  });

  // ---------------------------------------------------------------------------
  // listUsersPaginated
  // ---------------------------------------------------------------------------
  describe("listUsersPaginated", () => {
    it("returns paginated users with totalCount", async () => {
      const { listUsersPaginated } = await import("../users.server");
      const mockUsers = [{ id: "u-1", name: "Alice" }];
      mockUserFindMany.mockResolvedValue(mockUsers);
      mockUserCount.mockResolvedValue(25);

      const result = await listUsersPaginated("tenant-1", {
        page: 2,
        pageSize: 10,
      });

      expect(result.items).toEqual(mockUsers);
      expect(result.totalCount).toBe(25);
      expect(mockUserFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
    });

    it("applies default orderBy when none provided", async () => {
      const { listUsersPaginated } = await import("../users.server");
      mockUserFindMany.mockResolvedValue([]);
      mockUserCount.mockResolvedValue(0);

      await listUsersPaginated("tenant-1", { page: 1, pageSize: 10 });

      const callArgs = mockUserFindMany.mock.calls[0][0];
      expect(callArgs.orderBy).toEqual({ name: "asc" });
    });

    it("uses custom orderBy when provided", async () => {
      const { listUsersPaginated } = await import("../users.server");
      mockUserFindMany.mockResolvedValue([]);
      mockUserCount.mockResolvedValue(0);

      await listUsersPaginated("tenant-1", {
        page: 1,
        pageSize: 10,
        orderBy: [{ createdAt: "desc" }],
      });

      const callArgs = mockUserFindMany.mock.calls[0][0];
      expect(callArgs.orderBy).toEqual([{ createdAt: "desc" }]);
    });

    it("works without tenantId", async () => {
      const { listUsersPaginated } = await import("../users.server");
      mockUserFindMany.mockResolvedValue([]);
      mockUserCount.mockResolvedValue(0);

      await listUsersPaginated(undefined, { page: 1, pageSize: 10 });

      const callArgs = mockUserFindMany.mock.calls[0][0];
      expect(callArgs.where.tenantId).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // getUser
  // ---------------------------------------------------------------------------
  describe("getUser", () => {
    it("returns a user by id", async () => {
      const { getUser } = await import("../users.server");
      const mockUser = {
        id: "u-1",
        email: "alice@example.com",
        userRoles: [{ role: { name: "ADMIN" } }],
      };
      mockUserFindFirst.mockResolvedValue(mockUser);

      const result = await getUser("u-1");

      expect(result.id).toBe("u-1");
      expect(mockUserFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: "u-1", deletedAt: null }),
        }),
      );
    });

    it("returns a user scoped by tenantId", async () => {
      const { getUser } = await import("../users.server");
      mockUserFindFirst.mockResolvedValue({ id: "u-1" });

      await getUser("u-1", "tenant-1");

      const callArgs = mockUserFindFirst.mock.calls[0][0];
      expect(callArgs.where.tenantId).toBe("tenant-1");
    });

    it("throws UserError when user not found", async () => {
      const { getUser, UserError } = await import("../users.server");
      mockUserFindFirst.mockResolvedValue(null);

      await expect(getUser("missing-id")).rejects.toThrow(UserError);
      await expect(getUser("missing-id")).rejects.toThrow("User not found");
    });
  });

  // ---------------------------------------------------------------------------
  // getUserWithCounts
  // ---------------------------------------------------------------------------
  describe("getUserWithCounts", () => {
    it("returns a user with session and role counts", async () => {
      const { getUserWithCounts } = await import("../users.server");
      const mockUser = {
        id: "u-1",
        email: "alice@example.com",
        userRoles: [],
        _count: { sessions: 3, userRoles: 2 },
      };
      mockUserFindFirst.mockResolvedValue(mockUser);

      const result = await getUserWithCounts("u-1");

      expect(result._count.sessions).toBe(3);
      expect(result._count.userRoles).toBe(2);
    });

    it("scopes by tenantId when provided", async () => {
      const { getUserWithCounts } = await import("../users.server");
      mockUserFindFirst.mockResolvedValue({ id: "u-1", _count: { sessions: 0, userRoles: 0 } });

      await getUserWithCounts("u-1", "tenant-1");

      const callArgs = mockUserFindFirst.mock.calls[0][0];
      expect(callArgs.where.tenantId).toBe("tenant-1");
    });

    it("throws UserError when user not found", async () => {
      const { getUserWithCounts, UserError } = await import("../users.server");
      mockUserFindFirst.mockResolvedValue(null);

      await expect(getUserWithCounts("missing-id")).rejects.toThrow(UserError);
    });
  });

  // ---------------------------------------------------------------------------
  // createUser
  // ---------------------------------------------------------------------------
  describe("createUser", () => {
    it("creates a user with hashed password and audit log", async () => {
      const { createUser } = await import("../users.server");
      const createdUser = {
        id: "u-new",
        email: "new@example.com",
        username: "newuser",
        name: "New User",
      };
      mockUserCreate.mockResolvedValue(createdUser);
      mockAuditLogCreate.mockResolvedValue({});

      const result = await createUser(
        {
          email: "new@example.com",
          username: "newuser",
          name: "New User",
          password: "secret123",
        },
        baseTenantCtx,
      );

      expect(result.id).toBe("u-new");
      expect(mockUserCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: "new@example.com",
          username: "newuser",
          name: "New User",
          tenantId: "tenant-1",
          password: { create: { hash: "hashed-password-123" } },
        }),
      });
      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "CREATE",
          entityType: "User",
          entityId: "u-new",
          tenantId: "tenant-1",
          userId: "ctx-user-1",
        }),
      });
    });

    it("uses input.tenantId over ctx.tenantId when provided", async () => {
      const { createUser } = await import("../users.server");
      mockUserCreate.mockResolvedValue({
        id: "u-new",
        email: "new@example.com",
        username: "newuser",
      });
      mockAuditLogCreate.mockResolvedValue({});

      await createUser(
        {
          email: "new@example.com",
          username: "newuser",
          password: "secret123",
          tenantId: "other-tenant",
        },
        baseTenantCtx,
      );

      const callArgs = mockUserCreate.mock.calls[0][0];
      expect(callArgs.data.tenantId).toBe("other-tenant");
    });

    it("defaults status to ACTIVE", async () => {
      const { createUser } = await import("../users.server");
      mockUserCreate.mockResolvedValue({
        id: "u-new",
        email: "e@e.com",
        username: "u",
      });
      mockAuditLogCreate.mockResolvedValue({});

      await createUser(
        { email: "e@e.com", username: "u", password: "pw" },
        baseTenantCtx,
      );

      const callArgs = mockUserCreate.mock.calls[0][0];
      expect(callArgs.data.status).toBe("ACTIVE");
    });

    it("sets extras to empty object when not provided", async () => {
      const { createUser } = await import("../users.server");
      mockUserCreate.mockResolvedValue({
        id: "u-new",
        email: "e@e.com",
        username: "u",
      });
      mockAuditLogCreate.mockResolvedValue({});

      await createUser(
        { email: "e@e.com", username: "u", password: "pw" },
        baseTenantCtx,
      );

      const callArgs = mockUserCreate.mock.calls[0][0];
      expect(callArgs.data.extras).toEqual({});
    });

    it("throws UserError on duplicate email/username (P2002)", async () => {
      const { createUser, UserError } = await import("../users.server");
      const prismaError = new Error("Unique constraint failed");
      (prismaError as any).code = "P2002";
      mockUserCreate.mockRejectedValue(prismaError);

      await expect(
        createUser(
          { email: "dup@example.com", username: "dupuser", password: "pw" },
          baseTenantCtx,
        ),
      ).rejects.toThrow(UserError);

      await expect(
        createUser(
          { email: "dup@example.com", username: "dupuser", password: "pw" },
          baseTenantCtx,
        ),
      ).rejects.toThrow("A user with this email or username already exists");
    });

    it("rethrows non-P2002 errors", async () => {
      const { createUser, UserError } = await import("../users.server");
      const genericError = new Error("Connection lost");
      mockUserCreate.mockRejectedValue(genericError);

      await expect(
        createUser(
          { email: "e@e.com", username: "u", password: "pw" },
          baseTenantCtx,
        ),
      ).rejects.toThrow("Connection lost");

      // Should not be a UserError
      try {
        await createUser(
          { email: "e@e.com", username: "u", password: "pw" },
          baseTenantCtx,
        );
      } catch (error) {
        expect(error).not.toBeInstanceOf(UserError);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // updateUser
  // ---------------------------------------------------------------------------
  describe("updateUser", () => {
    it("updates a user and creates audit log", async () => {
      const { updateUser } = await import("../users.server");
      const existingUser = {
        id: "u-1",
        email: "old@example.com",
        username: "olduser",
        status: "ACTIVE",
      };
      const updatedUser = {
        id: "u-1",
        email: "new@example.com",
        username: "newuser",
        status: "ACTIVE",
      };
      mockUserFindFirst.mockResolvedValue(existingUser);
      mockUserUpdate.mockResolvedValue(updatedUser);
      mockAuditLogCreate.mockResolvedValue({});

      const result = await updateUser(
        "u-1",
        { email: "new@example.com", username: "newuser" },
        baseTenantCtx,
      );

      expect(result.email).toBe("new@example.com");
      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: "u-1" },
        data: expect.objectContaining({
          email: "new@example.com",
          username: "newuser",
        }),
      });
      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "UPDATE",
          entityType: "User",
          metadata: expect.objectContaining({
            before: expect.objectContaining({ email: "old@example.com" }),
            after: expect.objectContaining({ email: "new@example.com" }),
          }),
        }),
      });
    });

    it("scopes lookup by tenantId for non-superadmin", async () => {
      const { updateUser } = await import("../users.server");
      mockUserFindFirst.mockResolvedValue({
        id: "u-1",
        email: "e@e.com",
        username: "u",
        status: "ACTIVE",
      });
      mockUserUpdate.mockResolvedValue({ id: "u-1", email: "e@e.com", username: "u", status: "ACTIVE" });
      mockAuditLogCreate.mockResolvedValue({});

      await updateUser("u-1", { email: "e@e.com", username: "u" }, baseTenantCtx);

      const callArgs = mockUserFindFirst.mock.calls[0][0];
      expect(callArgs.where.tenantId).toBe("tenant-1");
    });

    it("skips tenantId scope for superadmin", async () => {
      const { updateUser } = await import("../users.server");
      mockUserFindFirst.mockResolvedValue({
        id: "u-1",
        email: "e@e.com",
        username: "u",
        status: "ACTIVE",
      });
      mockUserUpdate.mockResolvedValue({ id: "u-1", email: "e@e.com", username: "u", status: "ACTIVE" });
      mockAuditLogCreate.mockResolvedValue({});

      await updateUser("u-1", { email: "e@e.com", username: "u" }, superAdminCtx);

      const callArgs = mockUserFindFirst.mock.calls[0][0];
      expect(callArgs.where.tenantId).toBeUndefined();
    });

    it("throws UserError when user not found", async () => {
      const { updateUser, UserError } = await import("../users.server");
      mockUserFindFirst.mockResolvedValue(null);

      await expect(
        updateUser("missing-id", { email: "e@e.com", username: "u" }, baseTenantCtx),
      ).rejects.toThrow(UserError);
    });

    it("throws UserError on duplicate email/username (P2002)", async () => {
      const { updateUser, UserError } = await import("../users.server");
      mockUserFindFirst.mockResolvedValue({
        id: "u-1",
        email: "e@e.com",
        username: "u",
        status: "ACTIVE",
      });
      const prismaError = new Error("Unique constraint failed");
      (prismaError as any).code = "P2002";
      mockUserUpdate.mockRejectedValue(prismaError);

      await expect(
        updateUser("u-1", { email: "dup@example.com", username: "dupuser" }, baseTenantCtx),
      ).rejects.toThrow(UserError);
    });

    it("preserves existing status when none provided", async () => {
      const { updateUser } = await import("../users.server");
      mockUserFindFirst.mockResolvedValue({
        id: "u-1",
        email: "e@e.com",
        username: "u",
        status: "SUSPENDED",
      });
      mockUserUpdate.mockResolvedValue({
        id: "u-1",
        email: "e@e.com",
        username: "u",
        status: "SUSPENDED",
      });
      mockAuditLogCreate.mockResolvedValue({});

      await updateUser("u-1", { email: "e@e.com", username: "u" }, baseTenantCtx);

      const callArgs = mockUserUpdate.mock.calls[0][0];
      expect(callArgs.data.status).toBe("SUSPENDED");
    });
  });

  // ---------------------------------------------------------------------------
  // deleteUser
  // ---------------------------------------------------------------------------
  describe("deleteUser", () => {
    it("soft-deletes a user and creates audit log", async () => {
      const { deleteUser } = await import("../users.server");
      mockUserFindFirst.mockResolvedValue({
        id: "u-1",
        email: "alice@example.com",
        username: "alice",
        _count: { sessions: 0, userRoles: 1 },
      });
      mockUserRoleFindFirst.mockResolvedValue(null);
      mockUserUpdate.mockResolvedValue({});
      mockAuditLogCreate.mockResolvedValue({});

      await deleteUser("u-1", baseTenantCtx);

      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: "u-1" },
        data: { deletedAt: expect.any(Date) },
      });
      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "DELETE",
          entityType: "User",
          entityId: "u-1",
        }),
      });
    });

    it("throws UserError when user not found", async () => {
      const { deleteUser, UserError } = await import("../users.server");
      mockUserFindFirst.mockResolvedValue(null);

      await expect(deleteUser("missing-id", baseTenantCtx)).rejects.toThrow(UserError);
      await expect(deleteUser("missing-id", baseTenantCtx)).rejects.toThrow("User not found");
    });

    it("throws UserError when trying to delete own account", async () => {
      const { deleteUser, UserError } = await import("../users.server");
      mockUserFindFirst.mockResolvedValue({
        id: "ctx-user-1",
        email: "me@example.com",
        username: "me",
        _count: { sessions: 1, userRoles: 1 },
      });

      await expect(deleteUser("ctx-user-1", baseTenantCtx)).rejects.toThrow(UserError);
      await expect(deleteUser("ctx-user-1", baseTenantCtx)).rejects.toThrow(
        "You cannot delete your own account",
      );
    });

    it("throws UserError when user has a global role", async () => {
      const { deleteUser, UserError } = await import("../users.server");
      mockUserFindFirst.mockResolvedValue({
        id: "u-global",
        email: "admin@example.com",
        username: "admin",
        _count: { sessions: 0, userRoles: 1 },
      });
      mockUserRoleFindFirst.mockResolvedValue({
        role: { name: "SUPER_ADMIN" },
      });

      await expect(deleteUser("u-global", baseTenantCtx)).rejects.toThrow(UserError);
      await expect(deleteUser("u-global", baseTenantCtx)).rejects.toThrow(
        'Cannot delete a system administrator. Remove the "SUPER_ADMIN" role first.',
      );
    });

    it("scopes lookup by tenantId for non-superadmin", async () => {
      const { deleteUser } = await import("../users.server");
      mockUserFindFirst.mockResolvedValue({
        id: "u-1",
        email: "e@e.com",
        username: "u",
        _count: { sessions: 0, userRoles: 0 },
      });
      mockUserRoleFindFirst.mockResolvedValue(null);
      mockUserUpdate.mockResolvedValue({});
      mockAuditLogCreate.mockResolvedValue({});

      await deleteUser("u-1", baseTenantCtx);

      const callArgs = mockUserFindFirst.mock.calls[0][0];
      expect(callArgs.where.tenantId).toBe("tenant-1");
    });

    it("skips tenantId scope for superadmin", async () => {
      const { deleteUser } = await import("../users.server");
      mockUserFindFirst.mockResolvedValue({
        id: "u-1",
        email: "e@e.com",
        username: "u",
        _count: { sessions: 0, userRoles: 0 },
      });
      mockUserRoleFindFirst.mockResolvedValue(null);
      mockUserUpdate.mockResolvedValue({});
      mockAuditLogCreate.mockResolvedValue({});

      await deleteUser("u-1", superAdminCtx);

      const callArgs = mockUserFindFirst.mock.calls[0][0];
      expect(callArgs.where.tenantId).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // changePassword
  // ---------------------------------------------------------------------------
  describe("changePassword", () => {
    it("upserts the password hash and creates audit log", async () => {
      const { changePassword } = await import("../users.server");
      mockUserFindFirst.mockResolvedValue({
        id: "u-1",
        email: "alice@example.com",
      });
      mockPasswordUpsert.mockResolvedValue({});
      mockAuditLogCreate.mockResolvedValue({});

      await changePassword("u-1", "newpassword", baseTenantCtx);

      expect(mockPasswordUpsert).toHaveBeenCalledWith({
        where: { userId: "u-1" },
        update: { hash: "hashed-password-123" },
        create: { userId: "u-1", hash: "hashed-password-123" },
      });
      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "UPDATE",
          entityType: "User",
          entityId: "u-1",
          description: expect.stringContaining("Changed password"),
        }),
      });
    });

    it("throws UserError when user not found", async () => {
      const { changePassword, UserError } = await import("../users.server");
      mockUserFindFirst.mockResolvedValue(null);

      await expect(changePassword("missing-id", "pw", baseTenantCtx)).rejects.toThrow(UserError);
      await expect(changePassword("missing-id", "pw", baseTenantCtx)).rejects.toThrow(
        "User not found",
      );
    });

    it("scopes lookup by tenantId for non-superadmin", async () => {
      const { changePassword } = await import("../users.server");
      mockUserFindFirst.mockResolvedValue({ id: "u-1", email: "e@e.com" });
      mockPasswordUpsert.mockResolvedValue({});
      mockAuditLogCreate.mockResolvedValue({});

      await changePassword("u-1", "pw", baseTenantCtx);

      const callArgs = mockUserFindFirst.mock.calls[0][0];
      expect(callArgs.where.tenantId).toBe("tenant-1");
    });

    it("skips tenantId scope for superadmin", async () => {
      const { changePassword } = await import("../users.server");
      mockUserFindFirst.mockResolvedValue({ id: "u-1", email: "e@e.com" });
      mockPasswordUpsert.mockResolvedValue({});
      mockAuditLogCreate.mockResolvedValue({});

      await changePassword("u-1", "pw", superAdminCtx);

      const callArgs = mockUserFindFirst.mock.calls[0][0];
      expect(callArgs.where.tenantId).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // assignRoles
  // ---------------------------------------------------------------------------
  describe("assignRoles", () => {
    it("replaces existing roles with new ones and creates audit log", async () => {
      const { assignRoles } = await import("../users.server");
      mockUserFindFirst.mockResolvedValue({
        id: "u-1",
        email: "alice@example.com",
      });
      mockRoleCount.mockResolvedValue(2);
      mockUserRoleDeleteMany.mockResolvedValue({ count: 1 });
      mockUserRoleCreateMany.mockResolvedValue({ count: 2 });
      mockAuditLogCreate.mockResolvedValue({});

      await assignRoles("u-1", ["role-1", "role-2"], baseTenantCtx);

      expect(mockUserRoleDeleteMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: "u-1",
          eventId: null,
          role: { tenantId: "tenant-1" },
        }),
      });
      expect(mockUserRoleCreateMany).toHaveBeenCalledWith({
        data: [
          { userId: "u-1", roleId: "role-1", eventId: null },
          { userId: "u-1", roleId: "role-2", eventId: null },
        ],
        skipDuplicates: true,
      });
      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "UPDATE",
          entityType: "User",
          metadata: { roleIds: ["role-1", "role-2"] },
        }),
      });
    });

    it("clears all roles when empty array provided", async () => {
      const { assignRoles } = await import("../users.server");
      mockUserFindFirst.mockResolvedValue({
        id: "u-1",
        email: "alice@example.com",
      });
      mockUserRoleDeleteMany.mockResolvedValue({ count: 1 });
      mockAuditLogCreate.mockResolvedValue({});

      await assignRoles("u-1", [], baseTenantCtx);

      expect(mockUserRoleDeleteMany).toHaveBeenCalled();
      expect(mockUserRoleCreateMany).not.toHaveBeenCalled();
    });

    it("throws UserError when user not found", async () => {
      const { assignRoles, UserError } = await import("../users.server");
      mockUserFindFirst.mockResolvedValue(null);

      await expect(assignRoles("missing-id", ["role-1"], baseTenantCtx)).rejects.toThrow(UserError);
      await expect(assignRoles("missing-id", ["role-1"], baseTenantCtx)).rejects.toThrow(
        "User not found",
      );
    });

    it("throws UserError when roles do not belong to tenant", async () => {
      const { assignRoles, UserError } = await import("../users.server");
      mockUserFindFirst.mockResolvedValue({
        id: "u-1",
        email: "alice@example.com",
      });
      // Only 1 role found instead of 2
      mockRoleCount.mockResolvedValue(1);

      await expect(
        assignRoles("u-1", ["role-1", "invalid-role"], baseTenantCtx),
      ).rejects.toThrow(UserError);
      await expect(
        assignRoles("u-1", ["role-1", "invalid-role"], baseTenantCtx),
      ).rejects.toThrow("One or more roles do not belong to this tenant");
    });

    it("skips role validation for superadmin", async () => {
      const { assignRoles } = await import("../users.server");
      mockUserFindFirst.mockResolvedValue({
        id: "u-1",
        email: "alice@example.com",
      });
      mockUserRoleDeleteMany.mockResolvedValue({ count: 0 });
      mockUserRoleCreateMany.mockResolvedValue({ count: 1 });
      mockAuditLogCreate.mockResolvedValue({});

      await assignRoles("u-1", ["any-role"], superAdminCtx);

      // roleCount should NOT be called for superadmin
      expect(mockRoleCount).not.toHaveBeenCalled();
    });

    it("skips tenantId scope on deleteMany for superadmin", async () => {
      const { assignRoles } = await import("../users.server");
      mockUserFindFirst.mockResolvedValue({
        id: "u-1",
        email: "alice@example.com",
      });
      mockUserRoleDeleteMany.mockResolvedValue({ count: 0 });
      mockUserRoleCreateMany.mockResolvedValue({ count: 1 });
      mockAuditLogCreate.mockResolvedValue({});

      await assignRoles("u-1", ["role-1"], superAdminCtx);

      const deleteCallArgs = mockUserRoleDeleteMany.mock.calls[0][0];
      expect(deleteCallArgs.where.role).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // getUserRoles
  // ---------------------------------------------------------------------------
  describe("getUserRoles", () => {
    it("returns user roles excluding event-scoped ones", async () => {
      const { getUserRoles } = await import("../users.server");
      const mockRoles = [
        { userId: "u-1", roleId: "r-1", role: { name: "ADMIN" } },
        { userId: "u-1", roleId: "r-2", role: { name: "VIEWER" } },
      ];
      mockUserRoleFindMany.mockResolvedValue(mockRoles);

      const result = await getUserRoles("u-1");

      expect(result).toHaveLength(2);
      expect(mockUserRoleFindMany).toHaveBeenCalledWith({
        where: { userId: "u-1", eventId: null },
        include: { role: true },
      });
    });
  });
});

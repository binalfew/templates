import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSystemSettingFindUnique = vi.fn();
const mockUserRoleCount = vi.fn();
const mockVerificationFindUnique = vi.fn();
const mockVerificationDeleteMany = vi.fn();
const mockAuditLogCreate = vi.fn();

vi.mock("~/utils/db/db.server", () => ({
  prisma: {
    systemSetting: {
      findUnique: (...args: unknown[]) => mockSystemSettingFindUnique(...args),
    },
    userRole: {
      count: (...args: unknown[]) => mockUserRoleCount(...args),
    },
    verification: {
      findUnique: (...args: unknown[]) => mockVerificationFindUnique(...args),
      deleteMany: (...args: unknown[]) => mockVerificationDeleteMany(...args),
    },
    auditLog: {
      create: (...args: unknown[]) => mockAuditLogCreate(...args),
    },
  },
}));

vi.mock("~/utils/monitoring/logger.server", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const CTX = {
  userId: "admin-1",
  tenantId: "tenant-1",
  ipAddress: "127.0.0.1",
  userAgent: "test-agent",
};

describe("2fa-enforcement.server", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ─── getTwoFAPolicy ────────────────────────────────────

  describe("getTwoFAPolicy", () => {
    it("returns mode 'off' when no setting exists", async () => {
      const { getTwoFAPolicy } = await import("~/services/2fa-enforcement.server");
      mockSystemSettingFindUnique.mockResolvedValue(null);

      const policy = await getTwoFAPolicy("tenant-1");

      expect(policy).toEqual({ mode: "off", roleIds: [] });
      expect(mockSystemSettingFindUnique).toHaveBeenCalledWith({
        where: {
          key_scope_scopeId: {
            key: "security.require2fa",
            scope: "tenant",
            scopeId: "tenant-1",
          },
        },
      });
    });

    it("returns mode 'all' when setting value is 'all'", async () => {
      const { getTwoFAPolicy } = await import("~/services/2fa-enforcement.server");
      mockSystemSettingFindUnique.mockResolvedValue({
        key: "security.require2fa",
        value: "all",
        scope: "tenant",
        scopeId: "tenant-1",
      });

      const policy = await getTwoFAPolicy("tenant-1");

      expect(policy).toEqual({ mode: "all", roleIds: [] });
    });

    it("returns mode 'roles' with parsed role IDs when value starts with 'roles:'", async () => {
      const { getTwoFAPolicy } = await import("~/services/2fa-enforcement.server");
      mockSystemSettingFindUnique.mockResolvedValue({
        key: "security.require2fa",
        value: "roles:role-1,role-2,role-3",
        scope: "tenant",
        scopeId: "tenant-1",
      });

      const policy = await getTwoFAPolicy("tenant-1");

      expect(policy).toEqual({
        mode: "roles",
        roleIds: ["role-1", "role-2", "role-3"],
      });
    });

    it("trims whitespace from role IDs", async () => {
      const { getTwoFAPolicy } = await import("~/services/2fa-enforcement.server");
      mockSystemSettingFindUnique.mockResolvedValue({
        key: "security.require2fa",
        value: "roles: role-1 , role-2 , role-3 ",
        scope: "tenant",
        scopeId: "tenant-1",
      });

      const policy = await getTwoFAPolicy("tenant-1");

      expect(policy.roleIds).toEqual(["role-1", "role-2", "role-3"]);
    });

    it("filters out empty role IDs from trailing commas", async () => {
      const { getTwoFAPolicy } = await import("~/services/2fa-enforcement.server");
      mockSystemSettingFindUnique.mockResolvedValue({
        key: "security.require2fa",
        value: "roles:role-1,,role-2,",
        scope: "tenant",
        scopeId: "tenant-1",
      });

      const policy = await getTwoFAPolicy("tenant-1");

      expect(policy.roleIds).toEqual(["role-1", "role-2"]);
    });

    it("returns mode 'off' for unrecognized setting value", async () => {
      const { getTwoFAPolicy } = await import("~/services/2fa-enforcement.server");
      mockSystemSettingFindUnique.mockResolvedValue({
        key: "security.require2fa",
        value: "something-unknown",
        scope: "tenant",
        scopeId: "tenant-1",
      });

      const policy = await getTwoFAPolicy("tenant-1");

      expect(policy).toEqual({ mode: "off", roleIds: [] });
    });

    it("returns mode 'roles' with empty array for 'roles:' with no IDs", async () => {
      const { getTwoFAPolicy } = await import("~/services/2fa-enforcement.server");
      mockSystemSettingFindUnique.mockResolvedValue({
        key: "security.require2fa",
        value: "roles:",
        scope: "tenant",
        scopeId: "tenant-1",
      });

      const policy = await getTwoFAPolicy("tenant-1");

      expect(policy).toEqual({ mode: "roles", roleIds: [] });
    });
  });

  // ─── isUserRequired2FA ─────────────────────────────────

  describe("isUserRequired2FA", () => {
    it("returns false when policy mode is 'off'", async () => {
      const { isUserRequired2FA } = await import("~/services/2fa-enforcement.server");
      mockSystemSettingFindUnique.mockResolvedValue(null);

      const result = await isUserRequired2FA("user-1", "tenant-1");

      expect(result).toBe(false);
      expect(mockUserRoleCount).not.toHaveBeenCalled();
    });

    it("returns true when policy mode is 'all'", async () => {
      const { isUserRequired2FA } = await import("~/services/2fa-enforcement.server");
      mockSystemSettingFindUnique.mockResolvedValue({
        key: "security.require2fa",
        value: "all",
        scope: "tenant",
        scopeId: "tenant-1",
      });

      const result = await isUserRequired2FA("user-1", "tenant-1");

      expect(result).toBe(true);
      expect(mockUserRoleCount).not.toHaveBeenCalled();
    });

    it("returns true when user has a matching role in 'roles' mode", async () => {
      const { isUserRequired2FA } = await import("~/services/2fa-enforcement.server");
      mockSystemSettingFindUnique.mockResolvedValue({
        key: "security.require2fa",
        value: "roles:role-admin,role-manager",
        scope: "tenant",
        scopeId: "tenant-1",
      });
      mockUserRoleCount.mockResolvedValue(1);

      const result = await isUserRequired2FA("user-1", "tenant-1");

      expect(result).toBe(true);
      expect(mockUserRoleCount).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          roleId: { in: ["role-admin", "role-manager"] },
        },
      });
    });

    it("returns false when user has no matching roles in 'roles' mode", async () => {
      const { isUserRequired2FA } = await import("~/services/2fa-enforcement.server");
      mockSystemSettingFindUnique.mockResolvedValue({
        key: "security.require2fa",
        value: "roles:role-admin,role-manager",
        scope: "tenant",
        scopeId: "tenant-1",
      });
      mockUserRoleCount.mockResolvedValue(0);

      const result = await isUserRequired2FA("user-1", "tenant-1");

      expect(result).toBe(false);
    });

    it("returns false when 'roles' mode has empty roleIds list", async () => {
      const { isUserRequired2FA } = await import("~/services/2fa-enforcement.server");
      mockSystemSettingFindUnique.mockResolvedValue({
        key: "security.require2fa",
        value: "roles:",
        scope: "tenant",
        scopeId: "tenant-1",
      });

      const result = await isUserRequired2FA("user-1", "tenant-1");

      expect(result).toBe(false);
      // Should short-circuit and not query userRole at all
      expect(mockUserRoleCount).not.toHaveBeenCalled();
    });
  });

  // ─── hasUserSetUp2FA ───────────────────────────────────

  describe("hasUserSetUp2FA", () => {
    it("returns true when user has a 2FA verification record", async () => {
      const { hasUserSetUp2FA } = await import("~/services/2fa-enforcement.server");
      mockVerificationFindUnique.mockResolvedValue({ id: "ver-1" });

      const result = await hasUserSetUp2FA("user-1");

      expect(result).toBe(true);
      expect(mockVerificationFindUnique).toHaveBeenCalledWith({
        select: { id: true },
        where: {
          target_type: {
            target: "user-1",
            type: "2fa",
          },
        },
      });
    });

    it("returns false when user has no 2FA verification record", async () => {
      const { hasUserSetUp2FA } = await import("~/services/2fa-enforcement.server");
      mockVerificationFindUnique.mockResolvedValue(null);

      const result = await hasUserSetUp2FA("user-1");

      expect(result).toBe(false);
    });
  });

  // ─── resetUserTwoFA ────────────────────────────────────

  describe("resetUserTwoFA", () => {
    it("deletes verification records and creates audit log when records exist", async () => {
      const { resetUserTwoFA } = await import("~/services/2fa-enforcement.server");
      mockVerificationDeleteMany.mockResolvedValue({ count: 1 });
      mockAuditLogCreate.mockResolvedValue({});

      await resetUserTwoFA("user-target", CTX);

      expect(mockVerificationDeleteMany).toHaveBeenCalledWith({
        where: {
          target: "user-target",
          type: "2fa",
        },
      });
      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: {
          userId: "admin-1",
          tenantId: "tenant-1",
          action: "TWO_FACTOR_DISABLE",
          entityType: "User",
          entityId: "user-target",
          description: "Admin reset 2FA for user user-target",
          ipAddress: "127.0.0.1",
          userAgent: "test-agent",
          metadata: { resetBy: "admin-1", targetUserId: "user-target" },
        },
      });
    });

    it("does not create audit log when no verification records were deleted", async () => {
      const { resetUserTwoFA } = await import("~/services/2fa-enforcement.server");
      mockVerificationDeleteMany.mockResolvedValue({ count: 0 });

      await resetUserTwoFA("user-target", CTX);

      expect(mockVerificationDeleteMany).toHaveBeenCalledTimes(1);
      expect(mockAuditLogCreate).not.toHaveBeenCalled();
    });

    it("logs the admin action when records are deleted", async () => {
      const { logger } = await import("~/utils/monitoring/logger.server");
      const { resetUserTwoFA } = await import("~/services/2fa-enforcement.server");
      mockVerificationDeleteMany.mockResolvedValue({ count: 2 });
      mockAuditLogCreate.mockResolvedValue({});

      await resetUserTwoFA("user-target", CTX);

      expect(logger.info).toHaveBeenCalledWith(
        { userId: "user-target", adminId: "admin-1" },
        "Admin reset user 2FA",
      );
    });

    it("does not log when no records are deleted", async () => {
      const { logger } = await import("~/utils/monitoring/logger.server");
      const { resetUserTwoFA } = await import("~/services/2fa-enforcement.server");
      mockVerificationDeleteMany.mockResolvedValue({ count: 0 });

      await resetUserTwoFA("user-target", CTX);

      expect(logger.info).not.toHaveBeenCalled();
    });

    it("uses the correct service context fields in audit log", async () => {
      const { resetUserTwoFA } = await import("~/services/2fa-enforcement.server");
      mockVerificationDeleteMany.mockResolvedValue({ count: 1 });
      mockAuditLogCreate.mockResolvedValue({});

      const customCtx = {
        userId: "super-admin-99",
        tenantId: "tenant-xyz",
        ipAddress: "192.168.1.100",
        userAgent: "Mozilla/5.0",
      };

      await resetUserTwoFA("user-456", customCtx);

      const auditData = mockAuditLogCreate.mock.calls[0][0].data;
      expect(auditData.userId).toBe("super-admin-99");
      expect(auditData.tenantId).toBe("tenant-xyz");
      expect(auditData.ipAddress).toBe("192.168.1.100");
      expect(auditData.userAgent).toBe("Mozilla/5.0");
      expect(auditData.metadata.resetBy).toBe("super-admin-99");
      expect(auditData.metadata.targetUserId).toBe("user-456");
    });
  });
});

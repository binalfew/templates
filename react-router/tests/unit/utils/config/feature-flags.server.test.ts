import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFeatureFlagFindUnique = vi.fn();
const mockFeatureFlagFindMany = vi.fn();
const mockFeatureFlagUpdate = vi.fn();
const mockAuditLogCreate = vi.fn();

vi.mock("~/utils/db/db.server", () => ({
  prisma: {
    featureFlag: {
      findUnique: (...args: unknown[]) => mockFeatureFlagFindUnique(...args),
      findMany: (...args: unknown[]) => mockFeatureFlagFindMany(...args),
      update: (...args: unknown[]) => mockFeatureFlagUpdate(...args),
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
  userId: "user-1",
  tenantId: "tenant-1",
  ipAddress: "127.0.0.1",
  userAgent: "test-agent",
};

function makeFlag(overrides: Partial<{
  id: string;
  key: string;
  description: string | null;
  enabled: boolean;
  enabledForTenants: string[];
  enabledForRoles: string[];
  enabledForUsers: string[];
  createdAt: Date;
  updatedAt: Date;
}> = {}) {
  return {
    id: overrides.id ?? "flag-1",
    key: overrides.key ?? "FF_TEST",
    description: overrides.description ?? "A test flag",
    enabled: overrides.enabled ?? false,
    enabledForTenants: overrides.enabledForTenants ?? [],
    enabledForRoles: overrides.enabledForRoles ?? [],
    enabledForUsers: overrides.enabledForUsers ?? [],
    createdAt: overrides.createdAt ?? new Date("2026-01-01"),
    updatedAt: overrides.updatedAt ?? new Date("2026-01-01"),
  };
}

describe("feature-flags.server", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAuditLogCreate.mockResolvedValue({});
  });

  describe("FEATURE_FLAG_KEYS", () => {
    it("exports a frozen map of all expected feature flag keys", async () => {
      const { FEATURE_FLAG_KEYS } = await import("~/utils/config/feature-flags.server");

      expect(FEATURE_FLAG_KEYS.SSE_UPDATES).toBe("FF_SSE_UPDATES");
      expect(FEATURE_FLAG_KEYS.ANALYTICS).toBe("FF_ANALYTICS");
      expect(FEATURE_FLAG_KEYS.PWA).toBe("FF_PWA");
      expect(FEATURE_FLAG_KEYS.WEBHOOKS).toBe("FF_WEBHOOKS");
      expect(FEATURE_FLAG_KEYS.SAVED_VIEWS).toBe("FF_SAVED_VIEWS");
      expect(FEATURE_FLAG_KEYS.CUSTOM_FIELDS).toBe("FF_CUSTOM_FIELDS");
      expect(FEATURE_FLAG_KEYS.BROADCASTS).toBe("FF_BROADCASTS");
      expect(FEATURE_FLAG_KEYS.GLOBAL_SEARCH).toBe("FF_GLOBAL_SEARCH");
      expect(FEATURE_FLAG_KEYS.CUSTOM_OBJECTS).toBe("FF_CUSTOM_OBJECTS");
      expect(FEATURE_FLAG_KEYS.FORM_DESIGNER).toBe("FF_FORM_DESIGNER");
      expect(FEATURE_FLAG_KEYS.TWO_FACTOR).toBe("FF_TWO_FACTOR");
      expect(FEATURE_FLAG_KEYS.INVITATIONS).toBe("FF_INVITATIONS");
      expect(FEATURE_FLAG_KEYS.DATA_IMPORT_EXPORT).toBe("FF_DATA_IMPORT_EXPORT");
      expect(FEATURE_FLAG_KEYS.I18N).toBe("FF_I18N");
      expect(FEATURE_FLAG_KEYS.OFFLINE_MODE).toBe("FF_OFFLINE_MODE");
      expect(FEATURE_FLAG_KEYS.NOTIFICATIONS).toBe("FF_NOTIFICATIONS");
      expect(FEATURE_FLAG_KEYS.KEYBOARD_SHORTCUTS).toBe("FF_KEYBOARD_SHORTCUTS");
      expect(FEATURE_FLAG_KEYS.REST_API).toBe("FF_REST_API");
    });
  });

  describe("isFeatureEnabled", () => {
    it("returns false when the flag does not exist in the database", async () => {
      mockFeatureFlagFindUnique.mockResolvedValue(null);
      const { isFeatureEnabled } = await import("~/utils/config/feature-flags.server");

      const result = await isFeatureEnabled("FF_NONEXISTENT");

      expect(result).toBe(false);
      expect(mockFeatureFlagFindUnique).toHaveBeenCalledWith({
        where: { key: "FF_NONEXISTENT" },
      });
    });

    it("returns true when the flag is globally enabled", async () => {
      mockFeatureFlagFindUnique.mockResolvedValue(makeFlag({ enabled: true }));
      const { isFeatureEnabled } = await import("~/utils/config/feature-flags.server");

      const result = await isFeatureEnabled("FF_TEST");

      expect(result).toBe(true);
    });

    it("returns true when the flag is globally enabled even without context", async () => {
      mockFeatureFlagFindUnique.mockResolvedValue(makeFlag({ enabled: true }));
      const { isFeatureEnabled } = await import("~/utils/config/feature-flags.server");

      const result = await isFeatureEnabled("FF_TEST");

      expect(result).toBe(true);
    });

    it("returns false when flag is disabled and no context is provided", async () => {
      mockFeatureFlagFindUnique.mockResolvedValue(makeFlag({ enabled: false }));
      const { isFeatureEnabled } = await import("~/utils/config/feature-flags.server");

      const result = await isFeatureEnabled("FF_TEST");

      expect(result).toBe(false);
    });

    it("returns true when tenant is in enabledForTenants list", async () => {
      mockFeatureFlagFindUnique.mockResolvedValue(
        makeFlag({
          enabled: false,
          enabledForTenants: ["tenant-1", "tenant-2"],
        }),
      );
      const { isFeatureEnabled } = await import("~/utils/config/feature-flags.server");

      const result = await isFeatureEnabled("FF_TEST", { tenantId: "tenant-1" });

      expect(result).toBe(true);
    });

    it("returns false when tenant is not in enabledForTenants list", async () => {
      mockFeatureFlagFindUnique.mockResolvedValue(
        makeFlag({
          enabled: false,
          enabledForTenants: ["tenant-2", "tenant-3"],
        }),
      );
      const { isFeatureEnabled } = await import("~/utils/config/feature-flags.server");

      const result = await isFeatureEnabled("FF_TEST", { tenantId: "tenant-1" });

      expect(result).toBe(false);
    });

    it("returns true when one of user roles is in enabledForRoles list", async () => {
      mockFeatureFlagFindUnique.mockResolvedValue(
        makeFlag({
          enabled: false,
          enabledForRoles: ["ADMIN", "MANAGER"],
        }),
      );
      const { isFeatureEnabled } = await import("~/utils/config/feature-flags.server");

      const result = await isFeatureEnabled("FF_TEST", { roles: ["USER", "ADMIN"] });

      expect(result).toBe(true);
    });

    it("returns false when none of user roles is in enabledForRoles list", async () => {
      mockFeatureFlagFindUnique.mockResolvedValue(
        makeFlag({
          enabled: false,
          enabledForRoles: ["ADMIN", "MANAGER"],
        }),
      );
      const { isFeatureEnabled } = await import("~/utils/config/feature-flags.server");

      const result = await isFeatureEnabled("FF_TEST", { roles: ["USER", "VIEWER"] });

      expect(result).toBe(false);
    });

    it("returns true when userId is in enabledForUsers list", async () => {
      mockFeatureFlagFindUnique.mockResolvedValue(
        makeFlag({
          enabled: false,
          enabledForUsers: ["user-42", "user-99"],
        }),
      );
      const { isFeatureEnabled } = await import("~/utils/config/feature-flags.server");

      const result = await isFeatureEnabled("FF_TEST", { userId: "user-42" });

      expect(result).toBe(true);
    });

    it("returns false when userId is not in enabledForUsers list", async () => {
      mockFeatureFlagFindUnique.mockResolvedValue(
        makeFlag({
          enabled: false,
          enabledForUsers: ["user-42", "user-99"],
        }),
      );
      const { isFeatureEnabled } = await import("~/utils/config/feature-flags.server");

      const result = await isFeatureEnabled("FF_TEST", { userId: "user-1" });

      expect(result).toBe(false);
    });

    it("returns false when context is provided but empty (no tenant, roles, user)", async () => {
      mockFeatureFlagFindUnique.mockResolvedValue(
        makeFlag({
          enabled: false,
          enabledForTenants: ["tenant-1"],
          enabledForRoles: ["ADMIN"],
          enabledForUsers: ["user-1"],
        }),
      );
      const { isFeatureEnabled } = await import("~/utils/config/feature-flags.server");

      const result = await isFeatureEnabled("FF_TEST", {});

      expect(result).toBe(false);
    });

    it("evaluates tenant before roles (short-circuit on tenant match)", async () => {
      mockFeatureFlagFindUnique.mockResolvedValue(
        makeFlag({
          enabled: false,
          enabledForTenants: ["tenant-1"],
          enabledForRoles: [],
          enabledForUsers: [],
        }),
      );
      const { isFeatureEnabled } = await import("~/utils/config/feature-flags.server");

      const result = await isFeatureEnabled("FF_TEST", {
        tenantId: "tenant-1",
        roles: ["NONEXISTENT"],
        userId: "nonexistent-user",
      });

      expect(result).toBe(true);
    });

    it("globally enabled flag returns true even with non-matching context", async () => {
      mockFeatureFlagFindUnique.mockResolvedValue(
        makeFlag({
          enabled: true,
          enabledForTenants: [],
          enabledForRoles: [],
          enabledForUsers: [],
        }),
      );
      const { isFeatureEnabled } = await import("~/utils/config/feature-flags.server");

      const result = await isFeatureEnabled("FF_TEST", {
        tenantId: "other-tenant",
        roles: ["VIEWER"],
        userId: "other-user",
      });

      expect(result).toBe(true);
    });
  });

  describe("getAllFlags", () => {
    it("returns all flags with isEnabled status computed from context", async () => {
      mockFeatureFlagFindMany.mockResolvedValue([
        makeFlag({ id: "f1", key: "FF_A", enabled: true }),
        makeFlag({ id: "f2", key: "FF_B", enabled: false, enabledForTenants: ["tenant-1"] }),
        makeFlag({ id: "f3", key: "FF_C", enabled: false }),
      ]);
      const { getAllFlags } = await import("~/utils/config/feature-flags.server");

      const result = await getAllFlags({ tenantId: "tenant-1" });

      expect(result).toHaveLength(3);
      expect(result[0].key).toBe("FF_A");
      expect(result[0].isEnabled).toBe(true);
      expect(result[1].key).toBe("FF_B");
      expect(result[1].isEnabled).toBe(true);
      expect(result[2].key).toBe("FF_C");
      expect(result[2].isEnabled).toBe(false);
    });

    it("returns all flags without context (only globally enabled ones are true)", async () => {
      mockFeatureFlagFindMany.mockResolvedValue([
        makeFlag({ id: "f1", key: "FF_ENABLED", enabled: true }),
        makeFlag({ id: "f2", key: "FF_DISABLED", enabled: false }),
      ]);
      const { getAllFlags } = await import("~/utils/config/feature-flags.server");

      const result = await getAllFlags();

      expect(result).toHaveLength(2);
      expect(result[0].isEnabled).toBe(true);
      expect(result[1].isEnabled).toBe(false);
    });

    it("returns empty array when no flags exist", async () => {
      mockFeatureFlagFindMany.mockResolvedValue([]);
      const { getAllFlags } = await import("~/utils/config/feature-flags.server");

      const result = await getAllFlags();

      expect(result).toEqual([]);
    });

    it("queries flags ordered by key ascending", async () => {
      mockFeatureFlagFindMany.mockResolvedValue([]);
      const { getAllFlags } = await import("~/utils/config/feature-flags.server");

      await getAllFlags();

      expect(mockFeatureFlagFindMany).toHaveBeenCalledWith({
        orderBy: { key: "asc" },
      });
    });

    it("evaluates roles and userId in context for each flag", async () => {
      mockFeatureFlagFindMany.mockResolvedValue([
        makeFlag({ key: "FF_ROLE", enabled: false, enabledForRoles: ["ADMIN"] }),
        makeFlag({ key: "FF_USER", enabled: false, enabledForUsers: ["user-42"] }),
        makeFlag({ key: "FF_NONE", enabled: false }),
      ]);
      const { getAllFlags } = await import("~/utils/config/feature-flags.server");

      const result = await getAllFlags({ roles: ["ADMIN"], userId: "user-42" });

      expect(result.find((f) => f.key === "FF_ROLE")!.isEnabled).toBe(true);
      expect(result.find((f) => f.key === "FF_USER")!.isEnabled).toBe(true);
      expect(result.find((f) => f.key === "FF_NONE")!.isEnabled).toBe(false);
    });
  });

  describe("setFlag", () => {
    it("updates the flag with all provided fields", async () => {
      const updatedFlag = makeFlag({
        id: "flag-1",
        key: "FF_ANALYTICS",
        enabled: true,
        enabledForTenants: ["tenant-1"],
        enabledForRoles: ["ADMIN"],
        enabledForUsers: ["user-1"],
      });
      mockFeatureFlagUpdate.mockResolvedValue(updatedFlag);
      const { setFlag } = await import("~/utils/config/feature-flags.server");

      const result = await setFlag(
        "FF_ANALYTICS",
        {
          enabled: true,
          description: "Analytics feature",
          enabledForTenants: ["tenant-1"],
          enabledForRoles: ["ADMIN"],
          enabledForUsers: ["user-1"],
        },
        CTX,
      );

      expect(result).toEqual(updatedFlag);
      expect(mockFeatureFlagUpdate).toHaveBeenCalledWith({
        where: { key: "FF_ANALYTICS" },
        data: {
          enabled: true,
          description: "Analytics feature",
          enabledForTenants: ["tenant-1"],
          enabledForRoles: ["ADMIN"],
          enabledForUsers: ["user-1"],
        },
      });
    });

    it("only includes provided fields in the data payload", async () => {
      mockFeatureFlagUpdate.mockResolvedValue(makeFlag({ enabled: false }));
      const { setFlag } = await import("~/utils/config/feature-flags.server");

      await setFlag("FF_TEST", { enabled: false }, CTX);

      const updateCall = mockFeatureFlagUpdate.mock.calls[0][0];
      expect(updateCall.data).toEqual({ enabled: false });
      expect(updateCall.data).not.toHaveProperty("description");
      expect(updateCall.data).not.toHaveProperty("enabledForTenants");
      expect(updateCall.data).not.toHaveProperty("enabledForRoles");
      expect(updateCall.data).not.toHaveProperty("enabledForUsers");
    });

    it("sends empty data object when no update fields are provided", async () => {
      mockFeatureFlagUpdate.mockResolvedValue(makeFlag());
      const { setFlag } = await import("~/utils/config/feature-flags.server");

      await setFlag("FF_TEST", {}, CTX);

      const updateCall = mockFeatureFlagUpdate.mock.calls[0][0];
      expect(updateCall.data).toEqual({});
    });

    it("logs the flag update via logger.info", async () => {
      mockFeatureFlagUpdate.mockResolvedValue(
        makeFlag({ id: "flag-42", key: "FF_PWA", enabled: true }),
      );
      const { setFlag } = await import("~/utils/config/feature-flags.server");
      const { logger } = await import("~/utils/monitoring/logger.server");

      await setFlag("FF_PWA", { enabled: true }, CTX);

      expect(logger.info).toHaveBeenCalledWith(
        { flagId: "flag-42", key: "FF_PWA", enabled: true },
        "Feature flag updated",
      );
    });

    it("creates an audit log entry with correct metadata", async () => {
      mockFeatureFlagUpdate.mockResolvedValue(
        makeFlag({ id: "flag-42", key: "FF_WEBHOOKS", enabled: true }),
      );
      const { setFlag } = await import("~/utils/config/feature-flags.server");

      await setFlag("FF_WEBHOOKS", { enabled: true, description: "Enable webhooks" }, CTX);

      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: {
          tenantId: "tenant-1",
          userId: "user-1",
          action: "CONFIGURE",
          entityType: "FeatureFlag",
          entityId: "flag-42",
          description: 'Updated feature flag "FF_WEBHOOKS" (enabled: true)',
          ipAddress: "127.0.0.1",
          userAgent: "test-agent",
          metadata: {
            key: "FF_WEBHOOKS",
            enabled: true,
            description: "Enable webhooks",
          },
        },
      });
    });

    it("uses null for tenantId in audit log when ctx.tenantId is undefined", async () => {
      mockFeatureFlagUpdate.mockResolvedValue(makeFlag({ id: "flag-1" }));
      const { setFlag } = await import("~/utils/config/feature-flags.server");

      const ctxNoTenant = { userId: "user-1", ipAddress: "127.0.0.1", userAgent: "test-agent" };
      await setFlag("FF_TEST", { enabled: true }, ctxNoTenant);

      const auditCall = mockAuditLogCreate.mock.calls[0][0];
      expect(auditCall.data.tenantId).toBeNull();
    });

    it("returns the updated flag from Prisma", async () => {
      const updatedFlag = makeFlag({ id: "flag-99", key: "FF_I18N", enabled: true });
      mockFeatureFlagUpdate.mockResolvedValue(updatedFlag);
      const { setFlag } = await import("~/utils/config/feature-flags.server");

      const result = await setFlag("FF_I18N", { enabled: true }, CTX);

      expect(result).toBe(updatedFlag);
    });

    it("updates only enabledForTenants when that is the only field", async () => {
      mockFeatureFlagUpdate.mockResolvedValue(
        makeFlag({ enabledForTenants: ["tenant-a", "tenant-b"] }),
      );
      const { setFlag } = await import("~/utils/config/feature-flags.server");

      await setFlag("FF_TEST", { enabledForTenants: ["tenant-a", "tenant-b"] }, CTX);

      const updateCall = mockFeatureFlagUpdate.mock.calls[0][0];
      expect(updateCall.data).toEqual({
        enabledForTenants: ["tenant-a", "tenant-b"],
      });
    });
  });
});

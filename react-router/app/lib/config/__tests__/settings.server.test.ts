import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSystemSettingFindMany = vi.fn();
const mockSystemSettingFindUnique = vi.fn();
const mockSystemSettingUpsert = vi.fn();
const mockSystemSettingDelete = vi.fn();
const mockAuditLogCreate = vi.fn();

vi.mock("~/lib/db/db.server", () => ({
  prisma: {
    systemSetting: {
      findMany: (...args: unknown[]) => mockSystemSettingFindMany(...args),
      findUnique: (...args: unknown[]) => mockSystemSettingFindUnique(...args),
      upsert: (...args: unknown[]) => mockSystemSettingUpsert(...args),
      delete: (...args: unknown[]) => mockSystemSettingDelete(...args),
    },
    auditLog: {
      create: (...args: unknown[]) => mockAuditLogCreate(...args),
    },
  },
}));

vi.mock("~/lib/monitoring/logger.server", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const CTX = {
  userId: "user-1",
  tenantId: "tenant-1",
  ipAddress: "127.0.0.1",
  userAgent: "test-agent",
};

function makeDbSetting(overrides: Partial<{
  id: string;
  key: string;
  value: string;
  type: string;
  category: string;
  scope: string;
  scopeId: string;
  createdAt: Date;
  updatedAt: Date;
}> = {}) {
  return {
    id: overrides.id ?? "setting-1",
    key: overrides.key ?? "general.app_name",
    value: overrides.value ?? "My App",
    type: overrides.type ?? "string",
    category: overrides.category ?? "general",
    scope: overrides.scope ?? "global",
    scopeId: overrides.scopeId ?? "",
    createdAt: overrides.createdAt ?? new Date("2026-01-01"),
    updatedAt: overrides.updatedAt ?? new Date("2026-01-01"),
  };
}

describe("settings.server", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAuditLogCreate.mockResolvedValue({});
  });

  describe("SETTING_DEFAULTS", () => {
    it("exports defaults for all expected settings", async () => {
      const { SETTING_DEFAULTS } = await import("../settings.server");

      expect(SETTING_DEFAULTS["upload.max_file_size_mb"]).toEqual({
        value: "10",
        type: "number",
        category: "upload",
      });
      expect(SETTING_DEFAULTS["auth.session_timeout_minutes"]).toEqual({
        value: "480",
        type: "number",
        category: "auth",
      });
      expect(SETTING_DEFAULTS["email.from_address"]).toEqual({
        value: "noreply@example.com",
        type: "string",
        category: "email",
      });
      expect(SETTING_DEFAULTS["general.app_name"]).toEqual({
        value: "App Platform",
        type: "string",
        category: "general",
      });
      expect(SETTING_DEFAULTS["general.default_timezone"]).toEqual({
        value: "UTC",
        type: "string",
        category: "general",
      });
    });

    it("includes upload.allowed_extensions default", async () => {
      const { SETTING_DEFAULTS } = await import("../settings.server");

      expect(SETTING_DEFAULTS["upload.allowed_extensions"].value).toBe(
        "jpg,jpeg,png,gif,pdf,doc,docx",
      );
      expect(SETTING_DEFAULTS["upload.allowed_extensions"].category).toBe("upload");
    });

    it("includes all auth-related defaults", async () => {
      const { SETTING_DEFAULTS } = await import("../settings.server");

      expect(SETTING_DEFAULTS["auth.max_failed_attempts"].value).toBe("5");
      expect(SETTING_DEFAULTS["auth.lockout_duration_minutes"].value).toBe("30");
      expect(SETTING_DEFAULTS["auth.inactivity_timeout_minutes"].value).toBe("60");
    });
  });

  describe("getSetting", () => {
    it("returns database setting when found at global scope", async () => {
      mockSystemSettingFindMany.mockResolvedValue([
        makeDbSetting({ key: "general.app_name", value: "Custom App", scope: "global" }),
      ]);
      const { getSetting } = await import("../settings.server");

      const result = await getSetting("general.app_name");

      expect(result).toEqual({
        key: "general.app_name",
        value: "Custom App",
        type: "string",
        category: "general",
        scope: "global",
        scopeId: "",
      });
    });

    it("returns the default when no database setting exists", async () => {
      mockSystemSettingFindMany.mockResolvedValue([]);
      const { getSetting } = await import("../settings.server");

      const result = await getSetting("upload.max_file_size_mb");

      expect(result).toEqual({
        key: "upload.max_file_size_mb",
        value: "10",
        type: "number",
        category: "upload",
        scope: "default",
        scopeId: "",
      });
    });

    it("returns null when key has no default and no database entry", async () => {
      mockSystemSettingFindMany.mockResolvedValue([]);
      const { getSetting } = await import("../settings.server");

      const result = await getSetting("nonexistent.key");

      expect(result).toBeNull();
    });

    it("prefers user-scoped setting over tenant-scoped setting", async () => {
      mockSystemSettingFindMany.mockResolvedValue([
        makeDbSetting({
          key: "general.app_name",
          value: "Tenant App",
          scope: "tenant",
          scopeId: "tenant-1",
        }),
        makeDbSetting({
          key: "general.app_name",
          value: "User App",
          scope: "user",
          scopeId: "user-1",
        }),
      ]);
      const { getSetting } = await import("../settings.server");

      const result = await getSetting("general.app_name", {
        tenantId: "tenant-1",
        userId: "user-1",
      });

      expect(result!.value).toBe("User App");
      expect(result!.scope).toBe("user");
    });

    it("prefers tenant-scoped setting over global-scoped setting", async () => {
      mockSystemSettingFindMany.mockResolvedValue([
        makeDbSetting({
          key: "email.from_name",
          value: "Global Name",
          scope: "global",
          scopeId: "",
        }),
        makeDbSetting({
          key: "email.from_name",
          value: "Tenant Name",
          scope: "tenant",
          scopeId: "tenant-1",
        }),
      ]);
      const { getSetting } = await import("../settings.server");

      const result = await getSetting("email.from_name", { tenantId: "tenant-1" });

      expect(result!.value).toBe("Tenant Name");
      expect(result!.scope).toBe("tenant");
    });

    it("queries with only global scope when no context provided", async () => {
      mockSystemSettingFindMany.mockResolvedValue([]);
      const { getSetting } = await import("../settings.server");

      await getSetting("general.app_name");

      expect(mockSystemSettingFindMany).toHaveBeenCalledWith({
        where: {
          key: "general.app_name",
          OR: [{ scope: "global", scopeId: "" }],
        },
      });
    });

    it("queries with global and tenant scopes when tenantId provided", async () => {
      mockSystemSettingFindMany.mockResolvedValue([]);
      const { getSetting } = await import("../settings.server");

      await getSetting("general.app_name", { tenantId: "tenant-1" });

      expect(mockSystemSettingFindMany).toHaveBeenCalledWith({
        where: {
          key: "general.app_name",
          OR: [
            { scope: "global", scopeId: "" },
            { scope: "tenant", scopeId: "tenant-1" },
          ],
        },
      });
    });

    it("queries with global, tenant, and user scopes when both provided", async () => {
      mockSystemSettingFindMany.mockResolvedValue([]);
      const { getSetting } = await import("../settings.server");

      await getSetting("general.app_name", { tenantId: "tenant-1", userId: "user-1" });

      expect(mockSystemSettingFindMany).toHaveBeenCalledWith({
        where: {
          key: "general.app_name",
          OR: [
            { scope: "global", scopeId: "" },
            { scope: "tenant", scopeId: "tenant-1" },
            { scope: "user", scopeId: "user-1" },
          ],
        },
      });
    });

    it("handles unknown scopes by treating them as lowest priority", async () => {
      mockSystemSettingFindMany.mockResolvedValue([
        makeDbSetting({
          key: "general.app_name",
          value: "Unknown Scope",
          scope: "custom",
          scopeId: "x",
        }),
        makeDbSetting({
          key: "general.app_name",
          value: "Global",
          scope: "global",
          scopeId: "",
        }),
      ]);
      const { getSetting } = await import("../settings.server");

      const result = await getSetting("general.app_name");

      expect(result!.value).toBe("Global");
      expect(result!.scope).toBe("global");
    });
  });

  describe("setSetting", () => {
    it("upserts the setting and creates an audit log", async () => {
      const upsertedSetting = makeDbSetting({
        id: "setting-42",
        key: "general.app_name",
        value: "New App Name",
      });
      mockSystemSettingUpsert.mockResolvedValue(upsertedSetting);
      const { setSetting } = await import("../settings.server");

      const result = await setSetting(
        {
          key: "general.app_name",
          value: "New App Name",
          type: "string",
          category: "general",
          scope: "global",
          scopeId: "",
        },
        CTX,
      );

      expect(result).toEqual(upsertedSetting);
      expect(mockSystemSettingUpsert).toHaveBeenCalledWith({
        where: {
          key_scope_scopeId: {
            key: "general.app_name",
            scope: "global",
            scopeId: "",
          },
        },
        update: {
          value: "New App Name",
          type: "string",
          category: "general",
        },
        create: {
          key: "general.app_name",
          value: "New App Name",
          type: "string",
          category: "general",
          scope: "global",
          scopeId: "",
        },
      });
    });

    it("logs the upsert via logger.info", async () => {
      mockSystemSettingUpsert.mockResolvedValue(
        makeDbSetting({ id: "setting-42", key: "email.from_name" }),
      );
      const { setSetting } = await import("../settings.server");
      const { logger } = await import("~/lib/monitoring/logger.server");

      await setSetting(
        {
          key: "email.from_name",
          value: "Support",
          type: "string",
          category: "email",
          scope: "global",
          scopeId: "",
        },
        CTX,
      );

      expect(logger.info).toHaveBeenCalledWith(
        { settingId: "setting-42", key: "email.from_name", scope: "global" },
        "Setting upserted",
      );
    });

    it("creates an audit log with correct metadata", async () => {
      mockSystemSettingUpsert.mockResolvedValue(
        makeDbSetting({ id: "setting-99", key: "auth.max_failed_attempts" }),
      );
      const { setSetting } = await import("../settings.server");

      await setSetting(
        {
          key: "auth.max_failed_attempts",
          value: "10",
          type: "number",
          category: "auth",
          scope: "tenant",
          scopeId: "tenant-1",
        },
        CTX,
      );

      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: {
          tenantId: "tenant-1",
          userId: "user-1",
          action: "CONFIGURE",
          entityType: "SystemSetting",
          entityId: "setting-99",
          description: 'Set "auth.max_failed_attempts" = "10" at scope tenant',
          ipAddress: "127.0.0.1",
          userAgent: "test-agent",
          metadata: {
            key: "auth.max_failed_attempts",
            value: "10",
            scope: "tenant",
            scopeId: "tenant-1",
          },
        },
      });
    });

    it("uses null for tenantId in audit log when ctx.tenantId is undefined", async () => {
      mockSystemSettingUpsert.mockResolvedValue(makeDbSetting({ id: "setting-1" }));
      const { setSetting } = await import("../settings.server");

      const ctxNoTenant = { userId: "user-1", ipAddress: "127.0.0.1", userAgent: "test-agent" };
      await setSetting(
        {
          key: "general.app_name",
          value: "App",
          type: "string",
          category: "general",
          scope: "global",
          scopeId: "",
        },
        ctxNoTenant,
      );

      const auditCall = mockAuditLogCreate.mock.calls[0][0];
      expect(auditCall.data.tenantId).toBeNull();
    });

    it("handles tenant-scoped upsert with scopeId", async () => {
      mockSystemSettingUpsert.mockResolvedValue(
        makeDbSetting({
          key: "upload.max_file_size_mb",
          value: "25",
          scope: "tenant",
          scopeId: "tenant-5",
        }),
      );
      const { setSetting } = await import("../settings.server");

      await setSetting(
        {
          key: "upload.max_file_size_mb",
          value: "25",
          type: "number",
          category: "upload",
          scope: "tenant",
          scopeId: "tenant-5",
        },
        CTX,
      );

      const upsertCall = mockSystemSettingUpsert.mock.calls[0][0];
      expect(upsertCall.where.key_scope_scopeId).toEqual({
        key: "upload.max_file_size_mb",
        scope: "tenant",
        scopeId: "tenant-5",
      });
      expect(upsertCall.create.scope).toBe("tenant");
      expect(upsertCall.create.scopeId).toBe("tenant-5");
    });
  });

  describe("getSettingsByCategory", () => {
    it("returns all settings for a category with scope resolution", async () => {
      mockSystemSettingFindMany
        // First call: getSettingsByCategory fetches settings by category
        .mockResolvedValueOnce([
          makeDbSetting({
            key: "auth.session_timeout_minutes",
            value: "120",
            category: "auth",
            scope: "global",
          }),
          makeDbSetting({
            key: "auth.max_failed_attempts",
            value: "3",
            category: "auth",
            scope: "global",
          }),
        ])
        // Subsequent calls: getSetting queries for individual keys
        .mockResolvedValueOnce([
          makeDbSetting({
            key: "auth.session_timeout_minutes",
            value: "120",
            category: "auth",
            scope: "global",
          }),
        ])
        .mockResolvedValueOnce([
          makeDbSetting({
            key: "auth.max_failed_attempts",
            value: "3",
            category: "auth",
            scope: "global",
          }),
        ])
        // getSetting for default-only keys (lockout_duration_minutes, inactivity_timeout_minutes)
        .mockResolvedValue([]);

      const { getSettingsByCategory } = await import("../settings.server");

      const result = await getSettingsByCategory("auth");

      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result.every((s) => s.category === "auth")).toBe(true);
      // Results should be sorted by key
      for (let i = 1; i < result.length; i++) {
        expect(result[i].key >= result[i - 1].key).toBe(true);
      }
    });

    it("includes default settings that have no DB entries for the category", async () => {
      // No DB settings for the 'upload' category
      mockSystemSettingFindMany.mockResolvedValue([]);
      const { getSettingsByCategory } = await import("../settings.server");

      const result = await getSettingsByCategory("upload");

      // Should include defaults: upload.max_file_size_mb and upload.allowed_extensions
      expect(result.length).toBe(2);
      const keys = result.map((r) => r.key);
      expect(keys).toContain("upload.max_file_size_mb");
      expect(keys).toContain("upload.allowed_extensions");
      expect(result.every((s) => s.scope === "default")).toBe(true);
    });

    it("returns empty array for a category with no DB or default settings", async () => {
      mockSystemSettingFindMany.mockResolvedValue([]);
      const { getSettingsByCategory } = await import("../settings.server");

      const result = await getSettingsByCategory("nonexistent");

      expect(result).toEqual([]);
    });

    it("queries the database filtering by category", async () => {
      mockSystemSettingFindMany.mockResolvedValue([]);
      const { getSettingsByCategory } = await import("../settings.server");

      await getSettingsByCategory("email");

      expect(mockSystemSettingFindMany).toHaveBeenCalledWith({
        where: { category: "email" },
        orderBy: { key: "asc" },
      });
    });

    it("passes context through to getSetting for scope resolution", async () => {
      mockSystemSettingFindMany
        .mockResolvedValueOnce([
          makeDbSetting({
            key: "email.from_name",
            value: "Global Email",
            category: "email",
            scope: "global",
          }),
        ])
        .mockResolvedValueOnce([
          makeDbSetting({
            key: "email.from_name",
            value: "Global Email",
            category: "email",
            scope: "global",
          }),
          makeDbSetting({
            key: "email.from_name",
            value: "Tenant Email",
            category: "email",
            scope: "tenant",
            scopeId: "tenant-1",
          }),
        ])
        .mockResolvedValue([]);

      const { getSettingsByCategory } = await import("../settings.server");

      const result = await getSettingsByCategory("email", { tenantId: "tenant-1" });

      const fromName = result.find((s) => s.key === "email.from_name");
      expect(fromName!.value).toBe("Tenant Email");
      expect(fromName!.scope).toBe("tenant");
    });
  });

  describe("getAllSettings", () => {
    it("returns settings grouped by category", async () => {
      mockSystemSettingFindMany
        // First call: getAllSettings fetches all settings
        .mockResolvedValueOnce([
          makeDbSetting({ key: "general.app_name", category: "general", scope: "global" }),
          makeDbSetting({
            key: "auth.session_timeout_minutes",
            category: "auth",
            scope: "global",
          }),
        ])
        // Subsequent calls from getSettingsByCategory + getSetting
        .mockResolvedValue([]);

      const { getAllSettings } = await import("../settings.server");

      const result = await getAllSettings();

      expect(result).toHaveProperty("general");
      expect(result).toHaveProperty("auth");
      expect(Array.isArray(result["general"])).toBe(true);
      expect(Array.isArray(result["auth"])).toBe(true);
    });

    it("includes categories from defaults even when no DB entries exist", async () => {
      // No DB settings at all
      mockSystemSettingFindMany.mockResolvedValue([]);
      const { getAllSettings } = await import("../settings.server");

      const result = await getAllSettings();

      // SETTING_DEFAULTS has categories: upload, auth, email, general
      expect(result).toHaveProperty("upload");
      expect(result).toHaveProperty("auth");
      expect(result).toHaveProperty("email");
      expect(result).toHaveProperty("general");
    });

    it("passes context through to getSettingsByCategory", async () => {
      mockSystemSettingFindMany.mockResolvedValue([]);
      const { getAllSettings } = await import("../settings.server");

      await getAllSettings({ tenantId: "tenant-1", userId: "user-1" });

      // The first call fetches all settings; subsequent calls are from getSettingsByCategory
      // and then getSetting, which should include tenant and user scopes in OR filters.
      // We verify by checking that findMany was called (the function delegates correctly).
      expect(mockSystemSettingFindMany).toHaveBeenCalled();
    });
  });

  describe("deleteSetting", () => {
    it("deletes a setting and returns success true", async () => {
      const existingSetting = makeDbSetting({
        id: "setting-42",
        key: "general.app_name",
        scope: "tenant",
        scopeId: "tenant-1",
      });
      mockSystemSettingFindUnique.mockResolvedValue(existingSetting);
      mockSystemSettingDelete.mockResolvedValue(existingSetting);
      const { deleteSetting } = await import("../settings.server");

      const result = await deleteSetting("general.app_name", "tenant", "tenant-1", CTX);

      expect(result).toEqual({ success: true });
      expect(mockSystemSettingFindUnique).toHaveBeenCalledWith({
        where: {
          key_scope_scopeId: {
            key: "general.app_name",
            scope: "tenant",
            scopeId: "tenant-1",
          },
        },
      });
      expect(mockSystemSettingDelete).toHaveBeenCalledWith({
        where: {
          key_scope_scopeId: {
            key: "general.app_name",
            scope: "tenant",
            scopeId: "tenant-1",
          },
        },
      });
    });

    it("returns success false when setting does not exist", async () => {
      mockSystemSettingFindUnique.mockResolvedValue(null);
      const { deleteSetting } = await import("../settings.server");

      const result = await deleteSetting("nonexistent.key", "global", "", CTX);

      expect(result).toEqual({ success: false });
      expect(mockSystemSettingDelete).not.toHaveBeenCalled();
      expect(mockAuditLogCreate).not.toHaveBeenCalled();
    });

    it("logs the deletion via logger.info", async () => {
      mockSystemSettingFindUnique.mockResolvedValue(makeDbSetting({ id: "setting-1" }));
      mockSystemSettingDelete.mockResolvedValue({});
      const { deleteSetting } = await import("../settings.server");
      const { logger } = await import("~/lib/monitoring/logger.server");

      await deleteSetting("general.app_name", "global", "", CTX);

      expect(logger.info).toHaveBeenCalledWith(
        { key: "general.app_name", scope: "global", scopeId: "" },
        "Setting deleted",
      );
    });

    it("creates an audit log entry for deletion", async () => {
      mockSystemSettingFindUnique.mockResolvedValue(
        makeDbSetting({
          id: "setting-77",
          key: "auth.lockout_duration_minutes",
          scope: "tenant",
          scopeId: "tenant-1",
        }),
      );
      mockSystemSettingDelete.mockResolvedValue({});
      const { deleteSetting } = await import("../settings.server");

      await deleteSetting("auth.lockout_duration_minutes", "tenant", "tenant-1", CTX);

      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: {
          tenantId: "tenant-1",
          userId: "user-1",
          action: "CONFIGURE",
          entityType: "SystemSetting",
          entityId: "setting-77",
          description: 'Deleted setting "auth.lockout_duration_minutes" at scope tenant',
          ipAddress: "127.0.0.1",
          userAgent: "test-agent",
          metadata: {
            key: "auth.lockout_duration_minutes",
            scope: "tenant",
            scopeId: "tenant-1",
          },
        },
      });
    });

    it("uses null for tenantId in audit log when ctx.tenantId is undefined", async () => {
      mockSystemSettingFindUnique.mockResolvedValue(makeDbSetting({ id: "setting-1" }));
      mockSystemSettingDelete.mockResolvedValue({});
      const { deleteSetting } = await import("../settings.server");

      const ctxNoTenant = { userId: "user-1", ipAddress: "127.0.0.1", userAgent: "test-agent" };
      await deleteSetting("general.app_name", "global", "", ctxNoTenant);

      const auditCall = mockAuditLogCreate.mock.calls[0][0];
      expect(auditCall.data.tenantId).toBeNull();
    });

    it("does not call delete or audit when setting not found", async () => {
      mockSystemSettingFindUnique.mockResolvedValue(null);
      const { deleteSetting } = await import("../settings.server");

      await deleteSetting("missing.key", "global", "", CTX);

      expect(mockSystemSettingDelete).not.toHaveBeenCalled();
      expect(mockAuditLogCreate).not.toHaveBeenCalled();
    });
  });
});

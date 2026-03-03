import { prisma } from "~/lib/db.server";
import { logger } from "~/lib/logger.server";
import { twoFAVerificationType } from "~/lib/2fa-constants";
import type { TenantServiceContext } from "~/lib/types.server";

// ─── Types ────────────────────────────────────────────────

export interface TwoFAPolicy {
  mode: "off" | "all" | "roles";
  roleIds: string[];
}

const SETTING_KEY = "security.require2fa";

// ─── Policy Retrieval ─────────────────────────────────────

/**
 * Read the 2FA enforcement policy for a tenant from SystemSetting.
 * Returns { mode: "off" | "all" | "roles", roleIds: string[] }
 */
export async function getTwoFAPolicy(tenantId: string): Promise<TwoFAPolicy> {
  const setting = await prisma.systemSetting.findUnique({
    where: {
      key_scope_scopeId: {
        key: SETTING_KEY,
        scope: "tenant",
        scopeId: tenantId,
      },
    },
  });

  if (!setting) {
    return { mode: "off", roleIds: [] };
  }

  const value = setting.value;

  if (value === "all") {
    return { mode: "all", roleIds: [] };
  }

  if (value.startsWith("roles:")) {
    const roleIds = value
      .slice(6)
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    return { mode: "roles", roleIds };
  }

  return { mode: "off", roleIds: [] };
}

// ─── User Enforcement Check ──────────────────────────────

/**
 * Check whether a specific user is required to have 2FA enabled
 * based on the tenant's enforcement policy.
 */
export async function isUserRequired2FA(userId: string, tenantId: string): Promise<boolean> {
  const policy = await getTwoFAPolicy(tenantId);

  if (policy.mode === "off") return false;
  if (policy.mode === "all") return true;

  // mode === "roles" — check if user has any of the specified roles
  if (policy.roleIds.length === 0) return false;

  const matchingRoles = await prisma.userRole.count({
    where: {
      userId,
      roleId: { in: policy.roleIds },
    },
  });

  return matchingRoles > 0;
}

// ─── Check if user has 2FA set up ───────────────────────

/**
 * Check if a user has a 2FA verification record (i.e., has completed setup).
 */
export async function hasUserSetUp2FA(userId: string): Promise<boolean> {
  const verification = await prisma.verification.findUnique({
    select: { id: true },
    where: {
      target_type: {
        target: userId,
        type: twoFAVerificationType,
      },
    },
  });

  return Boolean(verification);
}

// ─── Admin Reset ─────────────────────────────────────────

/**
 * Delete a user's 2FA verification record, forcing them to re-setup on next login.
 */
export async function resetUserTwoFA(userId: string, ctx: TenantServiceContext): Promise<void> {
  const deleted = await prisma.verification.deleteMany({
    where: {
      target: userId,
      type: twoFAVerificationType,
    },
  });

  if (deleted.count > 0) {
    logger.info({ userId, adminId: ctx.userId }, "Admin reset user 2FA");

    await prisma.auditLog.create({
      data: {
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        action: "TWO_FACTOR_DISABLE",
        entityType: "User",
        entityId: userId,
        description: `Admin reset 2FA for user ${userId}`,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: { resetBy: ctx.userId, targetUserId: userId },
      },
    });
  }
}

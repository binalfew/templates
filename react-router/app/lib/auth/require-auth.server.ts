import { data } from "react-router";
import { requireUser, logout } from "~/lib/auth/session.server";
import { isFeatureEnabled } from "~/lib/config/feature-flags.server";
import type { RoleScope } from "~/generated/prisma/client.js";

// --- Types ---

export type PermissionResource = string;
export type PermissionAction = string;

export interface AuthRole {
  id: string;
  name: string;
  scope: RoleScope;
  eventId: string | null;
  stepId: string | null;
}

export interface AuthPermission {
  resource: PermissionResource;
  action: PermissionAction;
  access: string; // "own" | "any"
  roleScope: RoleScope;
  eventId: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  photoUrl: string | null;
  tenantId: string | null;
  roles: AuthRole[];
  permissions: AuthPermission[];
}

// --- Request-level cache ---

const authCache = new WeakMap<Request, Promise<AuthUser>>();

async function loadAuthUser(request: Request): Promise<AuthUser> {
  const user = await requireUser(request);

  const roles: AuthRole[] = user.userRoles.map((ur) => ({
    id: ur.role.id,
    name: ur.role.name,
    scope: ur.role.scope,
    eventId: ur.eventId,
    stepId: ur.stepId,
  }));

  const permissions: AuthPermission[] = user.userRoles.flatMap((ur) =>
    ur.role.rolePermissions.map((rp) => ({
      resource: rp.permission.resource as PermissionResource,
      action: rp.permission.action as PermissionAction,
      access: rp.access,
      roleScope: ur.role.scope,
      eventId: ur.eventId,
    })),
  );

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    photoUrl: user.photoUrl,
    tenantId: user.tenantId,
    roles,
    permissions,
  };
}

function getAuthUser(request: Request): Promise<AuthUser> {
  const existing = authCache.get(request);
  if (existing) return existing;
  const promise = loadAuthUser(request);
  authCache.set(request, promise);
  return promise;
}

// --- Permission check logic ---

function checkPermission(
  user: AuthUser,
  resource: PermissionResource,
  action: PermissionAction,
  opts?: { eventId?: string; ownerId?: string },
): boolean {
  return user.permissions.some((p) => {
    if (p.resource !== resource || p.action !== action) return false;

    // GLOBAL scope -> always allowed
    if (p.roleScope === "GLOBAL") return true;

    // TENANT scope -> allowed for own tenant's data
    if (p.roleScope === "TENANT") {
      if (p.access === "own" && opts?.ownerId && opts.ownerId !== user.id) return false;
      return true;
    }

    // EVENT scope -> must match eventId
    if (p.roleScope === "EVENT") {
      if (opts?.eventId && p.eventId && p.eventId !== opts.eventId) return false;
      if (p.access === "own" && opts?.ownerId && opts.ownerId !== user.id) return false;
      return true;
    }

    return false;
  });
}

// --- Public API ---

export async function requireAuth(request: Request) {
  const authUser = await getAuthUser(request);
  const roles = [...new Set(authUser.roles.map((r) => r.name))];
  const isSuperAdmin = authUser.roles.some((r) => r.scope === "GLOBAL");
  return { user: authUser, roles, isSuperAdmin };
}

export async function requireRole(request: Request, roleName: string) {
  const { user, roles, isSuperAdmin } = await requireAuth(request);
  if (!roles.includes(roleName)) {
    throw data({ error: "Forbidden" }, { status: 403 });
  }
  return { user, roles, isSuperAdmin };
}

export async function requireAnyRole(request: Request, roleNames: string[]) {
  const { user, roles, isSuperAdmin } = await requireAuth(request);
  if (!roleNames.some((name) => roles.includes(name))) {
    throw data({ error: "Forbidden" }, { status: 403 });
  }
  return { user, roles, isSuperAdmin };
}

export async function requirePermission(
  request: Request,
  resource: PermissionResource,
  action: PermissionAction,
  opts?: { eventId?: string; ownerId?: string },
) {
  const { user, roles, isSuperAdmin } = await requireAuth(request);
  if (!checkPermission(user, resource, action, opts)) {
    throw data({ error: "Forbidden" }, { status: 403 });
  }
  return { user, roles, isSuperAdmin };
}

export async function requireGlobalAdmin(request: Request) {
  const { user, roles, isSuperAdmin } = await requireAuth(request);
  if (!isSuperAdmin) {
    throw data({ error: "Forbidden" }, { status: 403 });
  }
  return { user, roles, isSuperAdmin };
}

export async function hasPermission(
  userId: string,
  resource: PermissionResource,
  action: PermissionAction,
): Promise<boolean> {
  const { prisma } = await import("~/lib/db/db.server");
  try {
    const count = await prisma.userRole.count({
      where: {
        userId,
        role: {
          rolePermissions: {
            some: {
              permission: { resource, action },
            },
          },
        },
      },
    });
    return count > 0;
  } catch {
    return false;
  }
}

export function toClientUser(user: AuthUser) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    tenantId: user.tenantId,
    roles: user.roles.map((r) => ({ name: r.name, scope: r.scope })),
    permissions: user.permissions.map((p) => ({
      resource: p.resource,
      action: p.action,
      access: p.access,
    })),
  };
}

export async function requireFeature(request: Request, flagKey: string) {
  const { user, roles, isSuperAdmin } = await requireAuth(request);
  const tenantId = user.tenantId;
  if (!tenantId) throw data({ error: "No tenant" }, { status: 403 });
  const enabled = await isFeatureEnabled(flagKey, { tenantId, roles, userId: user.id });
  if (!enabled) throw data({ error: "Feature not enabled" }, { status: 404 });
  return { user, roles, isSuperAdmin, tenantId };
}

/**
 * Client-side permission helpers.
 * These work with the client-safe user data returned by `toClientUser()`.
 */

export type ClientUser = {
  id: string;
  email: string;
  name: string | null;
  tenantId: string | null;
  roles: Array<{ name: string; scope: string }>;
  permissions: Array<{ resource: string; action: string; access: string }>;
};

/**
 * Check if the user has a given permission.
 * If `access` is specified, checks for that exact level (or "any" which covers "own").
 */
export function userHasPermission(
  user: ClientUser | null | undefined,
  resource: string,
  action: string,
  access?: "own" | "any",
): boolean {
  if (!user) return false;
  return user.permissions.some(
    (p) =>
      p.resource === resource &&
      p.action === action &&
      (!access || p.access === access || p.access === "any"),
  );
}

/**
 * Check if the user has a specific role by name.
 */
export function userHasRole(user: ClientUser | null | undefined, roleName: string): boolean {
  if (!user) return false;
  return user.roles.some((r) => r.name === roleName);
}

/**
 * Check if the user has a GLOBAL-scoped role (super admin).
 */
export function userIsGlobalAdmin(user: ClientUser | null | undefined): boolean {
  if (!user) return false;
  return user.roles.some((r) => r.scope === "GLOBAL");
}

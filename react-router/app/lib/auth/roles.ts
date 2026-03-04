/**
 * Role name constants and common role sets for use with `requireAnyRole`.
 *
 * These must match the role names seeded in `prisma/seed.ts`.
 */

export const ROLE_ADMIN = "ADMIN";
export const ROLE_TENANT_ADMIN = "TENANT_ADMIN";
export const ROLE_VIEWER = "VIEWER";

/** Structural / system-level features (objects, fields, forms, data). */
export const ADMIN_ONLY = [ROLE_ADMIN] as const;

/** Operational features (api-keys, webhooks, templates, broadcasts, views). */
export const ADMIN_OR_TENANT_ADMIN = [ROLE_ADMIN, ROLE_TENANT_ADMIN] as const;

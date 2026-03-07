import { PrismaClient } from "../app/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // ─── Tenant ───────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: "admin" },
    update: { name: "Admin" },
    create: {
      name: "Admin",
      slug: "admin",
      email: "admin@example.com",
      phone: "+1-000-000-0000",
      subscriptionPlan: "enterprise",
    },
  });
  console.log(`Seeded tenant: ${tenant.name} [${tenant.slug}] (${tenant.id})`);

  // ─── Admin User ───────────────────────────────────────
  const passwordHash = await hash("password123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      username: "admin",
      name: "System Admin",
      tenantId: tenant.id,
      password: {
        create: { hash: passwordHash },
      },
    },
  });
  console.log(`Seeded admin user: ${admin.email} (${admin.id})`);

  // ─── Permissions ──────────────────────────────────────
  const permissionDefs = [
    { resource: "user", action: "create" },
    { resource: "user", action: "read" },
    { resource: "user", action: "update" },
    { resource: "user", action: "delete" },
    { resource: "tenant", action: "create" },
    { resource: "tenant", action: "read" },
    { resource: "tenant", action: "update" },
    { resource: "tenant", action: "delete" },
    { resource: "role", action: "create" },
    { resource: "role", action: "read" },
    { resource: "role", action: "update" },
    { resource: "role", action: "delete" },
    { resource: "permission", action: "read" },
    { resource: "permission", action: "manage" },
    { resource: "settings", action: "manage" },
    { resource: "feature-flag", action: "manage" },
    { resource: "reference-data", action: "manage" },
    { resource: "api-key", action: "manage" },
    { resource: "webhook", action: "manage" },
    { resource: "saved-view", action: "manage" },
    { resource: "file-upload", action: "manage" },
  ];

  const permissions = await Promise.all(
    permissionDefs.map((p) =>
      prisma.permission.upsert({
        where: { resource_action: { resource: p.resource, action: p.action } },
        update: {},
        create: p,
      }),
    ),
  );
  console.log(`Seeded ${permissions.length} permissions`);

  // ─── Roles ────────────────────────────────────────────
  const roleDefs = [
    { name: "ADMIN", description: "Full access to all resources", scope: "GLOBAL" as const },
    {
      name: "TENANT_ADMIN",
      description: "Full access within own tenant",
      scope: "TENANT" as const,
    },
    { name: "VIEWER", description: "Read-only access", scope: "TENANT" as const },
  ];

  const roles: Record<string, { id: string }> = {};
  for (const r of roleDefs) {
    const role = await prisma.role.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: r.name } },
      update: { scope: r.scope },
      create: { tenantId: tenant.id, name: r.name, description: r.description, scope: r.scope },
    });
    roles[r.name] = role;
  }
  console.log(`Seeded ${Object.keys(roles).length} roles`);

  // ─── Role Permissions ─────────────────────────────────
  const permMap = new Map(permissions.map((p) => [`${p.resource}:${p.action}`, p.id]));

  const rolePermissionAssignments: Record<string, Array<{ key: string; access: string }>> = {
    ADMIN: permissionDefs.map((p) => ({ key: `${p.resource}:${p.action}`, access: "any" })),
    TENANT_ADMIN: permissionDefs.map((p) => ({ key: `${p.resource}:${p.action}`, access: "any" })),
    VIEWER: [
      { key: "user:read", access: "own" },
      { key: "tenant:read", access: "any" },
      { key: "role:read", access: "any" },
      { key: "permission:read", access: "any" },
    ],
  };

  for (const [roleName, permEntries] of Object.entries(rolePermissionAssignments)) {
    const roleId = roles[roleName]?.id;
    if (!roleId) continue;
    for (const { key, access } of permEntries) {
      const permissionId = permMap.get(key);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId } },
        update: { access },
        create: { roleId, permissionId, access },
      });
    }
  }
  console.log("Seeded role-permission assignments");

  // ─── User Roles ──────────────────────────────────────
  const existing = await prisma.userRole.findFirst({
    where: { userId: admin.id, roleId: roles.ADMIN.id, eventId: null },
  });
  if (!existing) {
    await prisma.userRole.create({
      data: { userId: admin.id, roleId: roles.ADMIN.id, eventId: null },
    });
  }
  console.log("Seeded user-role assignments");

  // ─── Feature Flags ──────────────────────────────────────
  const defaultFlags = [
    { key: "FF_I18N", description: "Internationalization and multi-language support" },
    { key: "FF_PWA", description: "Progressive Web App shell and service worker" },
    { key: "FF_REST_API", description: "REST API with API key authentication" },
    { key: "FF_WEBHOOKS", description: "Webhook subscriptions and event delivery" },
    { key: "FF_SAVED_VIEWS", description: "Saved table/grid/kanban views" },
    { key: "FF_TWO_FACTOR", description: "Two-factor authentication (TOTP)" },
  ];

  for (const flag of defaultFlags) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: {},
      create: {
        key: flag.key,
        description: flag.description,
        enabled: false,
      },
    });
  }
  console.log(`Seeded ${defaultFlags.length} feature flags`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });

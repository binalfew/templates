import { hash } from "bcryptjs";
import type { PrismaClient } from "../../app/generated/prisma/client.js";

let counter = 0;
function unique() {
  return ++counter;
}

export function buildTenant(overrides?: Record<string, unknown>) {
  const n = unique();
  return {
    name: `Test Org ${n}`,
    email: `org${n}@test.com`,
    phone: `+1-555-000-${String(n).padStart(4, "0")}`,
    subscriptionPlan: "PROFESSIONAL",
    ...overrides,
  };
}

export function buildUser(overrides?: Record<string, unknown>) {
  const n = unique();
  return {
    email: `user${n}@test.com`,
    username: `testuser${n}`,
    name: `Test User ${n}`,
    status: "ACTIVE" as const,
    ...overrides,
  };
}

export function buildRole(overrides?: Record<string, unknown>) {
  const n = unique();
  return {
    name: `Role ${n}`,
    description: `Test role ${n}`,
    ...overrides,
  };
}

export async function seedFullScenario(prisma: PrismaClient) {
  const tenant = await prisma.tenant.create({ data: buildTenant() });
  const passwordHash = await hash("TestPassword123!", 10);
  const user = await prisma.user.create({
    data: {
      ...buildUser(),
      tenantId: tenant.id,
      password: { create: { hash: passwordHash } },
    },
  });

  const role = await prisma.role.create({
    data: {
      ...buildRole(),
      tenantId: tenant.id,
    },
  });

  await prisma.userRole.create({
    data: {
      userId: user.id,
      roleId: role.id,
    },
  });

  return { tenant, user, role };
}

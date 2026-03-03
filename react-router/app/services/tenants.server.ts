import { prisma } from "~/lib/db/db.server";
import { hashPassword } from "~/lib/auth/auth.server";
import { ServiceError } from "~/lib/errors/service-error.server";
import type { PaginatedQueryOptions, ServiceContext } from "~/lib/types.server";

export class TenantError extends ServiceError {
  constructor(message: string, status: number) {
    super(message, status);
    this.name = "TenantError";
  }
}

export async function listTenants() {
  return prisma.tenant.findMany({
    where: { slug: { not: "admin" } },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { users: true, roles: true } },
    },
  });
}

export async function listTenantsPaginated(options: PaginatedQueryOptions) {
  const baseWhere = { slug: { not: "admin" } };
  const where = options.where && Object.keys(options.where).length > 0
    ? { AND: [baseWhere, options.where] }
    : baseWhere;
  const orderBy = options.orderBy?.length ? (options.orderBy as any) : { name: "asc" };

  const [items, totalCount] = await Promise.all([
    prisma.tenant.findMany({
      where: where as any,
      orderBy,
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
      include: {
        _count: { select: { users: true, roles: true } },
      },
    }),
    prisma.tenant.count({ where: where as any }),
  ]);

  return { items, totalCount };
}

export async function getTenant(id: string) {
  const tenant = await prisma.tenant.findFirst({ where: { id } });
  if (!tenant) {
    throw new TenantError("Tenant not found", 404);
  }
  return tenant;
}

export async function getTenantBySlug(slug: string) {
  const tenant = await prisma.tenant.findFirst({ where: { slug } });
  if (!tenant) {
    throw new TenantError("Tenant not found", 404);
  }
  return tenant;
}

export async function getTenantWithCounts(id: string) {
  const tenant = await prisma.tenant.findFirst({
    where: { id },
    include: {
      _count: { select: { users: true, roles: true } },
    },
  });
  if (!tenant) {
    throw new TenantError("Tenant not found", 404);
  }
  return tenant;
}

export async function getTenantDetail(id: string) {
  const tenant = await prisma.tenant.findFirst({
    where: { id },
    include: {
      _count: { select: { users: true, roles: true } },
    },
  });
  if (!tenant) {
    throw new TenantError("Tenant not found", 404);
  }

  const recentAuditLogs = await prisma.auditLog.findMany({
    where: { entityType: "Tenant", entityId: id },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return { tenant, recentAuditLogs };
}

interface CreateTenantInput {
  name: string;
  slug: string;
  email: string;
  phone: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  subscriptionPlan?: string;
  logoUrl?: string;
  brandTheme?: string;
  adminEmail?: string;
  adminName?: string;
  adminPassword?: string;
}

export async function createTenant(input: CreateTenantInput, ctx: ServiceContext) {
  let tenant;
  try {
    tenant = await prisma.tenant.create({
      data: {
        name: input.name,
        slug: input.slug,
        email: input.email,
        phone: input.phone,
        website: input.website || null,
        address: input.address || "",
        city: input.city || "",
        state: input.state || "",
        zip: input.zip || "",
        country: input.country || "",
        subscriptionPlan: input.subscriptionPlan ?? "free",
        logoUrl: input.logoUrl || null,
        brandTheme: input.brandTheme || "",
      },
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as any).code === "P2002") {
      throw new TenantError("A tenant with this name or email already exists", 409);
    }
    throw error;
  }

  // Seed default roles for the new tenant
  const defaultRoles = [
    {
      name: "TENANT_ADMIN",
      description: "Full access within own tenant",
      scope: "TENANT" as const,
    },
    {
      name: "VALIDATOR",
      description: "Can review and approve participants",
      scope: "EVENT" as const,
    },
    { name: "PRINTER", description: "Can print badges", scope: "EVENT" as const },
    { name: "DISPATCHER", description: "Can collect and dispatch badges", scope: "EVENT" as const },
    { name: "VIEWER", description: "Read-only access", scope: "EVENT" as const },
    {
      name: "USER",
      description: "Default role for self-registered users",
      scope: "EVENT" as const,
    },
  ];

  for (const r of defaultRoles) {
    await prisma.role.create({
      data: { tenantId: tenant.id, name: r.name, description: r.description, scope: r.scope },
    });
  }

  // Grant all permissions to the TENANT_ADMIN role
  const tenantAdminRole = await prisma.role.findFirst({
    where: { tenantId: tenant.id, name: "TENANT_ADMIN" },
  });
  if (tenantAdminRole) {
    const allPermissions = await prisma.permission.findMany();
    await prisma.rolePermission.createMany({
      data: allPermissions.map((p) => ({
        roleId: tenantAdminRole.id,
        permissionId: p.id,
        access: "any",
      })),
      skipDuplicates: true,
    });
  }

  // Provision initial admin user if admin fields are provided
  let adminUser = null;
  if (input.adminEmail && input.adminPassword) {
    const adminUsername = input.adminEmail.split("@")[0];
    const passwordHash = await hashPassword(input.adminPassword);

    try {
      adminUser = await prisma.user.create({
        data: {
          email: input.adminEmail,
          username: adminUsername,
          name: input.adminName || null,
          status: "ACTIVE",
          tenantId: tenant.id,
          password: {
            create: { hash: passwordHash },
          },
        },
      });
    } catch (error) {
      if (error instanceof Error && "code" in error && (error as any).code === "P2002") {
        throw new TenantError("A user with this admin email or username already exists", 409);
      }
      throw error;
    }

    // Assign TENANT_ADMIN role to the new admin user
    if (tenantAdminRole) {
      await prisma.userRole.create({
        data: {
          userId: adminUser.id,
          roleId: tenantAdminRole.id,
          eventId: null,
        },
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      userId: ctx.userId,
      tenantId: tenant.id,
      action: "CREATE",
      entityType: "Tenant",
      entityId: tenant.id,
      description: `Created tenant "${tenant.name}"${adminUser ? ` with admin user "${adminUser.email}"` : ""}`,
      metadata: {
        name: tenant.name,
        subscriptionPlan: tenant.subscriptionPlan,
        ...(adminUser ? { adminEmail: adminUser.email } : {}),
      },
    },
  });

  return tenant;
}

interface UpdateTenantInput {
  name: string;
  slug: string;
  email: string;
  phone: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  subscriptionPlan: string;
  logoUrl?: string;
  brandTheme?: string;
}

export async function updateTenant(id: string, input: UpdateTenantInput, ctx: ServiceContext) {
  const existing = await prisma.tenant.findFirst({ where: { id } });
  if (!existing) {
    throw new TenantError("Tenant not found", 404);
  }

  let tenant;
  try {
    tenant = await prisma.tenant.update({
      where: { id },
      data: {
        name: input.name,
        slug: input.slug,
        email: input.email,
        phone: input.phone,
        website: input.website || "",
        address: input.address || "",
        city: input.city || "",
        state: input.state || "",
        zip: input.zip || "",
        country: input.country || "",
        subscriptionPlan: input.subscriptionPlan,
        logoUrl: input.logoUrl || null,
        brandTheme: input.brandTheme || "",
      },
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as any).code === "P2002") {
      throw new TenantError("A tenant with this name or email already exists", 409);
    }
    throw error;
  }

  await prisma.auditLog.create({
    data: {
      userId: ctx.userId,
      tenantId: tenant.id,
      action: "UPDATE",
      entityType: "Tenant",
      entityId: tenant.id,
      description: `Updated tenant "${tenant.name}"`,
      metadata: { name: tenant.name, subscriptionPlan: tenant.subscriptionPlan },
    },
  });

  return tenant;
}

export async function deleteTenant(id: string, ctx: ServiceContext) {
  const existing = await prisma.tenant.findFirst({
    where: { id },
    include: { _count: { select: { users: true } } },
  });
  if (!existing) {
    throw new TenantError("Tenant not found", 404);
  }

  if (existing._count.users > 0) {
    throw new TenantError(
      `Cannot delete tenant with ${existing._count.users} user(s). Remove all users first.`,
      409,
    );
  }

  await prisma.tenant.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      userId: ctx.userId,
      tenantId: id,
      action: "DELETE",
      entityType: "Tenant",
      entityId: id,
      description: `Deleted tenant "${existing.name}"`,
      metadata: { name: existing.name },
    },
  });
}

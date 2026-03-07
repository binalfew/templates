import { prisma } from "~/utils/db/db.server";
import type { PaginatedQueryOptions, TenantServiceContext } from "~/utils/types.server";
import { ServiceError } from "~/utils/errors/service-error.server";

// Re-export for backward compatibility (canonical source: permissions.server.ts)
export { listPermissions } from "~/services/permissions.server";

export class RoleError extends ServiceError {
  constructor(message: string, status: number) {
    super(message, status);
    this.name = "RoleError";
  }
}

interface ListRolesOptions {
  where?: Record<string, unknown>;
  orderBy?: Array<Record<string, "asc" | "desc">>;
}

export async function listRoles(tenantId: string, options?: ListRolesOptions) {
  return prisma.role.findMany({
    where: {
      tenantId,
      ...(options?.where ?? {}),
    } as any,
    orderBy: options?.orderBy?.length ? (options.orderBy as any) : { name: "asc" },
    include: {
      _count: { select: { userRoles: true, rolePermissions: true } },
    },
  });
}

export async function listRolesPaginated(tenantId: string, options: PaginatedQueryOptions) {
  const where = { tenantId, ...(options.where ?? {}) } as any;
  const orderBy = options.orderBy?.length ? (options.orderBy as any) : { name: "asc" };

  const [items, totalCount] = await Promise.all([
    prisma.role.findMany({
      where,
      orderBy,
      include: { _count: { select: { userRoles: true, rolePermissions: true } } },
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
    }),
    prisma.role.count({ where }),
  ]);

  return { items, totalCount };
}

export async function getRole(id: string, tenantId: string) {
  const role = await prisma.role.findFirst({
    where: { id, tenantId },
    include: {
      rolePermissions: { include: { permission: true } },
    },
  });
  if (!role) {
    throw new RoleError("Role not found", 404);
  }
  return role;
}

export async function getRoleWithCounts(id: string, tenantId: string) {
  const role = await prisma.role.findFirst({
    where: { id, tenantId },
    include: {
      _count: { select: { userRoles: true, rolePermissions: true } },
    },
  });
  if (!role) {
    throw new RoleError("Role not found", 404);
  }
  return role;
}

interface CreateRoleInput {
  name: string;
  description?: string;
}

export async function createRole(input: CreateRoleInput, ctx: TenantServiceContext) {
  let role;
  try {
    role = await prisma.role.create({
      data: {
        tenantId: ctx.tenantId,
        name: input.name,
        description: input.description || null,
      },
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as any).code === "P2002") {
      throw new RoleError("A role with this name already exists", 409);
    }
    throw error;
  }

  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: "CREATE",
      entityType: "Role",
      entityId: role.id,
      description: `Created role "${role.name}"`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { name: role.name },
    },
  });

  return role;
}

interface UpdateRoleInput {
  name: string;
  description?: string;
}

export async function updateRole(id: string, input: UpdateRoleInput, ctx: TenantServiceContext) {
  const existing = await prisma.role.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!existing) {
    throw new RoleError("Role not found", 404);
  }

  let role;
  try {
    role = await prisma.role.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description || null,
      },
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as any).code === "P2002") {
      throw new RoleError("A role with this name already exists", 409);
    }
    throw error;
  }

  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: "UPDATE",
      entityType: "Role",
      entityId: id,
      description: `Updated role "${role.name}"`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: {
        before: { name: existing.name, description: existing.description },
        after: { name: role.name, description: role.description },
      },
    },
  });

  return role;
}

export async function deleteRole(id: string, ctx: TenantServiceContext) {
  const existing = await prisma.role.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: { _count: { select: { userRoles: true, rolePermissions: true } } },
  });
  if (!existing) {
    throw new RoleError("Role not found", 404);
  }

  if (existing._count.userRoles > 0) {
    throw new RoleError(
      `Cannot delete role with ${existing._count.userRoles} assigned user(s). Unassign all users first.`,
      409,
    );
  }

  await prisma.role.update({ where: { id }, data: { deletedAt: new Date() } });

  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: "DELETE",
      entityType: "Role",
      entityId: id,
      description: `Deleted role "${existing.name}"`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { name: existing.name },
    },
  });
}

export async function assignPermissions(
  roleId: string,
  assignments: Array<{ permissionId: string; access?: string }>,
  ctx: TenantServiceContext,
) {
  const existing = await prisma.role.findFirst({
    where: { id: roleId, tenantId: ctx.tenantId },
  });
  if (!existing) {
    throw new RoleError("Role not found", 404);
  }

  await prisma.rolePermission.deleteMany({
    where: { roleId },
  });

  if (assignments.length > 0) {
    await prisma.rolePermission.createMany({
      data: assignments.map((a) => ({
        roleId,
        permissionId: a.permissionId,
        access: a.access ?? "any",
      })),
      skipDuplicates: true,
    });
  }

  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: "UPDATE",
      entityType: "Role",
      entityId: roleId,
      description: `Updated permission assignments for role "${existing.name}"`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { permissionCount: assignments.length },
    },
  });
}


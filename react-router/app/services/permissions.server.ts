import { prisma } from "~/lib/db.server";
import type { PaginatedQueryOptions, TenantServiceContext } from "~/lib/types.server";
import { ServiceError } from "~/lib/service-error.server";

export class PermissionError extends ServiceError {
  constructor(message: string, status: number) {
    super(message, status);
    this.name = "PermissionError";
  }
}

interface ListPermissionsOptions {
  where?: Record<string, unknown>;
  orderBy?: Array<Record<string, "asc" | "desc">>;
}

export async function listPermissions(options?: ListPermissionsOptions) {
  return prisma.permission.findMany({
    where: options?.where as any,
    orderBy: options?.orderBy?.length
      ? (options.orderBy as any)
      : [{ resource: "asc" }, { action: "asc" }],
    include: {
      _count: { select: { rolePermissions: true } },
    },
  });
}

export async function listPermissionsPaginated(options: PaginatedQueryOptions) {
  const where = (options.where as any) ?? {};
  const orderBy = options.orderBy?.length
    ? (options.orderBy as any)
    : [{ resource: "asc" }, { action: "asc" }];

  const [items, totalCount] = await Promise.all([
    prisma.permission.findMany({
      where,
      orderBy,
      include: { _count: { select: { rolePermissions: true } } },
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
    }),
    prisma.permission.count({ where }),
  ]);

  return { items, totalCount };
}

export async function getPermission(id: string) {
  const permission = await prisma.permission.findFirst({
    where: { id },
  });
  if (!permission) {
    throw new PermissionError("Permission not found", 404);
  }
  return permission;
}

export async function getPermissionWithCounts(id: string) {
  const permission = await prisma.permission.findFirst({
    where: { id },
    include: {
      _count: { select: { rolePermissions: true } },
      rolePermissions: {
        include: { role: { select: { id: true, name: true } } },
      },
    },
  });
  if (!permission) {
    throw new PermissionError("Permission not found", 404);
  }
  return permission;
}

interface CreatePermissionInput {
  resource: string;
  action: string;
  description?: string;
}

export async function createPermission(input: CreatePermissionInput, ctx: TenantServiceContext) {
  let permission;
  try {
    permission = await prisma.permission.create({
      data: {
        resource: input.resource,
        action: input.action,
        description: input.description || null,
      },
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as any).code === "P2002") {
      throw new PermissionError("A permission with this resource and action already exists", 409);
    }
    throw error;
  }

  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: "CREATE",
      entityType: "Permission",
      entityId: permission.id,
      description: `Created permission "${permission.resource}:${permission.action}"`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { resource: permission.resource, action: permission.action },
    },
  });

  return permission;
}

interface UpdatePermissionInput {
  description?: string;
}

export async function updatePermission(
  id: string,
  input: UpdatePermissionInput,
  ctx: TenantServiceContext,
) {
  const existing = await prisma.permission.findFirst({ where: { id } });
  if (!existing) {
    throw new PermissionError("Permission not found", 404);
  }

  const permission = await prisma.permission.update({
    where: { id },
    data: {
      description: input.description || null,
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: "UPDATE",
      entityType: "Permission",
      entityId: id,
      description: `Updated permission "${permission.resource}:${permission.action}"`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: {
        before: { description: existing.description },
        after: { description: permission.description },
      },
    },
  });

  return permission;
}

export async function deletePermission(id: string, ctx: TenantServiceContext) {
  const existing = await prisma.permission.findFirst({
    where: { id },
    include: { _count: { select: { rolePermissions: true } } },
  });
  if (!existing) {
    throw new PermissionError("Permission not found", 404);
  }

  if (existing._count.rolePermissions > 0) {
    throw new PermissionError(
      `Cannot delete permission assigned to ${existing._count.rolePermissions} role(s). Unassign from all roles first.`,
      409,
    );
  }

  await prisma.permission.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: "DELETE",
      entityType: "Permission",
      entityId: id,
      description: `Deleted permission "${existing.resource}:${existing.action}"`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { resource: existing.resource, action: existing.action },
    },
  });
}

import { prisma } from "~/utils/db/db.server";
import { hashPassword } from "~/utils/auth/auth.server";
import { createNotification } from "~/services/notifications.server";
import type { PaginatedQueryOptions, TenantServiceContext } from "~/utils/types.server";
import { ServiceError } from "~/utils/errors/service-error.server";

export class UserError extends ServiceError {
  constructor(message: string, status: number) {
    super(message, status);
    this.name = "UserError";
  }
}

interface ListUsersOptions {
  where?: Record<string, unknown>;
  orderBy?: Array<Record<string, "asc" | "desc">>;
}

export async function listUsers(tenantId?: string, options?: ListUsersOptions) {
  return prisma.user.findMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      deletedAt: null,
      ...(options?.where ?? {}),
    } as any,
    orderBy: options?.orderBy?.length ? (options.orderBy as any) : { name: "asc" },
    include: {
      tenant: { select: { name: true, slug: true } },
      userRoles: { where: { eventId: null }, include: { role: true } },
      _count: { select: { sessions: true } },
    },
  });
}

export async function listUsersPaginated(
  tenantId: string | undefined,
  options: PaginatedQueryOptions,
) {
  const where = {
    ...(tenantId ? { tenantId } : {}),
    deletedAt: null,
    ...(options.where ?? {}),
  } as any;
  const orderBy = options.orderBy?.length ? (options.orderBy as any) : { name: "asc" };

  const [items, totalCount] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy,
      include: {
        tenant: { select: { name: true, slug: true } },
        userRoles: { where: { eventId: null }, include: { role: true } },
        _count: { select: { sessions: true } },
      },
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return { items, totalCount };
}

export async function getUser(id: string, tenantId?: string) {
  const user = await prisma.user.findFirst({
    where: { id, ...(tenantId ? { tenantId } : {}), deletedAt: null },
    include: {
      userRoles: { where: { eventId: null }, include: { role: true } },
    },
  });
  if (!user) {
    throw new UserError("User not found", 404);
  }
  return user;
}

export async function getUserWithCounts(id: string, tenantId?: string) {
  const user = await prisma.user.findFirst({
    where: { id, ...(tenantId ? { tenantId } : {}), deletedAt: null },
    include: {
      userRoles: { where: { eventId: null }, include: { role: true } },
      _count: { select: { sessions: true, userRoles: true } },
    },
  });
  if (!user) {
    throw new UserError("User not found", 404);
  }
  return user;
}

interface CreateUserInput {
  email: string;
  username: string;
  name?: string;
  status?: string;
  password: string;
  tenantId?: string;
  extras?: Record<string, unknown>;
}

export async function createUser(input: CreateUserInput, ctx: TenantServiceContext) {
  const passwordHash = await hashPassword(input.password);
  const targetTenantId = input.tenantId || ctx.tenantId;

  let user;
  try {
    user = await prisma.user.create({
      data: {
        email: input.email,
        username: input.username,
        name: input.name || null,
        status: (input.status as any) ?? "ACTIVE",
        tenantId: targetTenantId,
        extras: (input.extras ?? {}) as any,
        password: {
          create: { hash: passwordHash },
        },
      },
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as any).code === "P2002") {
      throw new UserError("A user with this email or username already exists", 409);
    }
    throw error;
  }

  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: "CREATE",
      entityType: "User",
      entityId: user.id,
      description: `Created user "${user.email}" (${user.username})`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { email: user.email, username: user.username },
    },
  });

  return user;
}

interface UpdateUserInput {
  email: string;
  username: string;
  name?: string;
  status?: string;
  extras?: Record<string, unknown>;
}

export async function updateUser(id: string, input: UpdateUserInput, ctx: TenantServiceContext) {
  const existing = await prisma.user.findFirst({
    where: { id, ...(ctx.isSuperAdmin ? {} : { tenantId: ctx.tenantId }), deletedAt: null },
  });
  if (!existing) {
    throw new UserError("User not found", 404);
  }

  let user;
  try {
    user = await prisma.user.update({
      where: { id },
      data: {
        email: input.email,
        username: input.username,
        name: input.name || null,
        status: (input.status as any) ?? existing.status,
        ...(input.extras !== undefined ? { extras: input.extras as any } : {}),
      },
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as any).code === "P2002") {
      throw new UserError("A user with this email or username already exists", 409);
    }
    throw error;
  }

  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: "UPDATE",
      entityType: "User",
      entityId: id,
      description: `Updated user "${user.email}" (${user.username})`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: {
        before: { email: existing.email, username: existing.username, status: existing.status },
        after: { email: user.email, username: user.username, status: user.status },
      },
    },
  });

  return user;
}

export async function deleteUser(id: string, ctx: TenantServiceContext) {
  const existing = await prisma.user.findFirst({
    where: { id, ...(ctx.isSuperAdmin ? {} : { tenantId: ctx.tenantId }), deletedAt: null },
    include: { _count: { select: { sessions: true, userRoles: true } } },
  });
  if (!existing) {
    throw new UserError("User not found", 404);
  }

  if (existing.id === ctx.userId) {
    throw new UserError("You cannot delete your own account", 409);
  }

  const globalRole = await prisma.userRole.findFirst({
    where: {
      userId: id,
      role: { scope: "GLOBAL" },
    },
    select: { role: { select: { name: true } } },
  });
  if (globalRole) {
    throw new UserError(
      `Cannot delete a system administrator. Remove the "${globalRole.role.name}" role first.`,
      403,
    );
  }

  await prisma.user.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: "DELETE",
      entityType: "User",
      entityId: id,
      description: `Soft-deleted user "${existing.email}" (${existing.username})`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { email: existing.email, username: existing.username },
    },
  });
}

export async function changePassword(id: string, password: string, ctx: TenantServiceContext) {
  const existing = await prisma.user.findFirst({
    where: { id, ...(ctx.isSuperAdmin ? {} : { tenantId: ctx.tenantId }), deletedAt: null },
  });
  if (!existing) {
    throw new UserError("User not found", 404);
  }

  const passwordHash = await hashPassword(password);

  await prisma.password.upsert({
    where: { userId: id },
    update: { hash: passwordHash },
    create: { userId: id, hash: passwordHash },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: "UPDATE",
      entityType: "User",
      entityId: id,
      description: `Changed password for user "${existing.email}"`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { email: existing.email },
    },
  });
}

export async function assignRoles(userId: string, roleIds: string[], ctx: TenantServiceContext) {
  const existing = await prisma.user.findFirst({
    where: { id: userId, ...(ctx.isSuperAdmin ? {} : { tenantId: ctx.tenantId }), deletedAt: null },
  });
  if (!existing) {
    throw new UserError("User not found", 404);
  }

  if (roleIds.length > 0 && !ctx.isSuperAdmin) {
    const validRoles = await prisma.role.count({
      where: { id: { in: roleIds }, tenantId: ctx.tenantId },
    });
    if (validRoles !== roleIds.length) {
      throw new UserError("One or more roles do not belong to this tenant", 403);
    }
  }

  await prisma.userRole.deleteMany({
    where: { userId, eventId: null, ...(ctx.isSuperAdmin ? {} : { role: { tenantId: ctx.tenantId } }) },
  });

  if (roleIds.length > 0) {
    await prisma.userRole.createMany({
      data: roleIds.map((roleId) => ({
        userId,
        roleId,
        eventId: null,
      })),
      skipDuplicates: true,
    });
  }

  const assignedRoles = roleIds.length > 0
    ? await prisma.role.findMany({ where: { id: { in: roleIds } }, select: { name: true } })
    : [];
  const roleNames = assignedRoles.map((r) => r.name).join(", ");

  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: "UPDATE",
      entityType: "User",
      entityId: userId,
      description: `Updated role assignments for user "${existing.email}"`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { roleIds },
    },
  });

  await createNotification({
    userId,
    tenantId: ctx.tenantId,
    type: "role_assigned",
    title: "Roles updated",
    message: roleNames
      ? `You have been assigned the following roles: ${roleNames}`
      : "All your roles have been removed",
  });
}

export async function getUserRoles(userId: string) {
  return prisma.userRole.findMany({
    where: { userId, eventId: null },
    include: { role: true },
  });
}

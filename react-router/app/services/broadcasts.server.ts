import { prisma } from "~/lib/db/db.server";
import { logger } from "~/lib/monitoring/logger.server";
import type { CreateBroadcastInput, UpdateBroadcastInput, AudienceFilter } from "~/lib/schemas/broadcast";
import type { PaginatedQueryOptions, TenantServiceContext } from "~/lib/types.server";
import { ServiceError } from "~/lib/errors/service-error.server";

// ─── Types ────────────────────────────────────────────────

export class BroadcastError extends ServiceError {
  constructor(message: string, code: string = "BROADCAST_ERROR", status: number = 400) {
    super(message, status, code);
    this.name = "BroadcastError";
  }
}

interface ListBroadcastsOptions {
  status?: string;
  channel?: string;
  page?: number;
  perPage?: number;
}

// ─── Audience Resolution ─────────────────────────────────

/**
 * Generic audience resolution: filters users by role membership and status.
 * Returns users matching the given audience filters for the tenant.
 */
async function resolveAudience(
  tenantId: string,
  filters: AudienceFilter,
): Promise<Array<{ id: string; email: string | null; name: string | null }>> {
  const where: Record<string, unknown> = { tenantId, deletedAt: null };

  if (filters.roles && filters.roles.length > 0) {
    where.userRoles = {
      some: {
        role: { name: { in: filters.roles } },
      },
    };
  }

  if (filters.statuses && filters.statuses.length > 0) {
    where.status = { in: filters.statuses };
  }

  const users = await prisma.user.findMany({
    where: where as any,
    select: { id: true, email: true, name: true },
  });

  return users;
}

// ─── Broadcast CRUD ──────────────────────────────────────

export async function createBroadcast(input: CreateBroadcastInput, ctx: TenantServiceContext) {
  const broadcast = await prisma.broadcastMessage.create({
    data: {
      tenantId: ctx.tenantId,
      templateId: input.templateId,
      subject: input.subject,
      body: input.body,
      channel: input.channel,
      status: "DRAFT",
      filters: input.filters as any,
      scheduledAt: input.scheduledAt,
      createdBy: ctx.userId,
    },
  });

  logger.info({ broadcastId: broadcast.id, channel: broadcast.channel }, "Broadcast created");

  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: "CREATE",
      entityType: "BroadcastMessage",
      entityId: broadcast.id,
      description: `Created broadcast "${broadcast.subject ?? "(no subject)"}" (${broadcast.channel})`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    },
  });

  return broadcast;
}

export async function listBroadcastsPaginated(
  tenantId: string,
  options: PaginatedQueryOptions,
) {
  const where = { tenantId, ...(options.where ?? {}) } as any;
  const orderBy = options.orderBy?.length ? (options.orderBy as any) : { createdAt: "desc" };

  const [items, totalCount] = await Promise.all([
    prisma.broadcastMessage.findMany({
      where,
      orderBy,
      include: { template: { select: { name: true } } },
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
    }),
    prisma.broadcastMessage.count({ where }),
  ]);

  return { items, totalCount };
}

export async function listBroadcasts(
  tenantId: string,
  options: ListBroadcastsOptions = {},
) {
  const page = options.page ?? 1;
  const perPage = options.perPage ?? 20;
  const skip = (page - 1) * perPage;

  const where: Record<string, unknown> = { tenantId };
  if (options.status) where.status = options.status;
  if (options.channel) where.channel = options.channel;

  const [broadcasts, total] = await Promise.all([
    prisma.broadcastMessage.findMany({
      where: where as any,
      include: { template: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
    }),
    prisma.broadcastMessage.count({ where: where as any }),
  ]);

  return {
    broadcasts,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  };
}

export async function getBroadcast(id: string, tenantId: string) {
  const broadcast = await prisma.broadcastMessage.findFirst({
    where: { id, tenantId },
    include: {
      template: { select: { name: true } },
    },
  });

  if (!broadcast) {
    throw new BroadcastError("Broadcast not found", "NOT_FOUND", 404);
  }

  // Get delivery stats
  const stats = await prisma.messageDelivery.groupBy({
    by: ["status"],
    where: { broadcastId: id },
    _count: true,
  });

  const deliveryStats: Record<string, number> = {};
  for (const s of stats) {
    deliveryStats[s.status] = s._count;
  }

  return { ...broadcast, deliveryStats };
}

export async function getBroadcastDeliveries(
  broadcastId: string,
  tenantId: string,
  page = 1,
  perPage = 20,
) {
  // Verify ownership
  const broadcast = await prisma.broadcastMessage.findFirst({
    where: { id: broadcastId, tenantId },
    select: { id: true },
  });
  if (!broadcast) {
    throw new BroadcastError("Broadcast not found", "NOT_FOUND", 404);
  }

  const skip = (page - 1) * perPage;

  const [deliveries, total] = await Promise.all([
    prisma.messageDelivery.findMany({
      where: { broadcastId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
    }),
    prisma.messageDelivery.count({ where: { broadcastId } }),
  ]);

  return {
    deliveries,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  };
}

export async function getBroadcastWithCounts(id: string, tenantId: string) {
  const broadcast = await prisma.broadcastMessage.findFirst({
    where: { id, tenantId },
    include: {
      template: { select: { name: true } },
      _count: { select: { deliveries: true } },
    },
  });

  if (!broadcast) {
    throw new BroadcastError("Broadcast not found", "NOT_FOUND", 404);
  }

  return broadcast;
}

export async function updateBroadcast(
  id: string,
  input: UpdateBroadcastInput,
  ctx: TenantServiceContext,
) {
  const broadcast = await prisma.broadcastMessage.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });

  if (!broadcast) {
    throw new BroadcastError("Broadcast not found", "NOT_FOUND", 404);
  }

  if (broadcast.status !== "DRAFT") {
    throw new BroadcastError(
      "Only draft broadcasts can be edited",
      "INVALID_STATUS",
    );
  }

  const updated = await prisma.broadcastMessage.update({
    where: { id },
    data: {
      subject: input.subject,
      body: input.body,
      channel: input.channel,
      templateId: input.templateId || null,
    },
  });

  logger.info({ broadcastId: id }, "Broadcast updated");

  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: "UPDATE",
      entityType: "BroadcastMessage",
      entityId: id,
      description: `Updated broadcast "${updated.subject ?? "(no subject)"}"`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    },
  });

  return updated;
}

export async function deleteBroadcast(id: string, ctx: TenantServiceContext) {
  const broadcast = await prisma.broadcastMessage.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });

  if (!broadcast) {
    throw new BroadcastError("Broadcast not found", "NOT_FOUND", 404);
  }

  if (broadcast.status === "SENDING") {
    throw new BroadcastError(
      "Cannot delete a broadcast that is currently sending",
      "INVALID_STATUS",
    );
  }

  // Delete associated deliveries first
  await prisma.messageDelivery.deleteMany({ where: { broadcastId: id } });

  await prisma.broadcastMessage.delete({ where: { id } });

  logger.info({ broadcastId: id }, "Broadcast deleted");

  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: "DELETE",
      entityType: "BroadcastMessage",
      entityId: id,
      description: `Deleted broadcast "${broadcast.subject ?? "(no subject)"}"`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    },
  });
}

// ─── Broadcast Actions ───────────────────────────────────

export async function sendBroadcast(id: string, ctx: TenantServiceContext) {
  const broadcast = await prisma.broadcastMessage.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });

  if (!broadcast) {
    throw new BroadcastError("Broadcast not found", "NOT_FOUND", 404);
  }

  if (broadcast.status !== "DRAFT" && broadcast.status !== "SCHEDULED") {
    throw new BroadcastError(
      `Cannot send a broadcast with status ${broadcast.status}`,
      "INVALID_STATUS",
    );
  }

  // 1. Set status to SENDING
  await prisma.broadcastMessage.update({
    where: { id },
    data: { status: "SENDING", sentAt: new Date() },
  });

  // 2. Resolve audience from filters
  const filters = (broadcast.filters as unknown as AudienceFilter) ?? {};
  const contacts = await resolveAudience(ctx.tenantId, filters);

  // 3. Set recipientCount
  await prisma.broadcastMessage.update({
    where: { id },
    data: { recipientCount: contacts.length },
  });

  // 4. Create MessageDelivery records in batches of 100
  const BATCH_SIZE = 100;
  for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
    const batch = contacts.slice(i, i + BATCH_SIZE);
    await prisma.messageDelivery.createMany({
      data: batch.map((contact) => ({
        broadcastId: id,
        userId: contact.id,
        channel: broadcast.channel,
        recipient: getRecipient(contact, broadcast.channel),
        status: "QUEUED" as const,
      })),
    });
  }

  logger.info({ broadcastId: id, recipientCount: contacts.length }, "Broadcast deliveries queued");

  return prisma.broadcastMessage.findFirst({ where: { id } });
}

export async function cancelBroadcast(id: string, reason: string | undefined, ctx: TenantServiceContext) {
  const broadcast = await prisma.broadcastMessage.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });

  if (!broadcast) {
    throw new BroadcastError("Broadcast not found", "NOT_FOUND", 404);
  }

  if (broadcast.status !== "SENDING" && broadcast.status !== "SCHEDULED") {
    throw new BroadcastError(
      `Cannot cancel a broadcast with status ${broadcast.status}`,
      "INVALID_STATUS",
    );
  }

  // Cancel remaining QUEUED deliveries
  await prisma.messageDelivery.updateMany({
    where: { broadcastId: id, status: "QUEUED" },
    data: { status: "FAILED", errorMessage: "Broadcast cancelled" },
  });

  const updated = await prisma.broadcastMessage.update({
    where: { id },
    data: {
      status: "CANCELLED",
      cancelledBy: ctx.userId,
    },
  });

  logger.info({ broadcastId: id, reason }, "Broadcast cancelled");

  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: "UPDATE",
      entityType: "BroadcastMessage",
      entityId: id,
      description: `Cancelled broadcast "${broadcast.subject ?? id}"`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    },
  });

  return updated;
}

// ─── Helpers ─────────────────────────────────────────────

function getRecipient(
  contact: { email: string | null; name: string | null },
  channel: string,
): string {
  switch (channel) {
    case "EMAIL":
      return contact.email ?? "";
    case "IN_APP":
      return contact.email ?? "";
    case "SMS":
      return ""; // SMS stub — no phone field yet
    case "PUSH":
      return ""; // Push stub — no device token yet
    default:
      return contact.email ?? "";
  }
}

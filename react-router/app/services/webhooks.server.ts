import crypto from "node:crypto";
import { prisma } from "~/utils/db/db.server";
import { logger } from "~/utils/monitoring/logger.server";
import { ServiceError } from "~/utils/errors/service-error.server";
import { validateEventTypes } from "~/utils/events/webhook-events";
import { deliverWebhook } from "~/services/webhook-delivery.server";
import type { TenantServiceContext } from "~/utils/types.server";

// ─── Types ────────────────────────────────────────────────

export class WebhookError extends ServiceError {
  constructor(message: string, status: number) {
    super(message, status);
    this.name = "WebhookError";
  }
}

interface CreateWebhookInput {
  url: string;
  description?: string;
  events: string[];
  headers?: Record<string, string>;
}

interface UpdateWebhookInput {
  url?: string;
  description?: string;
  events?: string[];
  headers?: Record<string, string>;
}

interface ListWebhookFilters {
  status?: "ACTIVE" | "PAUSED" | "DISABLED" | "SUSPENDED";
  search?: string;
  page?: number;
  pageSize?: number;
}

interface DeliveryLogFilters {
  status?: "PENDING" | "DELIVERED" | "FAILED" | "RETRYING" | "DEAD_LETTER";
  page?: number;
  pageSize?: number;
}

// ─── Service Functions ────────────────────────────────────

export async function createWebhookSubscription(input: CreateWebhookInput, ctx: TenantServiceContext) {
  const validation = validateEventTypes(input.events);
  if (!validation.valid) {
    throw new WebhookError(`Invalid event types: ${validation.invalid.join(", ")}`, 400);
  }

  const secret = crypto.randomBytes(32).toString("hex");

  const subscription = await prisma.webhookSubscription.create({
    data: {
      tenantId: ctx.tenantId,
      url: input.url,
      description: input.description,
      events: input.events,
      secret,
      headers: input.headers ?? undefined,
      createdBy: ctx.userId,
    },
  });

  logger.info({ subscriptionId: subscription.id }, "Webhook subscription created");

  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: "CREATE",
      entityType: "WebhookSubscription",
      entityId: subscription.id,
      description: `Created webhook subscription for ${input.url}`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { url: input.url, events: input.events },
    },
  });

  return { subscription, secret };
}

export async function getWebhookSubscriptionWithCounts(id: string, tenantId: string) {
  const subscription = await prisma.webhookSubscription.findFirst({
    where: { id, tenantId },
    select: {
      id: true,
      url: true,
      description: true,
      events: true,
      secret: true,
      status: true,
      version: true,
      maxRetries: true,
      retryBackoffMs: true,
      timeoutMs: true,
      consecutiveFailures: true,
      circuitBreakerOpen: true,
      circuitBreakerResetAt: true,
      headers: true,
      metadata: true,
      createdBy: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { deliveries: true } },
    },
  });
  if (!subscription) {
    throw new WebhookError("Webhook subscription not found", 404);
  }
  return subscription;
}

export async function listWebhookSubscriptions(tenantId: string, filters?: ListWebhookFilters) {
  const page = filters?.page ?? 1;
  const pageSize = Math.min(filters?.pageSize ?? 20, 100);
  const skip = (page - 1) * pageSize;

  const where: any = {
    tenantId,
    ...(filters?.status && { status: filters.status }),
    ...(filters?.search && {
      OR: [
        { url: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    prisma.webhookSubscription.findMany({
      where,
      select: {
        id: true,
        url: true,
        description: true,
        events: true,
        status: true,
        version: true,
        maxRetries: true,
        timeoutMs: true,
        consecutiveFailures: true,
        circuitBreakerOpen: true,
        circuitBreakerResetAt: true,
        headers: true,
        metadata: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.webhookSubscription.count({ where }),
  ]);

  return {
    items,
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

export async function getWebhookSubscription(id: string, tenantId: string) {
  return prisma.webhookSubscription.findFirst({
    where: { id, tenantId },
    select: {
      id: true,
      url: true,
      description: true,
      events: true,
      secret: true,
      status: true,
      version: true,
      maxRetries: true,
      retryBackoffMs: true,
      timeoutMs: true,
      consecutiveFailures: true,
      circuitBreakerOpen: true,
      circuitBreakerResetAt: true,
      headers: true,
      metadata: true,
      createdBy: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function updateWebhookSubscription(
  id: string,
  input: UpdateWebhookInput,
  ctx: TenantServiceContext,
) {
  const existing = await prisma.webhookSubscription.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });
  if (!existing) {
    throw new WebhookError("Webhook subscription not found", 404);
  }
  if (existing.status !== "ACTIVE" && existing.status !== "PAUSED") {
    throw new WebhookError("Cannot update a disabled or suspended subscription", 400);
  }

  if (input.events) {
    const validation = validateEventTypes(input.events);
    if (!validation.valid) {
      throw new WebhookError(`Invalid event types: ${validation.invalid.join(", ")}`, 400);
    }
  }

  const subscription = await prisma.webhookSubscription.update({
    where: { id },
    data: {
      ...(input.url !== undefined && { url: input.url }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.events !== undefined && { events: input.events }),
      ...(input.headers !== undefined && { headers: input.headers }),
    },
  });

  logger.info({ subscriptionId: id }, "Webhook subscription updated");

  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: "CONFIGURE",
      entityType: "WebhookSubscription",
      entityId: id,
      description: `Updated webhook subscription for ${subscription.url}`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: JSON.parse(JSON.stringify(input)),
    },
  });

  return subscription;
}

export async function deleteWebhookSubscription(id: string, ctx: TenantServiceContext) {
  const existing = await prisma.webhookSubscription.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });
  if (!existing) {
    throw new WebhookError("Webhook subscription not found", 404);
  }

  await prisma.webhookSubscription.update({ where: { id }, data: { deletedAt: new Date() } });

  logger.info({ subscriptionId: id }, "Webhook subscription deleted");

  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: "DELETE",
      entityType: "WebhookSubscription",
      entityId: id,
      description: `Deleted webhook subscription for ${existing.url}`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { url: existing.url },
    },
  });
}

export async function pauseWebhookSubscription(id: string, ctx: TenantServiceContext) {
  const existing = await prisma.webhookSubscription.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });
  if (!existing) {
    throw new WebhookError("Webhook subscription not found", 404);
  }
  if (existing.status !== "ACTIVE") {
    throw new WebhookError("Can only pause an active subscription", 400);
  }

  const subscription = await prisma.webhookSubscription.update({
    where: { id },
    data: { status: "PAUSED" },
  });

  logger.info({ subscriptionId: id }, "Webhook subscription paused");

  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: "CONFIGURE",
      entityType: "WebhookSubscription",
      entityId: id,
      description: `Paused webhook subscription for ${existing.url}`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { action: "pause" },
    },
  });

  return subscription;
}

export async function resumeWebhookSubscription(id: string, ctx: TenantServiceContext) {
  const existing = await prisma.webhookSubscription.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });
  if (!existing) {
    throw new WebhookError("Webhook subscription not found", 404);
  }
  if (existing.status !== "PAUSED") {
    throw new WebhookError("Can only resume a paused subscription", 400);
  }

  const subscription = await prisma.webhookSubscription.update({
    where: { id },
    data: {
      status: "ACTIVE",
      consecutiveFailures: 0,
      circuitBreakerOpen: false,
      circuitBreakerResetAt: null,
    },
  });

  logger.info({ subscriptionId: id }, "Webhook subscription resumed");

  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: "CONFIGURE",
      entityType: "WebhookSubscription",
      entityId: id,
      description: `Resumed webhook subscription for ${existing.url}`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { action: "resume" },
    },
  });

  return subscription;
}

export async function testWebhookEndpoint(id: string, ctx: TenantServiceContext) {
  const existing = await prisma.webhookSubscription.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });
  if (!existing) {
    throw new WebhookError("Webhook subscription not found", 404);
  }

  const delivery = await prisma.webhookDelivery.create({
    data: {
      tenantId: ctx.tenantId,
      subscriptionId: id,
      eventType: "test.ping",
      eventId: crypto.randomUUID(),
      payload: {
        message: "This is a test webhook delivery",
        timestamp: new Date().toISOString(),
      },
      maxAttempts: 1,
    },
  });

  const result = await deliverWebhook(delivery.id);

  return result;
}

export async function getDeliveryLog(
  subscriptionId: string,
  tenantId: string,
  filters?: DeliveryLogFilters,
) {
  const page = filters?.page ?? 1;
  const pageSize = Math.min(filters?.pageSize ?? 20, 100);
  const skip = (page - 1) * pageSize;

  const where = {
    subscriptionId,
    tenantId,
    ...(filters?.status && { status: filters.status }),
  };

  const [items, total] = await Promise.all([
    prisma.webhookDelivery.findMany({
      where,
      select: {
        id: true,
        eventType: true,
        eventId: true,
        status: true,
        attempts: true,
        maxAttempts: true,
        responseCode: true,
        latencyMs: true,
        errorMessage: true,
        deliveredAt: true,
        nextRetryAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.webhookDelivery.count({ where }),
  ]);

  return {
    items,
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

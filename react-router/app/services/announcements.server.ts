import { prisma } from "~/utils/db/db.server";
import { logger } from "~/utils/monitoring/logger.server";
import { ServiceError } from "~/utils/errors/service-error.server";
import type { TenantServiceContext } from "~/utils/types.server";

// ─── Types ────────────────────────────────────────────────

export class AnnouncementError extends ServiceError {
  constructor(message: string, status: number) {
    super(message, status);
    this.name = "AnnouncementError";
  }
}

interface CreateAnnouncementInput {
  title: string;
  message: string;
  type?: "INFO" | "WARNING" | "CRITICAL";
  active?: boolean;
  dismissible?: boolean;
  startsAt?: Date;
  endsAt?: Date | null;
}

interface UpdateAnnouncementInput {
  title?: string;
  message?: string;
  type?: "INFO" | "WARNING" | "CRITICAL";
  active?: boolean;
  dismissible?: boolean;
  startsAt?: Date;
  endsAt?: Date | null;
}

interface ListAnnouncementFilters {
  search?: string;
  page?: number;
  pageSize?: number;
}

// ─── Service Functions ────────────────────────────────────

export async function listAnnouncements(tenantId: string, filters?: ListAnnouncementFilters) {
  const page = filters?.page ?? 1;
  const pageSize = Math.min(filters?.pageSize ?? 20, 100);
  const skip = (page - 1) * pageSize;

  const where: any = {
    tenantId,
    ...(filters?.search && {
      OR: [
        { title: { contains: filters.search, mode: "insensitive" } },
        { message: { contains: filters.search, mode: "insensitive" } },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    prisma.announcement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.announcement.count({ where }),
  ]);

  return {
    items,
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

export async function getAnnouncement(id: string, tenantId: string) {
  const announcement = await prisma.announcement.findFirst({
    where: { id, tenantId },
  });
  if (!announcement) {
    throw new AnnouncementError("Announcement not found", 404);
  }
  return announcement;
}

export async function createAnnouncement(input: CreateAnnouncementInput, ctx: TenantServiceContext) {
  const announcement = await prisma.announcement.create({
    data: {
      tenantId: ctx.tenantId,
      title: input.title,
      message: input.message,
      type: input.type ?? "INFO",
      active: input.active ?? true,
      dismissible: input.dismissible ?? true,
      startsAt: input.startsAt ?? new Date(),
      endsAt: input.endsAt ?? null,
      createdBy: ctx.userId,
    },
  });

  logger.info({ announcementId: announcement.id }, "Announcement created");

  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: "CREATE",
      entityType: "Announcement",
      entityId: announcement.id,
      description: `Created announcement "${input.title}"`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { title: input.title, type: input.type ?? "INFO" },
    },
  });

  return announcement;
}

export async function updateAnnouncement(
  id: string,
  input: UpdateAnnouncementInput,
  ctx: TenantServiceContext,
) {
  const existing = await prisma.announcement.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });
  if (!existing) {
    throw new AnnouncementError("Announcement not found", 404);
  }

  const announcement = await prisma.announcement.update({
    where: { id },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.message !== undefined && { message: input.message }),
      ...(input.type !== undefined && { type: input.type }),
      ...(input.active !== undefined && { active: input.active }),
      ...(input.dismissible !== undefined && { dismissible: input.dismissible }),
      ...(input.startsAt !== undefined && { startsAt: input.startsAt }),
      ...(input.endsAt !== undefined && { endsAt: input.endsAt }),
    },
  });

  logger.info({ announcementId: id }, "Announcement updated");

  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: "CONFIGURE",
      entityType: "Announcement",
      entityId: id,
      description: `Updated announcement "${announcement.title}"`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: JSON.parse(JSON.stringify(input)),
    },
  });

  return announcement;
}

export async function deleteAnnouncement(id: string, ctx: TenantServiceContext) {
  const existing = await prisma.announcement.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });
  if (!existing) {
    throw new AnnouncementError("Announcement not found", 404);
  }

  await prisma.announcement.delete({ where: { id } });

  logger.info({ announcementId: id }, "Announcement deleted");

  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: "DELETE",
      entityType: "Announcement",
      entityId: id,
      description: `Deleted announcement "${existing.title}"`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { title: existing.title },
    },
  });
}

export async function getActiveAnnouncements(tenantId: string, userId: string) {
  const now = new Date();

  const announcements = await prisma.announcement.findMany({
    where: {
      active: true,
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      AND: [{ OR: [{ tenantId }, { tenantId: null }] }],
      dismissals: {
        none: { userId },
      },
    },
    orderBy: [
      { type: "desc" }, // CRITICAL first
      { createdAt: "desc" },
    ],
  });

  return announcements;
}

export async function dismissAnnouncement(announcementId: string, userId: string) {
  await prisma.announcementDismissal.upsert({
    where: {
      announcementId_userId: { announcementId, userId },
    },
    create: {
      announcementId,
      userId,
    },
    update: {},
  });
}

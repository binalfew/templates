import { prisma } from "~/lib/db.server";
import { logger } from "~/lib/logger.server";

/**
 * Soft-delete a user by setting their `deletedAt` timestamp.
 * Also invalidates all active sessions for the user.
 */
export async function softDeleteUser(userId: string, deletedBy?: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { deletedAt: new Date() },
  });

  // Invalidate all sessions so the user is logged out everywhere
  await prisma.session.deleteMany({
    where: { userId },
  });

  logger.info({ userId, deletedBy }, "User soft-deleted, sessions invalidated");
}

/**
 * Restore a previously soft-deleted user by clearing their `deletedAt` timestamp.
 */
export async function restoreUser(userId: string, restoredBy?: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { deletedAt: null },
  });

  logger.info({ userId, restoredBy }, "User restored");
}

/**
 * Check whether an entity has been soft-deleted.
 */
export function isDeleted(entity: { deletedAt: Date | null }): boolean {
  return entity.deletedAt !== null;
}

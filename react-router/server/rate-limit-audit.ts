import type { Request, Response } from "express";
import { prisma } from "~/lib/db.server";

export interface ViolationContext {
  userId: string | null;
  ip: string;
  path: string;
  method: string;
  tier: string;
  limit: number;
  userAgent: string;
}

export function extractViolationContext(
  req: Request,
  res: Response,
  tier: string,
  limit: number,
): ViolationContext {
  return {
    userId: (res.locals.userId as string) || null,
    ip: req.ip || req.socket.remoteAddress || "unknown",
    path: req.path,
    method: req.method,
    tier,
    limit,
    userAgent: req.headers["user-agent"] || "",
  };
}

export function logRateLimitViolation(context: ViolationContext): void {
  prisma.auditLog
    .create({
      data: {
        userId: context.userId,
        tenantId: "system",
        action: "RATE_LIMIT",
        entityType: "RateLimit",
        entityId: context.tier,
        metadata: {
          ip: context.ip,
          path: context.path,
          method: context.method,
          tier: context.tier,
          limit: context.limit,
        },
        ipAddress: context.ip,
        userAgent: context.userAgent,
      },
    })
    .catch(() => {
      // Fire-and-forget: swallow errors to avoid crashing the request
    });
}

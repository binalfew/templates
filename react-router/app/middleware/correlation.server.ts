import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "node:crypto";
import { logger } from "~/lib/logger.server";

export interface RequestContext {
  correlationId: string;
  tenantId?: string;
  userId?: string;
  requestPath: string;
}

export const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

export function getCorrelationId(): string {
  return asyncLocalStorage.getStore()?.correlationId ?? "no-correlation-id";
}

export function getRequestLogger() {
  const context = getRequestContext();
  if (context) {
    return logger.child({ correlationId: context.correlationId });
  }
  return logger;
}

export function correlationMiddleware(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction,
) {
  const correlationId =
    (req.headers["x-correlation-id"] as string) ||
    (req.headers["x-request-id"] as string) ||
    crypto.randomUUID();

  const context: RequestContext = {
    correlationId,
    requestPath: req.path,
  };

  res.setHeader("x-correlation-id", correlationId);

  asyncLocalStorage.run(context, () => {
    next();
  });
}

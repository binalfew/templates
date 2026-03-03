import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "node:crypto";

/** @typedef {{ correlationId: string; tenantId?: string; userId?: string; requestPath: string }} RequestContext */

export const asyncLocalStorage = new AsyncLocalStorage();

/** @returns {RequestContext | undefined} */
export function getRequestContext() {
  return asyncLocalStorage.getStore();
}

/** @returns {string} */
export function getCorrelationId() {
  return asyncLocalStorage.getStore()?.correlationId ?? "no-correlation-id";
}

/**
 * Express middleware that attaches a correlation ID to each request.
 * Reads from incoming x-correlation-id or x-request-id headers, or generates a new UUID.
 * Stores the context in AsyncLocalStorage for downstream access.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export function correlationMiddleware(req, res, next) {
  const rawId = req.headers["x-correlation-id"] || req.headers["x-request-id"];
  const correlationId = (Array.isArray(rawId) ? rawId[0] : rawId) || crypto.randomUUID();

  /** @type {RequestContext} */
  const context = {
    correlationId,
    requestPath: req.path,
  };

  res.setHeader("x-correlation-id", correlationId);

  asyncLocalStorage.run(context, () => {
    next();
  });
}

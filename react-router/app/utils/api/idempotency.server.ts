import { prisma } from "~/utils/db/db.server";
import { jsonError } from "~/utils/api-response.server";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Check for an existing idempotency key and return the cached response if found.
 * Returns null if no cached response exists (caller should proceed with the request).
 */
export async function checkIdempotencyKey(
  request: Request,
  tenantId: string,
): Promise<Response | null> {
  const key = request.headers.get("Idempotency-Key");
  if (!key) return null; // No idempotency key — proceed normally

  const existing = await prisma.idempotencyKey.findUnique({
    where: { key_tenantId: { key, tenantId } },
  });

  if (existing) {
    if (existing.expiresAt < new Date()) {
      // Expired — delete and proceed as new request
      await prisma.idempotencyKey.delete({ where: { id: existing.id } }).catch(() => {});
      return null;
    }
    // Replay the cached response
    return new Response(existing.responseBody, {
      status: existing.statusCode,
      headers: { "Content-Type": "application/json" },
    });
  }

  return null;
}

/**
 * Store the response for an idempotency key so future retries get the same result.
 */
export async function storeIdempotencyKey(
  request: Request,
  tenantId: string,
  response: Response,
): Promise<void> {
  const key = request.headers.get("Idempotency-Key");
  if (!key) return; // No idempotency key — nothing to store

  const url = new URL(request.url);
  const body = await response.clone().text();

  await prisma.idempotencyKey
    .create({
      data: {
        key,
        tenantId,
        method: request.method,
        path: url.pathname,
        statusCode: response.status,
        responseBody: body,
        expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
      },
    })
    .catch(() => {
      // Best-effort — if storage fails (e.g., duplicate race), the request still succeeds
    });
}

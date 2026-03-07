import { validateApiKey, trackApiKeyUsage } from "~/services/api-keys.server";

export interface ApiAuthResult {
  tenantId: string;
  apiKeyId: string;
  permissions: string[];
}

// --- Per-API-key sliding window rate limiter ---

const WINDOW_MS = 60_000; // 1 minute

const DEFAULT_LIMITS: Record<string, number> = {
  STANDARD: 100,
  ELEVATED: 500,
  PREMIUM: 2000,
  CUSTOM: 100, // fallback if rateLimitCustom is null
};

// Map of apiKeyId → array of request timestamps within the window
const requestWindows = new Map<string, number[]>();

function checkRateLimit(apiKeyId: string, tier: string, custom: number | null): void {
  const limit = custom ?? DEFAULT_LIMITS[tier] ?? 100;
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  let timestamps = requestWindows.get(apiKeyId);
  if (!timestamps) {
    timestamps = [];
    requestWindows.set(apiKeyId, timestamps);
  }

  // Remove expired entries
  const firstValid = timestamps.findIndex((t) => t > windowStart);
  if (firstValid > 0) timestamps.splice(0, firstValid);
  else if (firstValid === -1) timestamps.length = 0;

  if (timestamps.length >= limit) {
    const retryAfter = Math.ceil((timestamps[0] + WINDOW_MS - now) / 1000);
    throw new Response(
      JSON.stringify({
        error: {
          code: "RATE_LIMITED",
          message: `Rate limit exceeded. Limit: ${limit} requests/min.`,
          retryAfter,
        },
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil((timestamps[0] + WINDOW_MS) / 1000)),
        },
      },
    );
  }

  timestamps.push(now);
}

// Periodically clean up stale entries to prevent memory leaks
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [key, timestamps] of requestWindows) {
    const valid = timestamps.filter((t) => t > cutoff);
    if (valid.length === 0) requestWindows.delete(key);
    else requestWindows.set(key, valid);
  }
}, 5 * 60_000).unref();

// --- Auth functions ---

export async function apiAuth(request: Request): Promise<ApiAuthResult> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Response(
      JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Missing or invalid Authorization header" } }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const token = authHeader.slice(7);
  const apiKey = await validateApiKey(token);

  if (!apiKey) {
    throw new Response(
      JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Invalid or expired API key" } }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  // Enforce per-key rate limit before processing
  checkRateLimit(apiKey.apiKeyId, apiKey.rateLimitTier, apiKey.rateLimitCustom);

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  trackApiKeyUsage(apiKey.apiKeyId, ip);

  return {
    tenantId: apiKey.tenantId,
    apiKeyId: apiKey.apiKeyId,
    permissions: apiKey.permissions,
  };
}

export function requireApiPermission(auth: ApiAuthResult, permission: string) {
  if (!auth.permissions.includes(permission) && !auth.permissions.includes("*")) {
    throw new Response(
      JSON.stringify({
        error: { code: "FORBIDDEN", message: `Missing permission: ${permission}` },
      }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }
}

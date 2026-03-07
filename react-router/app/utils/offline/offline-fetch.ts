import { enqueue } from "~/utils/offline/offline-store";

export interface OfflineConfig {
  type: string;
  entityType: string;
  entityId: string;
  optimisticUpdate?: (data: Record<string, unknown>) => void;
}

export interface OfflineFetchOptions extends RequestInit {
  offlineConfig?: OfflineConfig;
}

/**
 * Fetch wrapper that queues mutations when offline.
 * GET requests always go through fetch (may fail if offline).
 * Mutations (POST/PUT/DELETE) are queued in IndexedDB when offline.
 */
export async function offlineFetch(
  url: string,
  options: OfflineFetchOptions = {},
): Promise<Response> {
  const { offlineConfig, ...fetchOptions } = options;
  const method = (fetchOptions.method || "GET").toUpperCase();

  // GET requests and non-offline-configured requests go through normally
  if (method === "GET" || !offlineConfig) {
    return fetch(url, fetchOptions);
  }

  // If online, use regular fetch
  if (navigator.onLine) {
    return fetch(url, fetchOptions);
  }

  // Offline path: extract payload, enqueue mutation, fire optimistic update
  const payload = await extractPayload(fetchOptions);

  const mutationId = await enqueue({
    type: offlineConfig.type,
    entityType: offlineConfig.entityType,
    entityId: offlineConfig.entityId,
    payload: { url, method, ...payload },
    timestamp: Date.now(),
  });

  if (offlineConfig.optimisticUpdate) {
    offlineConfig.optimisticUpdate(payload);
  }

  return new Response(
    JSON.stringify({
      queued: true,
      mutationId,
      message: "Action queued for sync when online",
    }),
    {
      status: 202,
      statusText: "Accepted",
      headers: { "Content-Type": "application/json" },
    },
  );
}

async function extractPayload(options: RequestInit): Promise<Record<string, unknown>> {
  const { body } = options;
  if (!body) return {};

  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return { raw: body };
    }
  }

  if (body instanceof FormData) {
    const obj: Record<string, unknown> = {};
    body.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }

  return {};
}

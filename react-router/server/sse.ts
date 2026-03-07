import { Router } from "express";
import type { Request, Response } from "express";
import { eventBus } from "../app/utils/events/event-bus.server.js";
import type { BusEvent } from "../app/utils/events/event-bus.server.js";
import { SSE_CHANNELS, type SSEChannel } from "../app/types/sse-events.js";

// ─── Types ───────────────────────────────────────────────

interface FlushableResponse extends Response {
  flush?(): void;
}

interface SSEConnection {
  userId: string;
  tenantId: string;
  res: FlushableResponse;
}

type GetUserIdFn = (request: globalThis.Request) => Promise<string | null>;
type IsFeatureEnabledFn = (key: string, context?: Record<string, unknown>) => Promise<boolean>;
type GetUserFn = (userId: string) => Promise<{ tenantId: string | null; roles: string[] } | null>;

// ─── Connection Registry ─────────────────────────────────

const connections = new Map<string, SSEConnection>();
const MAX_CONNECTIONS_PER_USER = 5;
const MAX_TOTAL_CONNECTIONS = 1000;
const HEARTBEAT_INTERVAL_MS = 30_000;

let clientCounter = 0;

function getConnectionsForUser(userId: string): number {
  let count = 0;
  for (const conn of connections.values()) {
    if (conn.userId === userId) count++;
  }
  return count;
}

// ─── SSE Router Factory ──────────────────────────────────

export function createSSERouter(
  getUserIdFn: GetUserIdFn,
  isFeatureEnabledFn: IsFeatureEnabledFn,
  getUserFn: GetUserFn,
): Router {
  const router = Router();

  router.get("/api/sse", async (req: Request, _res: Response) => {
    const res = _res as FlushableResponse;
    // 1. Auth
    let userId: string | undefined;
    try {
      const cookie = req.headers.cookie || "";
      const fakeReq = new globalThis.Request("http://localhost", {
        headers: { Cookie: cookie },
      });
      const id = await getUserIdFn(fakeReq);
      if (id) userId = id;
    } catch {
      // auth failed
    }

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // 2. Get user's tenant + roles
    const user = await getUserFn(userId);
    if (!user || !user.tenantId) {
      res.status(403).json({ error: "No tenant assigned" });
      return;
    }

    const { tenantId, roles } = user;

    // 3. Check feature flag
    const enabled = await isFeatureEnabledFn("FF_SSE_UPDATES", { tenantId, roles, userId });
    if (!enabled) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    // 4. Parse + validate channels query param
    const channelsParam = (req.query.channels as string) || "";
    const requestedChannels = channelsParam
      .split(",")
      .map((c) => c.trim())
      .filter((c): c is SSEChannel => SSE_CHANNELS.includes(c as SSEChannel));

    if (requestedChannels.length === 0) {
      res.status(400).json({ error: "At least one valid channel required" });
      return;
    }

    // 5. Connection limits
    if (connections.size >= MAX_TOTAL_CONNECTIONS) {
      res.status(503).json({ error: "Too many connections" });
      return;
    }

    if (getConnectionsForUser(userId) >= MAX_CONNECTIONS_PER_USER) {
      res.status(429).json({ error: "Too many connections for this user" });
      return;
    }

    // 6. SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const clientId = `sse-${Date.now()}-${clientCounter++}`;

    // 7. Send connected event
    res.write(`event: connected\ndata: ${JSON.stringify({ clientId })}\n\n`);
    res.flush?.();

    // Register connection
    connections.set(clientId, { userId, tenantId, res });

    // 8. Subscribe to event bus — filter by tenantId
    const unsubscribes: (() => void)[] = [];

    for (const channel of requestedChannels) {
      const unsub = eventBus.subscribe(channel, (event: BusEvent) => {
        if (event.tenantId !== tenantId) return;

        try {
          res.write(
            `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\nid: ${event.id}\n\n`,
          );
          res.flush?.();
        } catch {
          // Connection closed
        }
      });
      unsubscribes.push(unsub);
    }

    // 9. Heartbeat
    const heartbeat = setInterval(() => {
      try {
        res.write(`:heartbeat\n\n`);
        res.flush?.();
      } catch {
        // Connection closed
      }
    }, HEARTBEAT_INTERVAL_MS);

    // 10. Cleanup on close
    req.on("close", () => {
      for (const unsub of unsubscribes) unsub();
      clearInterval(heartbeat);
      connections.delete(clientId);
    });
  });

  return router;
}

export function getSSEConnectionCount(): number {
  return connections.size;
}

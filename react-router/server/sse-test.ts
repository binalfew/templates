/**
 * Dev-only test route for publishing fake SSE events.
 * Registered only when NODE_ENV === "development".
 *
 * Usage (from browser console while logged in):
 *   fetch("/api/sse-test/notification", { method: "POST" })
 *   fetch("/api/sse-test/dashboard-update", { method: "POST" })
 */
import { Router } from "express";
import type { Request, Response } from "express";
import { eventBus } from "../app/utils/events/event-bus.server.js";
import type { SSEEventType, SSEChannel } from "../app/types/sse-events.js";

type GetUserIdFn = (request: globalThis.Request) => Promise<string | null>;
type GetTenantFn = (userId: string) => Promise<string | null>;

interface TestEvent {
  channel: SSEChannel;
  type: SSEEventType;
  data: Record<string, unknown>;
}

const TEST_EVENTS: Record<string, TestEvent> = {
  notification: {
    channel: "notifications",
    type: "notification:new",
    data: {
      title: "Test Notification",
      message: "This is a test notification from the SSE test route.",
    },
  },
  "dashboard-update": {
    channel: "dashboard",
    type: "dashboard:update",
    data: {
      metric: "users",
      value: 42,
    },
  },
};

export function createSSETestRouter(getUserIdFn: GetUserIdFn, getTenantFn: GetTenantFn): Router {
  const router = Router();

  router.post("/api/sse-test/:eventName", async (req: Request, res: Response) => {
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

    const tenantId = await getTenantFn(userId);
    if (!tenantId) {
      res.status(403).json({ error: "No tenant assigned" });
      return;
    }

    const eventName = req.params.eventName as string;
    const testEvent = TEST_EVENTS[eventName];

    if (!testEvent) {
      res.status(400).json({
        error: "Unknown event",
        available: Object.keys(TEST_EVENTS),
      });
      return;
    }

    const eventId = eventBus.publish(testEvent.channel, tenantId, testEvent.type, testEvent.data);

    res.json({
      ok: true,
      eventId,
      channel: testEvent.channel,
      type: testEvent.type,
    });
  });

  return router;
}

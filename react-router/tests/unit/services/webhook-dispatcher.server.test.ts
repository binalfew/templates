import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSubscriptionFindMany = vi.fn();
const mockDeliveryCreate = vi.fn();

vi.mock("~/lib/db/db.server", () => ({
  prisma: {
    webhookSubscription: {
      findMany: (...args: unknown[]) => mockSubscriptionFindMany(...args),
    },
    webhookDelivery: {
      create: (...args: unknown[]) => mockDeliveryCreate(...args),
    },
  },
}));

vi.mock("~/lib/monitoring/logger.server", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockDeliverWebhook = vi.fn();

vi.mock("~/services/webhook-delivery.server", () => ({
  deliverWebhook: (...args: unknown[]) => mockDeliverWebhook(...args),
}));

const TENANT_ID = "tenant-1";
const EVENT_TYPE = "broadcast.sent";
const EVENT_ID = "evt-abc-123";
const PAYLOAD = { broadcastId: "bc-1", recipientCount: 42 };

function makeSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub-1",
    maxRetries: 5,
    retryBackoffMs: [1000, 5000, 30000],
    circuitBreakerOpen: false,
    circuitBreakerResetAt: null,
    ...overrides,
  };
}

describe("webhook-dispatcher.server", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockDeliverWebhook.mockResolvedValue({ success: true });
  });

  describe("dispatchWebhookEvent", () => {
    it("returns early when no subscriptions match", async () => {
      const { dispatchWebhookEvent } = await import("~/services/webhook-dispatcher.server");
      mockSubscriptionFindMany.mockResolvedValue([]);

      await dispatchWebhookEvent(TENANT_ID, EVENT_TYPE, EVENT_ID, PAYLOAD);

      expect(mockSubscriptionFindMany).toHaveBeenCalledOnce();
      expect(mockDeliveryCreate).not.toHaveBeenCalled();
      expect(mockDeliverWebhook).not.toHaveBeenCalled();
    });

    it("creates a delivery and dispatches for each matched subscription", async () => {
      const { dispatchWebhookEvent } = await import("~/services/webhook-dispatcher.server");

      const sub1 = makeSubscription({ id: "sub-1", maxRetries: 3 });
      const sub2 = makeSubscription({ id: "sub-2", maxRetries: 5 });
      mockSubscriptionFindMany.mockResolvedValue([sub1, sub2]);

      mockDeliveryCreate
        .mockResolvedValueOnce({ id: "del-1" })
        .mockResolvedValueOnce({ id: "del-2" });

      await dispatchWebhookEvent(TENANT_ID, EVENT_TYPE, EVENT_ID, PAYLOAD);

      expect(mockDeliveryCreate).toHaveBeenCalledTimes(2);

      // First delivery
      expect(mockDeliveryCreate).toHaveBeenNthCalledWith(1, {
        data: {
          tenantId: TENANT_ID,
          subscriptionId: "sub-1",
          eventType: EVENT_TYPE,
          eventId: EVENT_ID,
          payload: PAYLOAD,
          maxAttempts: 3,
        },
      });

      // Second delivery
      expect(mockDeliveryCreate).toHaveBeenNthCalledWith(2, {
        data: {
          tenantId: TENANT_ID,
          subscriptionId: "sub-2",
          eventType: EVENT_TYPE,
          eventId: EVENT_ID,
          payload: PAYLOAD,
          maxAttempts: 5,
        },
      });

      expect(mockDeliverWebhook).toHaveBeenCalledWith("del-1");
      expect(mockDeliverWebhook).toHaveBeenCalledWith("del-2");
    });

    it("queries for subscriptions matching the event type or wildcard", async () => {
      const { dispatchWebhookEvent } = await import("~/services/webhook-dispatcher.server");
      mockSubscriptionFindMany.mockResolvedValue([]);

      await dispatchWebhookEvent(TENANT_ID, EVENT_TYPE, EVENT_ID, PAYLOAD);

      expect(mockSubscriptionFindMany).toHaveBeenCalledWith({
        where: {
          tenantId: TENANT_ID,
          status: "ACTIVE",
          OR: [{ events: { has: EVENT_TYPE } }, { events: { has: "*" } }],
        },
        select: {
          id: true,
          maxRetries: true,
          retryBackoffMs: true,
          circuitBreakerOpen: true,
          circuitBreakerResetAt: true,
        },
      });
    });

    it("skips subscription when circuit breaker is open and reset time is in the future", async () => {
      const { dispatchWebhookEvent } = await import("~/services/webhook-dispatcher.server");

      const futureDate = new Date(Date.now() + 60 * 60 * 1000);
      const sub = makeSubscription({
        id: "sub-breaker",
        circuitBreakerOpen: true,
        circuitBreakerResetAt: futureDate,
      });
      mockSubscriptionFindMany.mockResolvedValue([sub]);

      await dispatchWebhookEvent(TENANT_ID, EVENT_TYPE, EVENT_ID, PAYLOAD);

      expect(mockDeliveryCreate).not.toHaveBeenCalled();
      expect(mockDeliverWebhook).not.toHaveBeenCalled();
    });

    it("proceeds when circuit breaker is open but reset time has passed", async () => {
      const { dispatchWebhookEvent } = await import("~/services/webhook-dispatcher.server");

      const pastDate = new Date(Date.now() - 1000);
      const sub = makeSubscription({
        id: "sub-probe",
        circuitBreakerOpen: true,
        circuitBreakerResetAt: pastDate,
      });
      mockSubscriptionFindMany.mockResolvedValue([sub]);
      mockDeliveryCreate.mockResolvedValue({ id: "del-probe" });

      await dispatchWebhookEvent(TENANT_ID, EVENT_TYPE, EVENT_ID, PAYLOAD);

      expect(mockDeliveryCreate).toHaveBeenCalledOnce();
      expect(mockDeliverWebhook).toHaveBeenCalledWith("del-probe");
    });

    it("proceeds when circuit breaker is open but resetAt is null", async () => {
      const { dispatchWebhookEvent } = await import("~/services/webhook-dispatcher.server");

      const sub = makeSubscription({
        id: "sub-null-reset",
        circuitBreakerOpen: true,
        circuitBreakerResetAt: null,
      });
      mockSubscriptionFindMany.mockResolvedValue([sub]);
      mockDeliveryCreate.mockResolvedValue({ id: "del-null-reset" });

      await dispatchWebhookEvent(TENANT_ID, EVENT_TYPE, EVENT_ID, PAYLOAD);

      expect(mockDeliveryCreate).toHaveBeenCalledOnce();
      expect(mockDeliverWebhook).toHaveBeenCalledWith("del-null-reset");
    });

    it("logs error and continues when delivery creation fails", async () => {
      const { dispatchWebhookEvent } = await import("~/services/webhook-dispatcher.server");
      const { logger } = await import("~/lib/monitoring/logger.server");

      const sub1 = makeSubscription({ id: "sub-fail" });
      const sub2 = makeSubscription({ id: "sub-ok" });
      mockSubscriptionFindMany.mockResolvedValue([sub1, sub2]);

      const createError = new Error("DB connection lost");
      mockDeliveryCreate
        .mockRejectedValueOnce(createError)
        .mockResolvedValueOnce({ id: "del-ok" });

      await dispatchWebhookEvent(TENANT_ID, EVENT_TYPE, EVENT_ID, PAYLOAD);

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionId: "sub-fail",
          eventType: EVENT_TYPE,
          error: createError,
        }),
        "Failed to create webhook delivery",
      );

      // Second subscription still processed
      expect(mockDeliverWebhook).toHaveBeenCalledWith("del-ok");
    });

    it("catches and logs async delivery errors without throwing", async () => {
      const { dispatchWebhookEvent } = await import("~/services/webhook-dispatcher.server");
      const { logger } = await import("~/lib/monitoring/logger.server");

      const sub = makeSubscription({ id: "sub-async-fail" });
      mockSubscriptionFindMany.mockResolvedValue([sub]);
      mockDeliveryCreate.mockResolvedValue({ id: "del-async-fail" });

      const deliveryError = new Error("Network timeout");
      mockDeliverWebhook.mockRejectedValue(deliveryError);

      // Should not throw
      await dispatchWebhookEvent(TENANT_ID, EVENT_TYPE, EVENT_ID, PAYLOAD);

      // The .catch() handler logs the warning asynchronously;
      // give microtask queue a tick to process the rejection
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          deliveryId: "del-async-fail",
          error: deliveryError,
        }),
        "Webhook delivery failed (async)",
      );
    });

    it("dispatches to subscriptions with wildcard events", async () => {
      const { dispatchWebhookEvent } = await import("~/services/webhook-dispatcher.server");

      const wildcardSub = makeSubscription({ id: "sub-wildcard" });
      mockSubscriptionFindMany.mockResolvedValue([wildcardSub]);
      mockDeliveryCreate.mockResolvedValue({ id: "del-wildcard" });

      await dispatchWebhookEvent(TENANT_ID, "user.created", EVENT_ID, PAYLOAD);

      expect(mockDeliveryCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: "user.created",
          subscriptionId: "sub-wildcard",
        }),
      });
    });
  });
});

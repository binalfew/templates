import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDeliveryFindUnique = vi.fn();
const mockDeliveryFindMany = vi.fn();
const mockDeliveryUpdate = vi.fn();
const mockSubscriptionUpdate = vi.fn();

vi.mock("~/utils/db/db.server", () => ({
  prisma: {
    webhookDelivery: {
      findUnique: (...args: unknown[]) => mockDeliveryFindUnique(...args),
      findMany: (...args: unknown[]) => mockDeliveryFindMany(...args),
      update: (...args: unknown[]) => mockDeliveryUpdate(...args),
    },
    webhookSubscription: {
      update: (...args: unknown[]) => mockSubscriptionUpdate(...args),
    },
  },
}));

vi.mock("~/utils/monitoring/logger.server", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function makeSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub-1",
    url: "https://example.com/webhook",
    secret: "a".repeat(64),
    version: "1.0",
    timeoutMs: 30000,
    headers: null,
    consecutiveFailures: 0,
    circuitBreakerOpen: false,
    circuitBreakerResetAt: null,
    retryBackoffMs: [1000, 5000, 30000],
    metadata: {},
    ...overrides,
  };
}

function makeDelivery(overrides: Record<string, unknown> = {}) {
  return {
    id: "del-1",
    tenantId: "tenant-1",
    subscriptionId: "sub-1",
    eventType: "user.created",
    eventId: "evt-1",
    payload: { userId: "u-1" },
    attempts: 0,
    maxAttempts: 5,
    status: "PENDING",
    subscription: makeSubscription(),
    ...overrides,
  };
}

describe("webhook-delivery.server", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockDeliveryUpdate.mockResolvedValue({});
    mockSubscriptionUpdate.mockResolvedValue({});
  });

  describe("signPayload", () => {
    it("produces a valid HMAC-SHA256 hex digest", async () => {
      const { signPayload } = await import("~/services/webhook-delivery.server");
      const signature = signPayload('{"event":"test"}', "my-secret-key");

      // Should be a 64-char hex string (256 bits = 64 hex chars)
      expect(signature).toMatch(/^[a-f0-9]{64}$/);
    });

    it("returns different signatures for different payloads", async () => {
      const { signPayload } = await import("~/services/webhook-delivery.server");
      const sig1 = signPayload("payload-a", "secret");
      const sig2 = signPayload("payload-b", "secret");

      expect(sig1).not.toBe(sig2);
    });

    it("returns different signatures for different secrets", async () => {
      const { signPayload } = await import("~/services/webhook-delivery.server");
      const sig1 = signPayload("same-payload", "secret-1");
      const sig2 = signPayload("same-payload", "secret-2");

      expect(sig1).not.toBe(sig2);
    });

    it("is deterministic for the same inputs", async () => {
      const { signPayload } = await import("~/services/webhook-delivery.server");
      const sig1 = signPayload("deterministic", "key");
      const sig2 = signPayload("deterministic", "key");

      expect(sig1).toBe(sig2);
    });
  });

  describe("deliverWebhook", () => {
    it("returns error when delivery is not found", async () => {
      const { deliverWebhook } = await import("~/services/webhook-delivery.server");
      const { logger } = await import("~/utils/monitoring/logger.server");
      mockDeliveryFindUnique.mockResolvedValue(null);

      const result = await deliverWebhook("non-existent-id");

      expect(result).toEqual({ success: false, error: "Delivery not found" });
      expect(logger.warn).toHaveBeenCalledWith(
        { deliveryId: "non-existent-id" },
        "Webhook delivery not found",
      );
    });

    it("returns error when circuit breaker is open and reset time is in the future", async () => {
      const { deliverWebhook } = await import("~/services/webhook-delivery.server");
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);
      const delivery = makeDelivery({
        subscription: makeSubscription({
          circuitBreakerOpen: true,
          circuitBreakerResetAt: futureDate,
        }),
      });
      mockDeliveryFindUnique.mockResolvedValue(delivery);

      const result = await deliverWebhook("del-1");

      expect(result).toEqual({ success: false, error: "Circuit breaker open" });
    });

    it("proceeds with probe attempt when circuit breaker reset time has passed", async () => {
      const { deliverWebhook } = await import("~/services/webhook-delivery.server");
      const { logger } = await import("~/utils/monitoring/logger.server");
      const pastDate = new Date(Date.now() - 1000);
      const delivery = makeDelivery({
        subscription: makeSubscription({
          circuitBreakerOpen: true,
          circuitBreakerResetAt: pastDate,
        }),
      });
      mockDeliveryFindUnique.mockResolvedValue(delivery);

      const mockResponse = new Response("OK", { status: 200 });
      vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

      const result = await deliverWebhook("del-1");

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ deliveryId: "del-1" }),
        "Circuit breaker probe attempt",
      );
      expect(result.success).toBe(true);

      vi.restoreAllMocks();
    });

    it("delivers successfully and updates delivery record", async () => {
      const { deliverWebhook } = await import("~/services/webhook-delivery.server");
      const delivery = makeDelivery();
      mockDeliveryFindUnique.mockResolvedValue(delivery);

      const mockResponse = new Response("OK", { status: 200 });
      vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

      const result = await deliverWebhook("del-1");

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.latencyMs).toBeDefined();
      expect(typeof result.latencyMs).toBe("number");

      expect(mockDeliveryUpdate).toHaveBeenCalledWith({
        where: { id: "del-1" },
        data: expect.objectContaining({
          status: "DELIVERED",
          attempts: 1,
          responseCode: 200,
          responseBody: "OK",
          deliveredAt: expect.any(Date),
          nextRetryAt: null,
        }),
      });

      vi.restoreAllMocks();
    });

    it("sends correct headers including signature", async () => {
      const { deliverWebhook, signPayload } = await import("~/services/webhook-delivery.server");
      const delivery = makeDelivery();
      mockDeliveryFindUnique.mockResolvedValue(delivery);

      let capturedHeaders: Record<string, string> = {};
      vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
        const h = init?.headers as Record<string, string>;
        capturedHeaders = { ...h };
        return new Response("OK", { status: 200 });
      });

      await deliverWebhook("del-1");

      expect(capturedHeaders["Content-Type"]).toBe("application/json");
      expect(capturedHeaders["X-Webhook-Event"]).toBe("user.created");
      expect(capturedHeaders["X-Webhook-Delivery"]).toBe("del-1");
      expect(capturedHeaders["X-Webhook-Signature"]).toMatch(/^sha256=[a-f0-9]{64}$/);

      vi.restoreAllMocks();
    });

    it("includes custom headers from subscription", async () => {
      const { deliverWebhook } = await import("~/services/webhook-delivery.server");
      const delivery = makeDelivery({
        subscription: makeSubscription({
          headers: { Authorization: "Bearer token-123", "X-Custom": "value" },
        }),
      });
      mockDeliveryFindUnique.mockResolvedValue(delivery);

      let capturedHeaders: Record<string, string> = {};
      vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
        capturedHeaders = { ...(init?.headers as Record<string, string>) };
        return new Response("OK", { status: 200 });
      });

      await deliverWebhook("del-1");

      expect(capturedHeaders["Authorization"]).toBe("Bearer token-123");
      expect(capturedHeaders["X-Custom"]).toBe("value");
      // Standard headers should still be present
      expect(capturedHeaders["Content-Type"]).toBe("application/json");

      vi.restoreAllMocks();
    });

    it("resets subscription failure counters on successful delivery after failures", async () => {
      const { deliverWebhook } = await import("~/services/webhook-delivery.server");
      const delivery = makeDelivery({
        subscription: makeSubscription({
          consecutiveFailures: 5,
          circuitBreakerOpen: false,
        }),
      });
      mockDeliveryFindUnique.mockResolvedValue(delivery);

      vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("OK", { status: 200 }));

      await deliverWebhook("del-1");

      expect(mockSubscriptionUpdate).toHaveBeenCalledWith({
        where: { id: "sub-1" },
        data: {
          consecutiveFailures: 0,
          circuitBreakerOpen: false,
          circuitBreakerResetAt: null,
        },
      });

      vi.restoreAllMocks();
    });

    it("does not reset subscription counters when there were no prior failures", async () => {
      const { deliverWebhook } = await import("~/services/webhook-delivery.server");
      const delivery = makeDelivery({
        subscription: makeSubscription({
          consecutiveFailures: 0,
          circuitBreakerOpen: false,
        }),
      });
      mockDeliveryFindUnique.mockResolvedValue(delivery);

      vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("OK", { status: 200 }));

      await deliverWebhook("del-1");

      expect(mockSubscriptionUpdate).not.toHaveBeenCalled();

      vi.restoreAllMocks();
    });

    it("handles HTTP error response and marks as RETRYING with backoff", async () => {
      const { deliverWebhook } = await import("~/services/webhook-delivery.server");
      const delivery = makeDelivery({ attempts: 0, maxAttempts: 5 });
      mockDeliveryFindUnique.mockResolvedValue(delivery);

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("Internal Server Error", { status: 500 }),
      );

      const result = await deliverWebhook("del-1");

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(500);
      expect(result.error).toBe("HTTP 500");

      expect(mockDeliveryUpdate).toHaveBeenCalledWith({
        where: { id: "del-1" },
        data: expect.objectContaining({
          status: "RETRYING",
          attempts: 1,
          responseCode: 500,
          responseBody: "Internal Server Error",
          errorMessage: "HTTP 500",
          errorType: "HTTP_ERROR",
          nextRetryAt: expect.any(Date),
        }),
      });

      // Subscription failure count incremented
      expect(mockSubscriptionUpdate).toHaveBeenCalledWith({
        where: { id: "sub-1" },
        data: { consecutiveFailures: 1 },
      });

      vi.restoreAllMocks();
    });

    it("marks delivery as DEAD_LETTER when max attempts reached", async () => {
      const { deliverWebhook } = await import("~/services/webhook-delivery.server");
      const delivery = makeDelivery({ attempts: 4, maxAttempts: 5 });
      mockDeliveryFindUnique.mockResolvedValue(delivery);

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("Bad Gateway", { status: 502 }),
      );

      const result = await deliverWebhook("del-1");

      expect(result.success).toBe(false);

      expect(mockDeliveryUpdate).toHaveBeenCalledWith({
        where: { id: "del-1" },
        data: expect.objectContaining({
          status: "DEAD_LETTER",
          attempts: 5,
          nextRetryAt: null,
        }),
      });

      vi.restoreAllMocks();
    });

    it("handles network error (fetch throws)", async () => {
      const { deliverWebhook } = await import("~/services/webhook-delivery.server");
      const delivery = makeDelivery({ attempts: 0, maxAttempts: 3 });
      mockDeliveryFindUnique.mockResolvedValue(delivery);

      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));

      const result = await deliverWebhook("del-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("ECONNREFUSED");
      expect(result.statusCode).toBeUndefined();

      expect(mockDeliveryUpdate).toHaveBeenCalledWith({
        where: { id: "del-1" },
        data: expect.objectContaining({
          status: "RETRYING",
          responseCode: null,
          responseBody: null,
          errorMessage: "ECONNREFUSED",
          errorType: "NETWORK_ERROR",
        }),
      });

      vi.restoreAllMocks();
    });

    it("handles timeout error with descriptive message", async () => {
      const { deliverWebhook } = await import("~/services/webhook-delivery.server");
      const delivery = makeDelivery({
        attempts: 0,
        maxAttempts: 3,
        subscription: makeSubscription({ timeoutMs: 5000 }),
      });
      mockDeliveryFindUnique.mockResolvedValue(delivery);

      const timeoutError = new Error("The operation was aborted");
      timeoutError.name = "TimeoutError";
      vi.spyOn(globalThis, "fetch").mockRejectedValue(timeoutError);

      const result = await deliverWebhook("del-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Request timed out after 5000ms");

      vi.restoreAllMocks();
    });

    it("uses correct backoff index from retryBackoffMs array", async () => {
      const { deliverWebhook } = await import("~/services/webhook-delivery.server");
      // On attempt 2 (index 1 in backoff array), should use 5000ms backoff
      const delivery = makeDelivery({
        attempts: 2,
        maxAttempts: 10,
        subscription: makeSubscription({
          retryBackoffMs: [1000, 5000, 30000, 60000],
        }),
      });
      mockDeliveryFindUnique.mockResolvedValue(delivery);

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("Error", { status: 503 }),
      );

      const beforeMs = Date.now();
      await deliverWebhook("del-1");

      const updateCall = mockDeliveryUpdate.mock.calls[0][0];
      const nextRetryAt = updateCall.data.nextRetryAt as Date;
      // backoffIndex = min(2, 3) = 2, so backoff = 30000ms
      expect(nextRetryAt.getTime()).toBeGreaterThanOrEqual(beforeMs + 30000 - 100);
      expect(nextRetryAt.getTime()).toBeLessThanOrEqual(beforeMs + 30000 + 1000);

      vi.restoreAllMocks();
    });

    it("clamps backoff index to last element when attempts exceed array length", async () => {
      const { deliverWebhook } = await import("~/services/webhook-delivery.server");
      const delivery = makeDelivery({
        attempts: 10,
        maxAttempts: 20,
        subscription: makeSubscription({
          retryBackoffMs: [1000, 5000],
        }),
      });
      mockDeliveryFindUnique.mockResolvedValue(delivery);

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("Error", { status: 500 }),
      );

      const beforeMs = Date.now();
      await deliverWebhook("del-1");

      const updateCall = mockDeliveryUpdate.mock.calls[0][0];
      const nextRetryAt = updateCall.data.nextRetryAt as Date;
      // backoffIndex = min(10, 1) = 1, so backoff = 5000ms
      expect(nextRetryAt.getTime()).toBeGreaterThanOrEqual(beforeMs + 5000 - 100);
      expect(nextRetryAt.getTime()).toBeLessThanOrEqual(beforeMs + 5000 + 1000);

      vi.restoreAllMocks();
    });

    it("opens circuit breaker when consecutive failures reach threshold", async () => {
      const { deliverWebhook } = await import("~/services/webhook-delivery.server");
      const { logger } = await import("~/utils/monitoring/logger.server");
      // consecutiveFailures is 9, after this failure it will be 10 (= threshold)
      const delivery = makeDelivery({
        attempts: 0,
        maxAttempts: 100,
        subscription: makeSubscription({
          consecutiveFailures: 9,
          circuitBreakerOpen: false,
          metadata: { breakerTrips: 0 },
        }),
      });
      mockDeliveryFindUnique.mockResolvedValue(delivery);

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("Error", { status: 500 }),
      );

      await deliverWebhook("del-1");

      // Should open circuit breaker (trip 1 < MAX_BREAKER_TRIPS=3)
      expect(mockSubscriptionUpdate).toHaveBeenCalledWith({
        where: { id: "sub-1" },
        data: expect.objectContaining({
          consecutiveFailures: 10,
          circuitBreakerOpen: true,
          circuitBreakerResetAt: expect.any(Date),
          metadata: { breakerTrips: 1 },
        }),
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ subscriptionId: "sub-1", failures: 10 }),
        "Circuit breaker opened",
      );

      vi.restoreAllMocks();
    });

    it("suspends subscription after max breaker trips", async () => {
      const { deliverWebhook } = await import("~/services/webhook-delivery.server");
      const { logger } = await import("~/utils/monitoring/logger.server");
      // breakerTrips is 2, after this it will be 3 (= MAX_BREAKER_TRIPS)
      const delivery = makeDelivery({
        attempts: 0,
        maxAttempts: 100,
        subscription: makeSubscription({
          consecutiveFailures: 9,
          circuitBreakerOpen: false,
          metadata: { breakerTrips: 2 },
        }),
      });
      mockDeliveryFindUnique.mockResolvedValue(delivery);

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("Error", { status: 500 }),
      );

      await deliverWebhook("del-1");

      expect(mockSubscriptionUpdate).toHaveBeenCalledWith({
        where: { id: "sub-1" },
        data: expect.objectContaining({
          consecutiveFailures: 10,
          circuitBreakerOpen: true,
          circuitBreakerResetAt: expect.any(Date),
          status: "SUSPENDED",
          metadata: { breakerTrips: 3 },
        }),
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ subscriptionId: "sub-1", trips: 3 }),
        "Webhook subscription suspended after repeated circuit breaker trips",
      );

      vi.restoreAllMocks();
    });

    it("does not trip circuit breaker when already open", async () => {
      const { deliverWebhook } = await import("~/services/webhook-delivery.server");
      const delivery = makeDelivery({
        attempts: 0,
        maxAttempts: 100,
        subscription: makeSubscription({
          consecutiveFailures: 15,
          circuitBreakerOpen: true,
          circuitBreakerResetAt: new Date(Date.now() - 1000), // reset has passed, probe attempt
          metadata: { breakerTrips: 1 },
        }),
      });
      mockDeliveryFindUnique.mockResolvedValue(delivery);

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("Error", { status: 500 }),
      );

      await deliverWebhook("del-1");

      // Should just increment consecutiveFailures, not re-open breaker
      expect(mockSubscriptionUpdate).toHaveBeenCalledWith({
        where: { id: "sub-1" },
        data: { consecutiveFailures: 16 },
      });

      vi.restoreAllMocks();
    });

    it("truncates long response bodies to 1024 characters", async () => {
      const { deliverWebhook } = await import("~/services/webhook-delivery.server");
      const delivery = makeDelivery();
      mockDeliveryFindUnique.mockResolvedValue(delivery);

      const longBody = "x".repeat(2000);
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(longBody, { status: 200 }),
      );

      await deliverWebhook("del-1");

      const updateCall = mockDeliveryUpdate.mock.calls[0][0];
      expect(updateCall.data.responseBody).toHaveLength(1024);

      vi.restoreAllMocks();
    });

    it("sends correct envelope structure with event data", async () => {
      const { deliverWebhook } = await import("~/services/webhook-delivery.server");
      const delivery = makeDelivery({
        eventId: "evt-42",
        eventType: "user.created",
        payload: { userId: "u-1", email: "test@example.com" },
        subscription: makeSubscription({ version: "2.0" }),
      });
      mockDeliveryFindUnique.mockResolvedValue(delivery);

      let capturedBody = "";
      vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
        capturedBody = init?.body as string;
        return new Response("OK", { status: 200 });
      });

      await deliverWebhook("del-1");

      const parsed = JSON.parse(capturedBody);
      expect(parsed.id).toBe("evt-42");
      expect(parsed.event).toBe("user.created");
      expect(parsed.version).toBe("2.0");
      expect(parsed.data).toEqual({ userId: "u-1", email: "test@example.com" });
      expect(parsed.timestamp).toBeDefined();

      vi.restoreAllMocks();
    });

    it("uses AbortSignal.timeout with subscription timeoutMs", async () => {
      const { deliverWebhook } = await import("~/services/webhook-delivery.server");
      const delivery = makeDelivery({
        subscription: makeSubscription({ timeoutMs: 15000 }),
      });
      mockDeliveryFindUnique.mockResolvedValue(delivery);

      const mockAbortSignal = AbortSignal.timeout(15000);
      const abortTimeoutSpy = vi
        .spyOn(AbortSignal, "timeout")
        .mockReturnValue(mockAbortSignal);

      vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("OK", { status: 200 }));

      await deliverWebhook("del-1");

      expect(abortTimeoutSpy).toHaveBeenCalledWith(15000);

      vi.restoreAllMocks();
    });

    it("handles null metadata in subscription gracefully for breaker trips", async () => {
      const { deliverWebhook } = await import("~/services/webhook-delivery.server");
      const delivery = makeDelivery({
        attempts: 0,
        maxAttempts: 100,
        subscription: makeSubscription({
          consecutiveFailures: 9,
          circuitBreakerOpen: false,
          metadata: null,
        }),
      });
      mockDeliveryFindUnique.mockResolvedValue(delivery);

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("Error", { status: 500 }),
      );

      await deliverWebhook("del-1");

      // breakerTrips defaults to 0 when metadata is null, so newBreakerTrips = 1
      expect(mockSubscriptionUpdate).toHaveBeenCalledWith({
        where: { id: "sub-1" },
        data: expect.objectContaining({
          circuitBreakerOpen: true,
          metadata: { breakerTrips: 1 },
        }),
      });

      vi.restoreAllMocks();
    });
  });

  describe("retryFailedDeliveries", () => {
    it("returns zeros when no deliveries need retrying", async () => {
      const { retryFailedDeliveries } = await import("~/services/webhook-delivery.server");
      mockDeliveryFindMany.mockResolvedValue([]);

      const result = await retryFailedDeliveries();

      expect(result).toEqual({ processed: 0, succeeded: 0, failed: 0 });
    });

    it("queries for RETRYING deliveries with nextRetryAt in the past", async () => {
      const { retryFailedDeliveries } = await import("~/services/webhook-delivery.server");
      mockDeliveryFindMany.mockResolvedValue([]);

      await retryFailedDeliveries();

      expect(mockDeliveryFindMany).toHaveBeenCalledWith({
        where: {
          status: "RETRYING",
          nextRetryAt: { lte: expect.any(Date) },
        },
        take: 50,
        orderBy: { nextRetryAt: "asc" },
      });
    });

    it("processes retryable deliveries and counts successes and failures", async () => {
      const { retryFailedDeliveries } = await import("~/services/webhook-delivery.server");

      const delivery1 = makeDelivery({ id: "del-retry-1" });
      const delivery2 = makeDelivery({ id: "del-retry-2" });
      const delivery3 = makeDelivery({ id: "del-retry-3" });
      mockDeliveryFindMany.mockResolvedValue([delivery1, delivery2, delivery3]);

      // Mock deliverWebhook calls via findUnique for each delivery
      mockDeliveryFindUnique
        .mockResolvedValueOnce(makeDelivery({ id: "del-retry-1" }))
        .mockResolvedValueOnce(makeDelivery({ id: "del-retry-2" }))
        .mockResolvedValueOnce(makeDelivery({ id: "del-retry-3" }));

      // First succeeds, second fails, third succeeds
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      fetchSpy
        .mockResolvedValueOnce(new Response("OK", { status: 200 }))
        .mockResolvedValueOnce(new Response("Error", { status: 500 }))
        .mockResolvedValueOnce(new Response("OK", { status: 200 }));

      const result = await retryFailedDeliveries();

      expect(result.processed).toBe(3);
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(1);

      vi.restoreAllMocks();
    });

    it("limits batch to 50 deliveries", async () => {
      const { retryFailedDeliveries } = await import("~/services/webhook-delivery.server");
      mockDeliveryFindMany.mockResolvedValue([]);

      await retryFailedDeliveries();

      const findManyArg = mockDeliveryFindMany.mock.calls[0][0];
      expect(findManyArg.take).toBe(50);
    });
  });
});

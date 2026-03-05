import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockIsFeatureEnabled = vi.fn();
const mockDispatchWebhookEvent = vi.fn();

vi.mock("~/lib/monitoring/logger.server", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("~/lib/config/feature-flags.server", () => ({
  isFeatureEnabled: mockIsFeatureEnabled,
  FEATURE_FLAG_KEYS: {
    WEBHOOKS: "FF_WEBHOOKS",
  },
}));

vi.mock("~/services/webhook-dispatcher.server", () => ({
  dispatchWebhookEvent: mockDispatchWebhookEvent,
}));

describe("webhook-emitter.server", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("emitWebhookEvent", () => {
    it("should dispatch a webhook event when the feature flag is enabled", async () => {
      const { emitWebhookEvent } = await import("~/lib/events/webhook-emitter.server");

      mockIsFeatureEnabled.mockResolvedValueOnce(true);
      mockDispatchWebhookEvent.mockResolvedValueOnce(undefined);

      await emitWebhookEvent("tenant-1", "user.created", {
        userId: "user-123",
        email: "user@example.com",
      });

      expect(mockIsFeatureEnabled).toHaveBeenCalledWith("FF_WEBHOOKS", { tenantId: "tenant-1" });
      expect(mockDispatchWebhookEvent).toHaveBeenCalledWith(
        "tenant-1",
        "user.created",
        expect.any(String), // UUID eventId
        { userId: "user-123", email: "user@example.com" },
      );
    });

    it("should pass a valid UUID as the eventId", async () => {
      const { emitWebhookEvent } = await import("~/lib/events/webhook-emitter.server");

      mockIsFeatureEnabled.mockResolvedValueOnce(true);
      mockDispatchWebhookEvent.mockResolvedValueOnce(undefined);

      await emitWebhookEvent("tenant-1", "user.updated", { name: "Alice" });

      const eventId = mockDispatchWebhookEvent.mock.calls[0][2];
      // UUID v4 format: 8-4-4-4-12 hex characters
      expect(eventId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it("should not dispatch when the webhooks feature flag is disabled", async () => {
      const { emitWebhookEvent } = await import("~/lib/events/webhook-emitter.server");

      mockIsFeatureEnabled.mockResolvedValueOnce(false);

      await emitWebhookEvent("tenant-2", "user.deleted", { userId: "user-456" });

      expect(mockIsFeatureEnabled).toHaveBeenCalledWith("FF_WEBHOOKS", { tenantId: "tenant-2" });
      expect(mockDispatchWebhookEvent).not.toHaveBeenCalled();
    });

    it("should suppress errors from isFeatureEnabled and not throw", async () => {
      const { emitWebhookEvent } = await import("~/lib/events/webhook-emitter.server");

      mockIsFeatureEnabled.mockRejectedValueOnce(new Error("Feature flag DB error"));

      // Should not throw
      await expect(
        emitWebhookEvent("tenant-1", "user.created", { userId: "user-789" }),
      ).resolves.toBeUndefined();

      expect(mockDispatchWebhookEvent).not.toHaveBeenCalled();
    });

    it("should suppress errors from dispatchWebhookEvent and not throw", async () => {
      const { emitWebhookEvent } = await import("~/lib/events/webhook-emitter.server");

      mockIsFeatureEnabled.mockResolvedValueOnce(true);
      mockDispatchWebhookEvent.mockRejectedValueOnce(new Error("Dispatch failed"));

      // Should not throw
      await expect(
        emitWebhookEvent("tenant-1", "role.assigned", { roleId: "role-1" }),
      ).resolves.toBeUndefined();
    });

    it("should log a warning when an error is suppressed", async () => {
      const { logger } = await import("~/lib/monitoring/logger.server");
      const { emitWebhookEvent } = await import("~/lib/events/webhook-emitter.server");

      const error = new Error("Something went wrong");
      mockIsFeatureEnabled.mockRejectedValueOnce(error);

      await emitWebhookEvent("tenant-1", "object.created", { objectId: "obj-1" });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: "tenant-1",
          eventType: "object.created",
          error,
        }),
        "Webhook emission failed (suppressed)",
      );
    });

    it("should pass the correct tenantId to the feature flag check", async () => {
      const { emitWebhookEvent } = await import("~/lib/events/webhook-emitter.server");

      mockIsFeatureEnabled.mockResolvedValueOnce(false);

      await emitWebhookEvent("tenant-special-99", "broadcast.sent", { broadcastId: "b-1" });

      expect(mockIsFeatureEnabled).toHaveBeenCalledWith("FF_WEBHOOKS", {
        tenantId: "tenant-special-99",
      });
    });

    it("should handle empty data objects", async () => {
      const { emitWebhookEvent } = await import("~/lib/events/webhook-emitter.server");

      mockIsFeatureEnabled.mockResolvedValueOnce(true);
      mockDispatchWebhookEvent.mockResolvedValueOnce(undefined);

      await emitWebhookEvent("tenant-1", "ping", {});

      expect(mockDispatchWebhookEvent).toHaveBeenCalledWith(
        "tenant-1",
        "ping",
        expect.any(String),
        {},
      );
    });

    it("should generate a unique eventId for each call", async () => {
      const { emitWebhookEvent } = await import("~/lib/events/webhook-emitter.server");

      mockIsFeatureEnabled.mockResolvedValue(true);
      mockDispatchWebhookEvent.mockResolvedValue(undefined);

      await emitWebhookEvent("tenant-1", "event.a", { a: 1 });
      await emitWebhookEvent("tenant-1", "event.b", { b: 2 });

      const eventId1 = mockDispatchWebhookEvent.mock.calls[0][2];
      const eventId2 = mockDispatchWebhookEvent.mock.calls[1][2];
      expect(eventId1).not.toBe(eventId2);
    });
  });
});

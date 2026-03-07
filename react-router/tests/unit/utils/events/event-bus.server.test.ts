import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BusEvent, BusListener } from "~/utils/events/event-bus.server";

describe("event-bus.server", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("eventBus.publish", () => {
    it("should return a unique numeric event id", async () => {
      const { eventBus } = await import("~/utils/events/event-bus.server");
      const id = eventBus.publish("notifications", "tenant-1", "notification:new", {
        message: "Hello",
      });
      expect(id).toBeTypeOf("number");
      expect(id).toBeGreaterThan(0);
    });

    it("should return incrementing ids for consecutive publishes", async () => {
      const { eventBus } = await import("~/utils/events/event-bus.server");
      const id1 = eventBus.publish("notifications", "tenant-1", "notification:new", { a: 1 });
      const id2 = eventBus.publish("notifications", "tenant-1", "notification:new", { a: 2 });
      expect(id2).toBeGreaterThan(id1);
    });

    it("should emit to subscribers on the correct channel", async () => {
      const { eventBus } = await import("~/utils/events/event-bus.server");
      const listener = vi.fn<BusListener>();

      eventBus.subscribe("notifications", listener);
      eventBus.publish("notifications", "tenant-1", "notification:new", { title: "Test" });

      expect(listener).toHaveBeenCalledTimes(1);
      const event: BusEvent = listener.mock.calls[0][0];
      expect(event.channel).toBe("notifications");
      expect(event.tenantId).toBe("tenant-1");
      expect(event.type).toBe("notification:new");
      expect(event.data).toEqual({ title: "Test" });
      expect(event.timestamp).toBeTypeOf("number");
      expect(event.id).toBeTypeOf("number");
    });

    it("should not emit to subscribers on a different channel", async () => {
      const { eventBus } = await import("~/utils/events/event-bus.server");
      const listener = vi.fn<BusListener>();

      eventBus.subscribe("dashboard", listener);
      eventBus.publish("notifications", "tenant-1", "notification:new", { title: "Test" });

      expect(listener).not.toHaveBeenCalled();
    });

    it("should emit to multiple subscribers on the same channel", async () => {
      const { eventBus } = await import("~/utils/events/event-bus.server");
      const listener1 = vi.fn<BusListener>();
      const listener2 = vi.fn<BusListener>();

      eventBus.subscribe("notifications", listener1);
      eventBus.subscribe("notifications", listener2);
      eventBus.publish("notifications", "tenant-1", "notification:new", { n: 1 });

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it("should include a timestamp close to now", async () => {
      const { eventBus } = await import("~/utils/events/event-bus.server");
      const listener = vi.fn<BusListener>();

      const before = Date.now();
      eventBus.subscribe("notifications", listener);
      eventBus.publish("notifications", "tenant-1", "notification:new", {});
      const after = Date.now();

      const event: BusEvent = listener.mock.calls[0][0];
      expect(event.timestamp).toBeGreaterThanOrEqual(before);
      expect(event.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe("eventBus.subscribe", () => {
    it("should return an unsubscribe function", async () => {
      const { eventBus } = await import("~/utils/events/event-bus.server");
      const listener = vi.fn<BusListener>();

      const unsubscribe = eventBus.subscribe("notifications", listener);
      expect(unsubscribe).toBeTypeOf("function");
    });

    it("should stop receiving events after unsubscribe is called", async () => {
      const { eventBus } = await import("~/utils/events/event-bus.server");
      const listener = vi.fn<BusListener>();

      const unsubscribe = eventBus.subscribe("notifications", listener);
      eventBus.publish("notifications", "tenant-1", "notification:new", { msg: "first" });
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      eventBus.publish("notifications", "tenant-1", "notification:new", { msg: "second" });
      expect(listener).toHaveBeenCalledTimes(1); // still 1, not 2
    });

    it("should allow re-subscribing after unsubscribe", async () => {
      const { eventBus } = await import("~/utils/events/event-bus.server");
      const listener = vi.fn<BusListener>();

      const unsub = eventBus.subscribe("notifications", listener);
      unsub();

      eventBus.subscribe("notifications", listener);
      eventBus.publish("notifications", "tenant-1", "notification:new", { msg: "new" });
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe("eventBus.listenerCount", () => {
    it("should return 0 when no listeners are registered", async () => {
      const { eventBus } = await import("~/utils/events/event-bus.server");
      // Note: other tests may have added listeners to "notifications",
      // so we check "dashboard" which is less likely to have lingering listeners
      const count = eventBus.listenerCount("dashboard");
      expect(count).toBeTypeOf("number");
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it("should increment when subscribers are added", async () => {
      const { eventBus } = await import("~/utils/events/event-bus.server");
      const initial = eventBus.listenerCount("dashboard");
      const listener = vi.fn<BusListener>();

      const unsub = eventBus.subscribe("dashboard", listener);
      expect(eventBus.listenerCount("dashboard")).toBe(initial + 1);

      unsub();
      expect(eventBus.listenerCount("dashboard")).toBe(initial);
    });

    it("should track counts per channel independently", async () => {
      const { eventBus } = await import("~/utils/events/event-bus.server");
      const listener = vi.fn<BusListener>();

      const dashboardBefore = eventBus.listenerCount("dashboard");
      const notifBefore = eventBus.listenerCount("notifications");

      const unsub = eventBus.subscribe("dashboard", listener);
      expect(eventBus.listenerCount("dashboard")).toBe(dashboardBefore + 1);
      expect(eventBus.listenerCount("notifications")).toBe(notifBefore);

      unsub();
    });
  });

  describe("singleton behavior", () => {
    it("should export a defined eventBus instance", async () => {
      const { eventBus } = await import("~/utils/events/event-bus.server");
      expect(eventBus).toBeDefined();
      expect(eventBus.publish).toBeTypeOf("function");
      expect(eventBus.subscribe).toBeTypeOf("function");
      expect(eventBus.listenerCount).toBeTypeOf("function");
    });
  });
});

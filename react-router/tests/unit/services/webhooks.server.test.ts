import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSubscriptionCreate = vi.fn();
const mockSubscriptionFindMany = vi.fn();
const mockSubscriptionFindFirst = vi.fn();
const mockSubscriptionUpdate = vi.fn();
const mockSubscriptionCount = vi.fn();
const mockAuditLogCreate = vi.fn();

vi.mock("~/utils/db/db.server", () => ({
  prisma: {
    webhookSubscription: {
      create: (...args: unknown[]) => mockSubscriptionCreate(...args),
      findMany: (...args: unknown[]) => mockSubscriptionFindMany(...args),
      findFirst: (...args: unknown[]) => mockSubscriptionFindFirst(...args),
      update: (...args: unknown[]) => mockSubscriptionUpdate(...args),
      count: (...args: unknown[]) => mockSubscriptionCount(...args),
    },
    auditLog: {
      create: (...args: unknown[]) => mockAuditLogCreate(...args),
    },
  },
}));

vi.mock("~/utils/monitoring/logger.server", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("~/utils/config/feature-flags.server", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
  FEATURE_FLAG_KEYS: { WEBHOOKS: "FF_WEBHOOKS" },
}));

const CTX = {
  userId: "user-1",
  tenantId: "tenant-1",
  ipAddress: "127.0.0.1",
  userAgent: "test-agent",
};

describe("webhooks.server", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAuditLogCreate.mockResolvedValue({});
  });

  describe("createWebhookSubscription", () => {
    it("generates 64-char hex secret", async () => {
      const { createWebhookSubscription } = await import("~/services/webhooks.server");
      mockSubscriptionCreate.mockImplementation(async ({ data }) => ({
        id: "sub-1",
        ...data,
      }));

      const result = await createWebhookSubscription(
        { url: "https://example.com/hook", events: ["*"] },
        CTX,
      );

      expect(result.secret).toMatch(/^[a-f0-9]{64}$/);
      expect(result.subscription.id).toBe("sub-1");
      expect(mockAuditLogCreate).toHaveBeenCalled();
    });
  });

  describe("listWebhookSubscriptions", () => {
    it("returns paginated results", async () => {
      const { listWebhookSubscriptions } = await import("~/services/webhooks.server");

      mockSubscriptionFindMany.mockResolvedValue([
        { id: "sub-1", url: "https://a.com" },
        { id: "sub-2", url: "https://b.com" },
      ]);
      mockSubscriptionCount.mockResolvedValue(5);

      const result = await listWebhookSubscriptions("tenant-1", { page: 1, pageSize: 2 });

      expect(result.items).toHaveLength(2);
      expect(result.meta).toEqual({
        page: 1,
        pageSize: 2,
        total: 5,
        totalPages: 3,
      });
    });
  });

  describe("pauseWebhookSubscription", () => {
    it("sets status to PAUSED", async () => {
      const { pauseWebhookSubscription } = await import("~/services/webhooks.server");

      mockSubscriptionFindFirst.mockResolvedValue({
        id: "sub-1",
        tenantId: "tenant-1",
        status: "ACTIVE",
        url: "https://example.com",
      });
      mockSubscriptionUpdate.mockResolvedValue({
        id: "sub-1",
        status: "PAUSED",
      });

      const result = await pauseWebhookSubscription("sub-1", CTX);
      expect(result.status).toBe("PAUSED");
    });
  });

  describe("resumeWebhookSubscription", () => {
    it("resets circuit breaker state", async () => {
      const { resumeWebhookSubscription } = await import("~/services/webhooks.server");

      mockSubscriptionFindFirst.mockResolvedValue({
        id: "sub-1",
        tenantId: "tenant-1",
        status: "PAUSED",
        url: "https://example.com",
      });
      mockSubscriptionUpdate.mockResolvedValue({
        id: "sub-1",
        status: "ACTIVE",
        consecutiveFailures: 0,
        circuitBreakerOpen: false,
      });

      const result = await resumeWebhookSubscription("sub-1", CTX);
      expect(result.status).toBe("ACTIVE");
      expect(mockSubscriptionUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "ACTIVE",
            consecutiveFailures: 0,
            circuitBreakerOpen: false,
            circuitBreakerResetAt: null,
          }),
        }),
      );
    });
  });
});

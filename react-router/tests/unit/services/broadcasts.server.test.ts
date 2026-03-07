import { describe, it, expect, vi, beforeEach } from "vitest";

const mockBroadcastCreate = vi.fn();
const mockBroadcastUpdate = vi.fn();
const mockBroadcastDelete = vi.fn();
const mockBroadcastFindFirst = vi.fn();
const mockBroadcastFindMany = vi.fn();
const mockBroadcastCount = vi.fn();
const mockDeliveryCreateMany = vi.fn();
const mockDeliveryDeleteMany = vi.fn();
const mockDeliveryUpdateMany = vi.fn();
const mockDeliveryFindMany = vi.fn();
const mockDeliveryCount = vi.fn();
const mockDeliveryGroupBy = vi.fn();
const mockAuditLogCreate = vi.fn();
const mockUserFindMany = vi.fn();

vi.mock("~/utils/db/db.server", () => ({
  prisma: {
    broadcastMessage: {
      create: (...args: unknown[]) => mockBroadcastCreate(...args),
      update: (...args: unknown[]) => mockBroadcastUpdate(...args),
      delete: (...args: unknown[]) => mockBroadcastDelete(...args),
      findFirst: (...args: unknown[]) => mockBroadcastFindFirst(...args),
      findMany: (...args: unknown[]) => mockBroadcastFindMany(...args),
      count: (...args: unknown[]) => mockBroadcastCount(...args),
    },
    messageDelivery: {
      createMany: (...args: unknown[]) => mockDeliveryCreateMany(...args),
      deleteMany: (...args: unknown[]) => mockDeliveryDeleteMany(...args),
      updateMany: (...args: unknown[]) => mockDeliveryUpdateMany(...args),
      findMany: (...args: unknown[]) => mockDeliveryFindMany(...args),
      count: (...args: unknown[]) => mockDeliveryCount(...args),
      groupBy: (...args: unknown[]) => mockDeliveryGroupBy(...args),
    },
    auditLog: {
      create: (...args: unknown[]) => mockAuditLogCreate(...args),
    },
    user: {
      findMany: (...args: unknown[]) => mockUserFindMany(...args),
    },
  },
}));

vi.mock("~/utils/monitoring/logger.server", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const tenantId = "tenant-1";
const userId = "user-1";
const ctx = {
  userId,
  tenantId,
  ipAddress: "127.0.0.1",
  userAgent: "test-agent",
};

const baseBroadcast = {
  id: "broadcast-1",
  tenantId,
  templateId: null,
  subject: "Test Broadcast",
  body: "Hello everyone!",
  channel: "EMAIL",
  status: "DRAFT",
  filters: {},
  scheduledAt: null,
  recipientCount: null,
  sentAt: null,
  cancelledBy: null,
  createdBy: userId,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
};

describe("broadcasts.server", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ─── createBroadcast ───────────────────────────────────

  describe("createBroadcast", () => {
    it("creates a broadcast with valid input", async () => {
      const { createBroadcast } = await import("~/services/broadcasts.server");
      mockBroadcastCreate.mockResolvedValue({ ...baseBroadcast });
      mockAuditLogCreate.mockResolvedValue({});

      const result = await createBroadcast(
        {
          subject: "Test Broadcast",
          body: "Hello everyone!",
          channel: "EMAIL",
        },
        ctx,
      );

      expect(result.id).toBe("broadcast-1");
      expect(result.status).toBe("DRAFT");
      expect(mockBroadcastCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          subject: "Test Broadcast",
          body: "Hello everyone!",
          channel: "EMAIL",
          status: "DRAFT",
          createdBy: userId,
        }),
      });
    });

    it("creates an audit log entry", async () => {
      const { createBroadcast } = await import("~/services/broadcasts.server");
      mockBroadcastCreate.mockResolvedValue({ ...baseBroadcast });
      mockAuditLogCreate.mockResolvedValue({});

      await createBroadcast(
        { subject: "Test Broadcast", body: "Hello!", channel: "EMAIL" },
        ctx,
      );

      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          userId,
          action: "CREATE",
          entityType: "BroadcastMessage",
          entityId: "broadcast-1",
        }),
      });
    });

    it("creates a broadcast with a template reference", async () => {
      const { createBroadcast } = await import("~/services/broadcasts.server");
      mockBroadcastCreate.mockResolvedValue({
        ...baseBroadcast,
        templateId: "tpl-1",
      });
      mockAuditLogCreate.mockResolvedValue({});

      const result = await createBroadcast(
        {
          subject: "Test",
          body: "Body",
          channel: "EMAIL",
          templateId: "tpl-1",
        },
        ctx,
      );

      expect(result.templateId).toBe("tpl-1");
      expect(mockBroadcastCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ templateId: "tpl-1" }),
      });
    });

    it("creates a broadcast with scheduledAt", async () => {
      const { createBroadcast } = await import("~/services/broadcasts.server");
      const scheduledAt = new Date("2025-06-01T12:00:00Z");
      mockBroadcastCreate.mockResolvedValue({
        ...baseBroadcast,
        scheduledAt,
      });
      mockAuditLogCreate.mockResolvedValue({});

      const result = await createBroadcast(
        {
          subject: "Scheduled",
          body: "Scheduled message",
          channel: "EMAIL",
          scheduledAt,
        },
        ctx,
      );

      expect(result.scheduledAt).toEqual(scheduledAt);
    });
  });

  // ─── listBroadcastsPaginated ───────────────────────────

  describe("listBroadcastsPaginated", () => {
    it("returns paginated items and totalCount", async () => {
      const { listBroadcastsPaginated } = await import("~/services/broadcasts.server");
      const items = [baseBroadcast];
      mockBroadcastFindMany.mockResolvedValue(items);
      mockBroadcastCount.mockResolvedValue(1);

      const result = await listBroadcastsPaginated(tenantId, {
        page: 1,
        pageSize: 20,
      });

      expect(result.items).toEqual(items);
      expect(result.totalCount).toBe(1);
    });

    it("applies custom where and orderBy", async () => {
      const { listBroadcastsPaginated } = await import("~/services/broadcasts.server");
      mockBroadcastFindMany.mockResolvedValue([]);
      mockBroadcastCount.mockResolvedValue(0);

      await listBroadcastsPaginated(tenantId, {
        page: 2,
        pageSize: 10,
        where: { status: "DRAFT" },
        orderBy: [{ subject: "asc" }],
      });

      expect(mockBroadcastFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId, status: "DRAFT" },
          orderBy: [{ subject: "asc" }],
          skip: 10,
          take: 10,
        }),
      );
    });

    it("uses default orderBy when none provided", async () => {
      const { listBroadcastsPaginated } = await import("~/services/broadcasts.server");
      mockBroadcastFindMany.mockResolvedValue([]);
      mockBroadcastCount.mockResolvedValue(0);

      await listBroadcastsPaginated(tenantId, {
        page: 1,
        pageSize: 20,
      });

      expect(mockBroadcastFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: "desc" },
        }),
      );
    });
  });

  // ─── listBroadcasts ────────────────────────────────────

  describe("listBroadcasts", () => {
    it("lists broadcasts with defaults", async () => {
      const { listBroadcasts } = await import("~/services/broadcasts.server");
      mockBroadcastFindMany.mockResolvedValue([baseBroadcast]);
      mockBroadcastCount.mockResolvedValue(1);

      const result = await listBroadcasts(tenantId);

      expect(result.broadcasts).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.perPage).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it("filters by status", async () => {
      const { listBroadcasts } = await import("~/services/broadcasts.server");
      mockBroadcastFindMany.mockResolvedValue([]);
      mockBroadcastCount.mockResolvedValue(0);

      await listBroadcasts(tenantId, { status: "SENT" });

      expect(mockBroadcastFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId, status: "SENT" }),
        }),
      );
    });

    it("filters by channel", async () => {
      const { listBroadcasts } = await import("~/services/broadcasts.server");
      mockBroadcastFindMany.mockResolvedValue([]);
      mockBroadcastCount.mockResolvedValue(0);

      await listBroadcasts(tenantId, { channel: "SMS" });

      expect(mockBroadcastFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId, channel: "SMS" }),
        }),
      );
    });

    it("paginates correctly", async () => {
      const { listBroadcasts } = await import("~/services/broadcasts.server");
      mockBroadcastFindMany.mockResolvedValue([]);
      mockBroadcastCount.mockResolvedValue(50);

      const result = await listBroadcasts(tenantId, { page: 3, perPage: 10 });

      expect(result.totalPages).toBe(5);
      expect(mockBroadcastFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });
  });

  // ─── getBroadcast ──────────────────────────────────────

  describe("getBroadcast", () => {
    it("returns broadcast with delivery stats", async () => {
      const { getBroadcast } = await import("~/services/broadcasts.server");
      mockBroadcastFindFirst.mockResolvedValue({
        ...baseBroadcast,
        template: { name: "Welcome" },
      });
      mockDeliveryGroupBy.mockResolvedValue([
        { status: "QUEUED", _count: 10 },
        { status: "DELIVERED", _count: 5 },
      ]);

      const result = await getBroadcast("broadcast-1", tenantId);

      expect(result.id).toBe("broadcast-1");
      expect(result.deliveryStats).toEqual({ QUEUED: 10, DELIVERED: 5 });
    });

    it("throws BroadcastError when not found", async () => {
      const { getBroadcast, BroadcastError } = await import("~/services/broadcasts.server");
      mockBroadcastFindFirst.mockResolvedValue(null);

      await expect(getBroadcast("nonexistent", tenantId)).rejects.toThrow(BroadcastError);
      await expect(getBroadcast("nonexistent", tenantId)).rejects.toThrow("Broadcast not found");
    });

    it("returns empty delivery stats when no deliveries exist", async () => {
      const { getBroadcast } = await import("~/services/broadcasts.server");
      mockBroadcastFindFirst.mockResolvedValue({
        ...baseBroadcast,
        template: null,
      });
      mockDeliveryGroupBy.mockResolvedValue([]);

      const result = await getBroadcast("broadcast-1", tenantId);

      expect(result.deliveryStats).toEqual({});
    });
  });

  // ─── getBroadcastDeliveries ────────────────────────────

  describe("getBroadcastDeliveries", () => {
    it("returns paginated deliveries for a broadcast", async () => {
      const { getBroadcastDeliveries } = await import("~/services/broadcasts.server");
      mockBroadcastFindFirst.mockResolvedValue({ id: "broadcast-1" });
      const deliveries = [
        {
          id: "del-1",
          broadcastId: "broadcast-1",
          userId: "u-1",
          status: "DELIVERED",
          user: { id: "u-1", name: "Alice", email: "alice@example.com" },
        },
      ];
      mockDeliveryFindMany.mockResolvedValue(deliveries);
      mockDeliveryCount.mockResolvedValue(1);

      const result = await getBroadcastDeliveries("broadcast-1", tenantId);

      expect(result.deliveries).toEqual(deliveries);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.perPage).toBe(20);
    });

    it("throws BroadcastError when broadcast not found", async () => {
      const { getBroadcastDeliveries, BroadcastError } = await import("~/services/broadcasts.server");
      mockBroadcastFindFirst.mockResolvedValue(null);

      await expect(getBroadcastDeliveries("nonexistent", tenantId)).rejects.toThrow(
        BroadcastError,
      );
    });

    it("paginates deliveries correctly", async () => {
      const { getBroadcastDeliveries } = await import("~/services/broadcasts.server");
      mockBroadcastFindFirst.mockResolvedValue({ id: "broadcast-1" });
      mockDeliveryFindMany.mockResolvedValue([]);
      mockDeliveryCount.mockResolvedValue(45);

      const result = await getBroadcastDeliveries("broadcast-1", tenantId, 3, 10);

      expect(result.totalPages).toBe(5);
      expect(mockDeliveryFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });
  });

  // ─── getBroadcastWithCounts ────────────────────────────

  describe("getBroadcastWithCounts", () => {
    it("returns broadcast with delivery count", async () => {
      const { getBroadcastWithCounts } = await import("~/services/broadcasts.server");
      mockBroadcastFindFirst.mockResolvedValue({
        ...baseBroadcast,
        template: { name: "Welcome" },
        _count: { deliveries: 42 },
      });

      const result = await getBroadcastWithCounts("broadcast-1", tenantId);

      expect(result.id).toBe("broadcast-1");
      expect(result._count.deliveries).toBe(42);
    });

    it("throws BroadcastError when not found", async () => {
      const { getBroadcastWithCounts, BroadcastError } = await import("~/services/broadcasts.server");
      mockBroadcastFindFirst.mockResolvedValue(null);

      await expect(getBroadcastWithCounts("nonexistent", tenantId)).rejects.toThrow(
        BroadcastError,
      );
    });
  });

  // ─── updateBroadcast ──────────────────────────────────

  describe("updateBroadcast", () => {
    it("updates a draft broadcast", async () => {
      const { updateBroadcast } = await import("~/services/broadcasts.server");
      mockBroadcastFindFirst.mockResolvedValue({ ...baseBroadcast, status: "DRAFT" });
      const updatedBroadcast = {
        ...baseBroadcast,
        subject: "Updated Subject",
        body: "Updated body",
      };
      mockBroadcastUpdate.mockResolvedValue(updatedBroadcast);
      mockAuditLogCreate.mockResolvedValue({});

      const result = await updateBroadcast(
        "broadcast-1",
        { subject: "Updated Subject", body: "Updated body", channel: "EMAIL" },
        ctx,
      );

      expect(result.subject).toBe("Updated Subject");
      expect(mockBroadcastUpdate).toHaveBeenCalledWith({
        where: { id: "broadcast-1" },
        data: expect.objectContaining({
          subject: "Updated Subject",
          body: "Updated body",
          channel: "EMAIL",
        }),
      });
    });

    it("throws BroadcastError when broadcast not found", async () => {
      const { updateBroadcast, BroadcastError } = await import("~/services/broadcasts.server");
      mockBroadcastFindFirst.mockResolvedValue(null);

      await expect(
        updateBroadcast("nonexistent", { body: "Updated", channel: "EMAIL" }, ctx),
      ).rejects.toThrow(BroadcastError);
    });

    it("throws BroadcastError when broadcast is not DRAFT", async () => {
      const { updateBroadcast, BroadcastError } = await import("~/services/broadcasts.server");
      mockBroadcastFindFirst.mockResolvedValue({ ...baseBroadcast, status: "SENT" });

      await expect(
        updateBroadcast("broadcast-1", { body: "Updated", channel: "EMAIL" }, ctx),
      ).rejects.toThrow("Only draft broadcasts can be edited");
    });

    it("throws for SENDING status", async () => {
      const { updateBroadcast } = await import("~/services/broadcasts.server");
      mockBroadcastFindFirst.mockResolvedValue({ ...baseBroadcast, status: "SENDING" });

      await expect(
        updateBroadcast("broadcast-1", { body: "Edit", channel: "EMAIL" }, ctx),
      ).rejects.toThrow("Only draft broadcasts can be edited");
    });

    it("creates an audit log entry on update", async () => {
      const { updateBroadcast } = await import("~/services/broadcasts.server");
      mockBroadcastFindFirst.mockResolvedValue({ ...baseBroadcast, status: "DRAFT" });
      mockBroadcastUpdate.mockResolvedValue({ ...baseBroadcast, subject: "Edited" });
      mockAuditLogCreate.mockResolvedValue({});

      await updateBroadcast("broadcast-1", { body: "Hi", channel: "EMAIL" }, ctx);

      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "UPDATE",
          entityType: "BroadcastMessage",
          entityId: "broadcast-1",
        }),
      });
    });

    it("sets templateId to null when not provided", async () => {
      const { updateBroadcast } = await import("~/services/broadcasts.server");
      mockBroadcastFindFirst.mockResolvedValue({ ...baseBroadcast, status: "DRAFT" });
      mockBroadcastUpdate.mockResolvedValue(baseBroadcast);
      mockAuditLogCreate.mockResolvedValue({});

      await updateBroadcast("broadcast-1", { body: "Hi", channel: "EMAIL" }, ctx);

      expect(mockBroadcastUpdate).toHaveBeenCalledWith({
        where: { id: "broadcast-1" },
        data: expect.objectContaining({ templateId: null }),
      });
    });
  });

  // ─── deleteBroadcast ──────────────────────────────────

  describe("deleteBroadcast", () => {
    it("deletes a draft broadcast and its deliveries", async () => {
      const { deleteBroadcast } = await import("~/services/broadcasts.server");
      mockBroadcastFindFirst.mockResolvedValue({ ...baseBroadcast, status: "DRAFT" });
      mockDeliveryDeleteMany.mockResolvedValue({ count: 0 });
      mockBroadcastDelete.mockResolvedValue({});
      mockAuditLogCreate.mockResolvedValue({});

      await deleteBroadcast("broadcast-1", ctx);

      expect(mockDeliveryDeleteMany).toHaveBeenCalledWith({
        where: { broadcastId: "broadcast-1" },
      });
      expect(mockBroadcastDelete).toHaveBeenCalledWith({ where: { id: "broadcast-1" } });
    });

    it("throws BroadcastError when broadcast not found", async () => {
      const { deleteBroadcast, BroadcastError } = await import("~/services/broadcasts.server");
      mockBroadcastFindFirst.mockResolvedValue(null);

      await expect(deleteBroadcast("nonexistent", ctx)).rejects.toThrow(BroadcastError);
    });

    it("throws BroadcastError when broadcast is SENDING", async () => {
      const { deleteBroadcast } = await import("~/services/broadcasts.server");
      mockBroadcastFindFirst.mockResolvedValue({ ...baseBroadcast, status: "SENDING" });

      await expect(deleteBroadcast("broadcast-1", ctx)).rejects.toThrow(
        "Cannot delete a broadcast that is currently sending",
      );
    });

    it("allows deleting a SENT broadcast", async () => {
      const { deleteBroadcast } = await import("~/services/broadcasts.server");
      mockBroadcastFindFirst.mockResolvedValue({ ...baseBroadcast, status: "SENT" });
      mockDeliveryDeleteMany.mockResolvedValue({ count: 10 });
      mockBroadcastDelete.mockResolvedValue({});
      mockAuditLogCreate.mockResolvedValue({});

      await deleteBroadcast("broadcast-1", ctx);

      expect(mockBroadcastDelete).toHaveBeenCalledWith({ where: { id: "broadcast-1" } });
    });

    it("allows deleting a CANCELLED broadcast", async () => {
      const { deleteBroadcast } = await import("~/services/broadcasts.server");
      mockBroadcastFindFirst.mockResolvedValue({ ...baseBroadcast, status: "CANCELLED" });
      mockDeliveryDeleteMany.mockResolvedValue({ count: 5 });
      mockBroadcastDelete.mockResolvedValue({});
      mockAuditLogCreate.mockResolvedValue({});

      await deleteBroadcast("broadcast-1", ctx);

      expect(mockBroadcastDelete).toHaveBeenCalled();
    });

    it("creates an audit log entry on delete", async () => {
      const { deleteBroadcast } = await import("~/services/broadcasts.server");
      mockBroadcastFindFirst.mockResolvedValue({ ...baseBroadcast, status: "DRAFT" });
      mockDeliveryDeleteMany.mockResolvedValue({ count: 0 });
      mockBroadcastDelete.mockResolvedValue({});
      mockAuditLogCreate.mockResolvedValue({});

      await deleteBroadcast("broadcast-1", ctx);

      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "DELETE",
          entityType: "BroadcastMessage",
          entityId: "broadcast-1",
        }),
      });
    });
  });

  // ─── sendBroadcast ─────────────────────────────────────

  describe("sendBroadcast", () => {
    it("sends a DRAFT broadcast and creates delivery records", async () => {
      const { sendBroadcast } = await import("~/services/broadcasts.server");
      mockBroadcastFindFirst
        .mockResolvedValueOnce({
          ...baseBroadcast,
          status: "DRAFT",
          filters: { roles: ["ATTENDEE"] },
        })
        .mockResolvedValueOnce({ ...baseBroadcast, status: "SENDING" });
      mockBroadcastUpdate.mockResolvedValue({});
      mockUserFindMany.mockResolvedValue([
        { id: "u-1", email: "alice@example.com", name: "Alice" },
        { id: "u-2", email: "bob@example.com", name: "Bob" },
      ]);
      mockDeliveryCreateMany.mockResolvedValue({ count: 2 });

      const result = await sendBroadcast("broadcast-1", ctx);

      // Sets status to SENDING
      expect(mockBroadcastUpdate).toHaveBeenCalledWith({
        where: { id: "broadcast-1" },
        data: { status: "SENDING", sentAt: expect.any(Date) },
      });
      // Sets recipientCount
      expect(mockBroadcastUpdate).toHaveBeenCalledWith({
        where: { id: "broadcast-1" },
        data: { recipientCount: 2 },
      });
      // Creates delivery records
      expect(mockDeliveryCreateMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            broadcastId: "broadcast-1",
            userId: "u-1",
            channel: "EMAIL",
            recipient: "alice@example.com",
            status: "QUEUED",
          }),
          expect.objectContaining({
            broadcastId: "broadcast-1",
            userId: "u-2",
            channel: "EMAIL",
            recipient: "bob@example.com",
            status: "QUEUED",
          }),
        ]),
      });
    });

    it("sends a SCHEDULED broadcast", async () => {
      const { sendBroadcast } = await import("~/services/broadcasts.server");
      mockBroadcastFindFirst
        .mockResolvedValueOnce({
          ...baseBroadcast,
          status: "SCHEDULED",
          filters: {},
        })
        .mockResolvedValueOnce({ ...baseBroadcast, status: "SENDING" });
      mockBroadcastUpdate.mockResolvedValue({});
      mockUserFindMany.mockResolvedValue([]);
      mockDeliveryCreateMany.mockResolvedValue({ count: 0 });

      await sendBroadcast("broadcast-1", ctx);

      expect(mockBroadcastUpdate).toHaveBeenCalledWith({
        where: { id: "broadcast-1" },
        data: { status: "SENDING", sentAt: expect.any(Date) },
      });
    });

    it("throws BroadcastError when broadcast not found", async () => {
      const { sendBroadcast, BroadcastError } = await import("~/services/broadcasts.server");
      mockBroadcastFindFirst.mockResolvedValue(null);

      await expect(sendBroadcast("nonexistent", ctx)).rejects.toThrow(BroadcastError);
    });

    it("throws BroadcastError when status is SENT", async () => {
      const { sendBroadcast } = await import("~/services/broadcasts.server");
      mockBroadcastFindFirst.mockResolvedValue({ ...baseBroadcast, status: "SENT" });

      await expect(sendBroadcast("broadcast-1", ctx)).rejects.toThrow(
        "Cannot send a broadcast with status SENT",
      );
    });

    it("throws BroadcastError when status is CANCELLED", async () => {
      const { sendBroadcast } = await import("~/services/broadcasts.server");
      mockBroadcastFindFirst.mockResolvedValue({ ...baseBroadcast, status: "CANCELLED" });

      await expect(sendBroadcast("broadcast-1", ctx)).rejects.toThrow(
        "Cannot send a broadcast with status CANCELLED",
      );
    });

    it("handles IN_APP channel recipients", async () => {
      const { sendBroadcast } = await import("~/services/broadcasts.server");
      mockBroadcastFindFirst
        .mockResolvedValueOnce({
          ...baseBroadcast,
          status: "DRAFT",
          channel: "IN_APP",
          filters: {},
        })
        .mockResolvedValueOnce({ ...baseBroadcast, channel: "IN_APP", status: "SENDING" });
      mockBroadcastUpdate.mockResolvedValue({});
      mockUserFindMany.mockResolvedValue([
        { id: "u-1", email: "alice@example.com", name: "Alice" },
      ]);
      mockDeliveryCreateMany.mockResolvedValue({ count: 1 });

      await sendBroadcast("broadcast-1", ctx);

      expect(mockDeliveryCreateMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            channel: "IN_APP",
            recipient: "alice@example.com",
          }),
        ],
      });
    });

    it("handles SMS channel with empty recipient", async () => {
      const { sendBroadcast } = await import("~/services/broadcasts.server");
      mockBroadcastFindFirst
        .mockResolvedValueOnce({
          ...baseBroadcast,
          status: "DRAFT",
          channel: "SMS",
          filters: {},
        })
        .mockResolvedValueOnce({ ...baseBroadcast, channel: "SMS", status: "SENDING" });
      mockBroadcastUpdate.mockResolvedValue({});
      mockUserFindMany.mockResolvedValue([
        { id: "u-1", email: "alice@example.com", name: "Alice" },
      ]);
      mockDeliveryCreateMany.mockResolvedValue({ count: 1 });

      await sendBroadcast("broadcast-1", ctx);

      expect(mockDeliveryCreateMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            channel: "SMS",
            recipient: "",
          }),
        ],
      });
    });

    it("handles PUSH channel with empty recipient", async () => {
      const { sendBroadcast } = await import("~/services/broadcasts.server");
      mockBroadcastFindFirst
        .mockResolvedValueOnce({
          ...baseBroadcast,
          status: "DRAFT",
          channel: "PUSH",
          filters: {},
        })
        .mockResolvedValueOnce({ ...baseBroadcast, channel: "PUSH", status: "SENDING" });
      mockBroadcastUpdate.mockResolvedValue({});
      mockUserFindMany.mockResolvedValue([
        { id: "u-1", email: null, name: "Alice" },
      ]);
      mockDeliveryCreateMany.mockResolvedValue({ count: 1 });

      await sendBroadcast("broadcast-1", ctx);

      expect(mockDeliveryCreateMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            channel: "PUSH",
            recipient: "",
          }),
        ],
      });
    });

    it("creates deliveries in batches when audience exceeds 100", async () => {
      const { sendBroadcast } = await import("~/services/broadcasts.server");
      // Generate 150 contacts
      const contacts = Array.from({ length: 150 }, (_, i) => ({
        id: `u-${i}`,
        email: `user${i}@example.com`,
        name: `User ${i}`,
      }));
      mockBroadcastFindFirst
        .mockResolvedValueOnce({
          ...baseBroadcast,
          status: "DRAFT",
          filters: {},
        })
        .mockResolvedValueOnce({ ...baseBroadcast, status: "SENDING" });
      mockBroadcastUpdate.mockResolvedValue({});
      mockUserFindMany.mockResolvedValue(contacts);
      mockDeliveryCreateMany.mockResolvedValue({ count: 100 });

      await sendBroadcast("broadcast-1", ctx);

      // Should have been called twice: batch of 100 and batch of 50
      expect(mockDeliveryCreateMany).toHaveBeenCalledTimes(2);
      const firstBatchCall = mockDeliveryCreateMany.mock.calls[0][0];
      const secondBatchCall = mockDeliveryCreateMany.mock.calls[1][0];
      expect(firstBatchCall.data).toHaveLength(100);
      expect(secondBatchCall.data).toHaveLength(50);
    });

    it("handles null filters gracefully", async () => {
      const { sendBroadcast } = await import("~/services/broadcasts.server");
      mockBroadcastFindFirst
        .mockResolvedValueOnce({
          ...baseBroadcast,
          status: "DRAFT",
          filters: null,
        })
        .mockResolvedValueOnce({ ...baseBroadcast, status: "SENDING" });
      mockBroadcastUpdate.mockResolvedValue({});
      mockUserFindMany.mockResolvedValue([]);

      await sendBroadcast("broadcast-1", ctx);

      expect(mockBroadcastUpdate).toHaveBeenCalledWith({
        where: { id: "broadcast-1" },
        data: { recipientCount: 0 },
      });
    });
  });

  // ─── cancelBroadcast ──────────────────────────────────

  describe("cancelBroadcast", () => {
    it("cancels a SENDING broadcast", async () => {
      const { cancelBroadcast } = await import("~/services/broadcasts.server");
      mockBroadcastFindFirst.mockResolvedValue({ ...baseBroadcast, status: "SENDING" });
      mockDeliveryUpdateMany.mockResolvedValue({ count: 5 });
      mockBroadcastUpdate.mockResolvedValue({
        ...baseBroadcast,
        status: "CANCELLED",
        cancelledBy: userId,
      });
      mockAuditLogCreate.mockResolvedValue({});

      const result = await cancelBroadcast("broadcast-1", "Changed our minds", ctx);

      expect(result.status).toBe("CANCELLED");
      expect(mockDeliveryUpdateMany).toHaveBeenCalledWith({
        where: { broadcastId: "broadcast-1", status: "QUEUED" },
        data: { status: "FAILED", errorMessage: "Broadcast cancelled" },
      });
      expect(mockBroadcastUpdate).toHaveBeenCalledWith({
        where: { id: "broadcast-1" },
        data: { status: "CANCELLED", cancelledBy: userId },
      });
    });

    it("cancels a SCHEDULED broadcast", async () => {
      const { cancelBroadcast } = await import("~/services/broadcasts.server");
      mockBroadcastFindFirst.mockResolvedValue({ ...baseBroadcast, status: "SCHEDULED" });
      mockDeliveryUpdateMany.mockResolvedValue({ count: 0 });
      mockBroadcastUpdate.mockResolvedValue({
        ...baseBroadcast,
        status: "CANCELLED",
      });
      mockAuditLogCreate.mockResolvedValue({});

      const result = await cancelBroadcast("broadcast-1", undefined, ctx);

      expect(result.status).toBe("CANCELLED");
    });

    it("throws BroadcastError when broadcast not found", async () => {
      const { cancelBroadcast, BroadcastError } = await import("~/services/broadcasts.server");
      mockBroadcastFindFirst.mockResolvedValue(null);

      await expect(cancelBroadcast("nonexistent", undefined, ctx)).rejects.toThrow(
        BroadcastError,
      );
    });

    it("throws BroadcastError when status is DRAFT", async () => {
      const { cancelBroadcast } = await import("~/services/broadcasts.server");
      mockBroadcastFindFirst.mockResolvedValue({ ...baseBroadcast, status: "DRAFT" });

      await expect(cancelBroadcast("broadcast-1", undefined, ctx)).rejects.toThrow(
        "Cannot cancel a broadcast with status DRAFT",
      );
    });

    it("throws BroadcastError when status is SENT", async () => {
      const { cancelBroadcast } = await import("~/services/broadcasts.server");
      mockBroadcastFindFirst.mockResolvedValue({ ...baseBroadcast, status: "SENT" });

      await expect(cancelBroadcast("broadcast-1", undefined, ctx)).rejects.toThrow(
        "Cannot cancel a broadcast with status SENT",
      );
    });

    it("creates an audit log entry on cancel", async () => {
      const { cancelBroadcast } = await import("~/services/broadcasts.server");
      mockBroadcastFindFirst.mockResolvedValue({ ...baseBroadcast, status: "SENDING" });
      mockDeliveryUpdateMany.mockResolvedValue({ count: 0 });
      mockBroadcastUpdate.mockResolvedValue({
        ...baseBroadcast,
        status: "CANCELLED",
      });
      mockAuditLogCreate.mockResolvedValue({});

      await cancelBroadcast("broadcast-1", "Reason", ctx);

      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "UPDATE",
          entityType: "BroadcastMessage",
          entityId: "broadcast-1",
          description: expect.stringContaining("Cancelled broadcast"),
        }),
      });
    });
  });

  // ─── BroadcastError ────────────────────────────────────

  describe("BroadcastError", () => {
    it("has correct default properties", async () => {
      const { BroadcastError } = await import("~/services/broadcasts.server");

      const error = new BroadcastError("Something went wrong");

      expect(error.message).toBe("Something went wrong");
      expect(error.code).toBe("BROADCAST_ERROR");
      expect(error.status).toBe(400);
      expect(error.name).toBe("BroadcastError");
    });

    it("accepts custom code and status", async () => {
      const { BroadcastError } = await import("~/services/broadcasts.server");

      const error = new BroadcastError("Not found", "NOT_FOUND", 404);

      expect(error.code).toBe("NOT_FOUND");
      expect(error.status).toBe(404);
    });

    it("is an instance of ServiceError", async () => {
      const { BroadcastError } = await import("~/services/broadcasts.server");
      const { ServiceError } = await import("~/utils/errors/service-error.server");

      const error = new BroadcastError("test");

      expect(error).toBeInstanceOf(ServiceError);
    });
  });
});

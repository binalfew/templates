import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();
const mockCount = vi.fn();
const mockFindMany = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateMany = vi.fn();
const mockDelete = vi.fn();

const mockPublish = vi.fn();

vi.mock("~/lib/db/db.server", () => ({
  prisma: {
    notification: {
      create: (...args: unknown[]) => mockCreate(...args),
      count: (...args: unknown[]) => mockCount(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
    },
  },
}));

vi.mock("~/lib/events/event-bus.server", () => ({
  eventBus: {
    publish: (...args: unknown[]) => mockPublish(...args),
  },
}));

describe("notifications.server", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ─── createNotification ──────────────────────────────────

  describe("createNotification", () => {
    it("creates a notification and publishes an event", async () => {
      const { createNotification } = await import("../notifications.server");
      const mockNotification = {
        id: "notif-1",
        userId: "u-1",
        tenantId: "t-1",
        type: "INFO",
        title: "Welcome",
        message: "Welcome to the platform",
        read: false,
        readAt: null,
        data: null,
        createdAt: new Date(),
      };
      mockCreate.mockResolvedValue(mockNotification);

      const result = await createNotification({
        userId: "u-1",
        tenantId: "t-1",
        type: "INFO",
        title: "Welcome",
        message: "Welcome to the platform",
      });

      expect(result).toEqual(mockNotification);
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          userId: "u-1",
          tenantId: "t-1",
          type: "INFO",
          title: "Welcome",
          message: "Welcome to the platform",
        },
      });
      expect(mockPublish).toHaveBeenCalledWith("notifications", "t-1", "notification:new", {
        notificationId: "notif-1",
        title: "Welcome",
        message: "Welcome to the platform",
      });
    });

    it("creates a notification with optional data field", async () => {
      const { createNotification } = await import("../notifications.server");
      const extraData = { link: "/dashboard", category: "onboarding" };
      mockCreate.mockResolvedValue({
        id: "notif-2",
        userId: "u-1",
        tenantId: "t-1",
        type: "ACTION",
        title: "Complete Profile",
        message: "Please complete your profile",
        data: extraData,
      });

      const result = await createNotification({
        userId: "u-1",
        tenantId: "t-1",
        type: "ACTION",
        title: "Complete Profile",
        message: "Please complete your profile",
        data: extraData,
      });

      expect(result.data).toEqual(extraData);
      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          data: extraData,
        }),
      });
    });

    it("does not include data field when data is null", async () => {
      const { createNotification } = await import("../notifications.server");
      mockCreate.mockResolvedValue({ id: "notif-3" });

      await createNotification({
        userId: "u-1",
        tenantId: "t-1",
        type: "INFO",
        title: "Test",
        message: "Test message",
        data: null as unknown as undefined,
      });

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.data).not.toHaveProperty("data");
    });

    it("still returns the notification when eventBus.publish throws", async () => {
      const { createNotification } = await import("../notifications.server");
      const mockNotification = {
        id: "notif-4",
        userId: "u-1",
        tenantId: "t-1",
        type: "WARN",
        title: "Alert",
        message: "Something happened",
      };
      mockCreate.mockResolvedValue(mockNotification);
      mockPublish.mockImplementation(() => {
        throw new Error("SSE connection broken");
      });

      const result = await createNotification({
        userId: "u-1",
        tenantId: "t-1",
        type: "WARN",
        title: "Alert",
        message: "Something happened",
      });

      expect(result).toEqual(mockNotification);
      expect(mockPublish).toHaveBeenCalled();
    });
  });

  // ─── getUnreadCount ──────────────────────────────────────

  describe("getUnreadCount", () => {
    it("returns the count of unread notifications", async () => {
      const { getUnreadCount } = await import("../notifications.server");
      mockCount.mockResolvedValue(5);

      const result = await getUnreadCount("u-1");

      expect(result).toBe(5);
      expect(mockCount).toHaveBeenCalledWith({
        where: { userId: "u-1", read: false },
      });
    });

    it("returns zero when no unread notifications", async () => {
      const { getUnreadCount } = await import("../notifications.server");
      mockCount.mockResolvedValue(0);

      const result = await getUnreadCount("u-1");

      expect(result).toBe(0);
    });
  });

  // ─── listNotifications ──────────────────────────────────

  describe("listNotifications", () => {
    it("returns paginated notifications with defaults", async () => {
      const { listNotifications } = await import("../notifications.server");
      const mockNotifications = [
        { id: "notif-1", title: "First", read: false },
        { id: "notif-2", title: "Second", read: true },
      ];
      mockFindMany.mockResolvedValue(mockNotifications);
      mockCount.mockResolvedValue(2);

      const result = await listNotifications("u-1");

      expect(result).toEqual({
        notifications: mockNotifications,
        total: 2,
        page: 1,
        perPage: 20,
        totalPages: 1,
      });
      expect(mockFindMany).toHaveBeenCalledWith({
        where: { userId: "u-1" },
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 20,
      });
    });

    it("supports custom page and perPage", async () => {
      const { listNotifications } = await import("../notifications.server");
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(50);

      const result = await listNotifications("u-1", { page: 3, perPage: 10 });

      expect(result.page).toBe(3);
      expect(result.perPage).toBe(10);
      expect(result.totalPages).toBe(5);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );
    });

    it("filters by type when provided", async () => {
      const { listNotifications } = await import("../notifications.server");
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await listNotifications("u-1", { type: "ALERT" });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "u-1", type: "ALERT" },
        }),
      );
    });

    it("filters by read status when provided", async () => {
      const { listNotifications } = await import("../notifications.server");
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await listNotifications("u-1", { read: false });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "u-1", read: false },
        }),
      );
    });

    it("combines type and read filters", async () => {
      const { listNotifications } = await import("../notifications.server");
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await listNotifications("u-1", { type: "INFO", read: true });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "u-1", type: "INFO", read: true },
        }),
      );
    });

    it("calculates totalPages correctly with partial last page", async () => {
      const { listNotifications } = await import("../notifications.server");
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(25);

      const result = await listNotifications("u-1", { perPage: 10 });

      expect(result.totalPages).toBe(3);
    });
  });

  // ─── markAsRead ──────────────────────────────────────────

  describe("markAsRead", () => {
    it("marks a single notification as read", async () => {
      const { markAsRead } = await import("../notifications.server");
      const now = new Date();
      mockUpdate.mockResolvedValue({
        id: "notif-1",
        userId: "u-1",
        read: true,
        readAt: now,
      });

      const result = await markAsRead("notif-1", "u-1");

      expect(result.read).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "notif-1", userId: "u-1" },
        data: { read: true, readAt: expect.any(Date) },
      });
    });

    it("throws when notification does not exist or belongs to another user", async () => {
      const { markAsRead } = await import("../notifications.server");
      mockUpdate.mockRejectedValue(new Error("Record to update not found."));

      await expect(markAsRead("notif-999", "u-1")).rejects.toThrow(
        "Record to update not found.",
      );
    });
  });

  // ─── markAllAsRead ──────────────────────────────────────

  describe("markAllAsRead", () => {
    it("marks all unread notifications as read for the user", async () => {
      const { markAllAsRead } = await import("../notifications.server");
      mockUpdateMany.mockResolvedValue({ count: 3 });

      const result = await markAllAsRead("u-1");

      expect(result.count).toBe(3);
      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: { userId: "u-1", read: false },
        data: { read: true, readAt: expect.any(Date) },
      });
    });

    it("returns count of zero when no unread notifications exist", async () => {
      const { markAllAsRead } = await import("../notifications.server");
      mockUpdateMany.mockResolvedValue({ count: 0 });

      const result = await markAllAsRead("u-1");

      expect(result.count).toBe(0);
    });
  });

  // ─── deleteNotification ──────────────────────────────────

  describe("deleteNotification", () => {
    it("deletes a notification by id and userId", async () => {
      const { deleteNotification } = await import("../notifications.server");
      mockDelete.mockResolvedValue({ id: "notif-1" });

      await deleteNotification("notif-1", "u-1");

      expect(mockDelete).toHaveBeenCalledWith({
        where: { id: "notif-1", userId: "u-1" },
      });
    });

    it("throws when the notification does not exist", async () => {
      const { deleteNotification } = await import("../notifications.server");
      mockDelete.mockRejectedValue(new Error("Record to delete does not exist."));

      await expect(deleteNotification("notif-999", "u-1")).rejects.toThrow(
        "Record to delete does not exist.",
      );
    });
  });
});

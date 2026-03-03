import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

const mockCreate = vi.fn().mockReturnValue({
  catch: vi.fn(),
});

vi.mock("~/lib/db/db.server", () => ({
  prisma: {
    auditLog: {
      create: mockCreate,
    },
  },
}));

function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    ip: "192.168.1.100",
    path: "/api/test",
    method: "POST",
    headers: { "user-agent": "Mozilla/5.0" },
    socket: { remoteAddress: "192.168.1.100" },
    ...overrides,
  } as unknown as Request;
}

function createMockRes(overrides: Record<string, unknown> = {}): Response {
  return {
    locals: {},
    ...overrides,
  } as unknown as Response;
}

describe("rate-limit-audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("extractViolationContext", () => {
    it("builds context from req/res", async () => {
      const { extractViolationContext } = await import("../rate-limit-audit.js");

      const req = createMockReq();
      const res = createMockRes();
      res.locals.userId = "user-abc";

      const ctx = extractViolationContext(req, res, "auth", 10);

      expect(ctx).toEqual({
        userId: "user-abc",
        ip: "192.168.1.100",
        path: "/api/test",
        method: "POST",
        tier: "auth",
        limit: 10,
        userAgent: "Mozilla/5.0",
      });
    });

    it("returns null userId when not set", async () => {
      const { extractViolationContext } = await import("../rate-limit-audit.js");

      const req = createMockReq();
      const res = createMockRes();

      const ctx = extractViolationContext(req, res, "general", 100);

      expect(ctx.userId).toBeNull();
    });

    it("falls back to socket.remoteAddress when req.ip is empty", async () => {
      const { extractViolationContext } = await import("../rate-limit-audit.js");

      const req = createMockReq({ ip: "" });
      (req.socket as any).remoteAddress = "10.0.0.5";
      const res = createMockRes();

      const ctx = extractViolationContext(req, res, "mutation", 50);

      expect(ctx.ip).toBe("10.0.0.5");
    });
  });

  describe("logRateLimitViolation", () => {
    it("creates an auditLog entry with correct fields", async () => {
      const { logRateLimitViolation } = await import("../rate-limit-audit.js");

      logRateLimitViolation({
        userId: "user-xyz",
        ip: "10.0.0.1",
        path: "/auth/login",
        method: "POST",
        tier: "auth",
        limit: 10,
        userAgent: "TestClient/1.0",
      });

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          userId: "user-xyz",
          tenantId: "system",
          action: "RATE_LIMIT",
          entityType: "RateLimit",
          entityId: "auth",
          metadata: {
            ip: "10.0.0.1",
            path: "/auth/login",
            method: "POST",
            tier: "auth",
            limit: 10,
          },
          ipAddress: "10.0.0.1",
          userAgent: "TestClient/1.0",
        },
      });
    });

    it("handles null userId", async () => {
      const { logRateLimitViolation } = await import("../rate-limit-audit.js");

      logRateLimitViolation({
        userId: null,
        ip: "127.0.0.1",
        path: "/api/data",
        method: "GET",
        tier: "general",
        limit: 100,
        userAgent: "",
      });

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: null,
          tenantId: "system",
          action: "RATE_LIMIT",
        }),
      });
    });

    it("catches errors without crashing (fire-and-forget)", async () => {
      const mockCreateThrowing = vi.fn().mockReturnValue({
        catch: (handler: (err: Error) => void) => {
          handler(new Error("DB connection failed"));
        },
      });
      mockCreate.mockImplementation(mockCreateThrowing);

      const { logRateLimitViolation } = await import("../rate-limit-audit.js");

      expect(() =>
        logRateLimitViolation({
          userId: null,
          ip: "127.0.0.1",
          path: "/test",
          method: "GET",
          tier: "general",
          limit: 100,
          userAgent: "",
        }),
      ).not.toThrow();
    });
  });
});

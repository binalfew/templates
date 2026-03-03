import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

vi.mock("../rate-limit-audit.js", () => ({
  logRateLimitViolation: vi.fn(),
  extractViolationContext: vi.fn().mockReturnValue({
    userId: null,
    ip: "127.0.0.1",
    path: "/test",
    method: "GET",
    tier: "general",
    limit: 100,
    userAgent: "test-agent",
  }),
}));

function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    ip: "127.0.0.1",
    path: "/test",
    method: "GET",
    headers: { "user-agent": "test-agent", cookie: "" },
    socket: { remoteAddress: "127.0.0.1" },
    ...overrides,
  } as unknown as Request;
}

function createMockRes(overrides: Record<string, unknown> = {}): Response {
  const res = {
    locals: {},
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    getHeader: vi.fn().mockReturnValue(60),
    ...overrides,
  } as unknown as Response;
  return res;
}

describe("rate-limiting helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createKeyGenerator", () => {
    it("returns user:{id} when res.locals.userId is set", async () => {
      const { createKeyGenerator } = await import("../security.js");
      const keyGen = createKeyGenerator();

      const req = createMockReq();
      const res = createMockRes();
      res.locals.userId = "user-123";

      expect(keyGen(req, res)).toBe("user:user-123");
    });

    it("returns ip:{ip} when no userId is set", async () => {
      const { createKeyGenerator } = await import("../security.js");
      const keyGen = createKeyGenerator();

      const req = createMockReq({ ip: "192.168.1.1" });
      const res = createMockRes();

      expect(keyGen(req, res)).toBe("ip:192.168.1.1");
    });

    it("falls back to socket.remoteAddress when req.ip is empty", async () => {
      const { createKeyGenerator } = await import("../security.js");
      const keyGen = createKeyGenerator();

      const req = createMockReq({ ip: "" });
      (req.socket as any).remoteAddress = "10.0.0.1";
      const res = createMockRes();

      expect(keyGen(req, res)).toBe("ip:10.0.0.1");
    });

    it("different users on same IP get different keys", async () => {
      const { createKeyGenerator } = await import("../security.js");
      const keyGen = createKeyGenerator();

      const req = createMockReq({ ip: "192.168.1.1" });

      const res1 = createMockRes();
      res1.locals.userId = "alice";

      const res2 = createMockRes();
      res2.locals.userId = "bob";

      expect(keyGen(req, res1)).toBe("user:alice");
      expect(keyGen(req, res2)).toBe("user:bob");
      expect(keyGen(req, res1)).not.toBe(keyGen(req, res2));
    });
  });

  describe("skipHealthCheck", () => {
    it("returns true for /up", async () => {
      const { skipHealthCheck } = await import("../security.js");
      const req = createMockReq({ path: "/up" });
      expect(skipHealthCheck(req)).toBe(true);
    });

    it("returns false for other paths", async () => {
      const { skipHealthCheck } = await import("../security.js");
      expect(skipHealthCheck(createMockReq({ path: "/" }))).toBe(false);
      expect(skipHealthCheck(createMockReq({ path: "/api/test" }))).toBe(false);
      expect(skipHealthCheck(createMockReq({ path: "/auth/login" }))).toBe(false);
    });
  });

  describe("createRateLimitHandler", () => {
    it("returns structured 429 JSON with correct fields", async () => {
      const { createRateLimitHandler } = await import("../security.js");
      const handler = createRateLimitHandler("auth", 10);

      const req = createMockReq();
      const res = createMockRes();

      handler(req, res);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        error: "TOO_MANY_REQUESTS",
        message: "Rate limit exceeded. Please retry after 60 seconds.",
        retryAfter: 60,
        limit: 10,
        tier: "auth",
      });
    });

    it("calls logRateLimitViolation", async () => {
      const { logRateLimitViolation } = await import("../rate-limit-audit.js");
      const { createRateLimitHandler } = await import("../security.js");
      const handler = createRateLimitHandler("general", 100);

      const req = createMockReq();
      const res = createMockRes();

      handler(req, res);

      expect(logRateLimitViolation).toHaveBeenCalled();
    });

    it("uses Retry-After header value when available", async () => {
      const { createRateLimitHandler } = await import("../security.js");
      const handler = createRateLimitHandler("mutation", 50);

      const req = createMockReq();
      const res = createMockRes();
      (res.getHeader as ReturnType<typeof vi.fn>).mockReturnValue(120);

      handler(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ retryAfter: 120 }));
    });
  });

  describe("extractSessionUser", () => {
    it("sets res.locals.userId from session cookie", async () => {
      const { extractSessionUser } = await import("../security.js");

      const mockGetSession = vi
        .fn<(request: globalThis.Request) => Promise<{ get(key: string): unknown }>>()
        .mockResolvedValue({
          get: (key: string) => (key === "sessionId" ? "session-user-42" : undefined),
        });

      const middleware = extractSessionUser(mockGetSession);
      const req = createMockReq({ headers: { cookie: "test=cookie" } as any });
      const res = createMockRes();
      const next = vi.fn() as unknown as NextFunction;

      await middleware(req, res, next);

      expect(res.locals.userId).toBe("session-user-42");
      expect(next).toHaveBeenCalled();
    });

    it("calls next() even if session parsing fails", async () => {
      const { extractSessionUser } = await import("../security.js");

      const mockGetSession = vi
        .fn<(request: globalThis.Request) => Promise<{ get(key: string): unknown }>>()
        .mockRejectedValue(new Error("bad cookie"));
      const middleware = extractSessionUser(mockGetSession);

      const req = createMockReq();
      const res = createMockRes();
      const next = vi.fn() as unknown as NextFunction;

      await middleware(req, res, next);

      expect(res.locals.userId).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it("does not set userId when session has no userId", async () => {
      const { extractSessionUser } = await import("../security.js");

      const mockGetSession = vi
        .fn<(request: globalThis.Request) => Promise<{ get(key: string): unknown }>>()
        .mockResolvedValue({
          get: () => undefined,
        });

      const middleware = extractSessionUser(mockGetSession);
      const req = createMockReq();
      const res = createMockRes();
      const next = vi.fn() as unknown as NextFunction;

      await middleware(req, res, next);

      expect(res.locals.userId).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });
  });
});

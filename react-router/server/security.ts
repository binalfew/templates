import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { logRateLimitViolation, extractViolationContext } from "./rate-limit-audit.js";

const DEVELOPMENT = process.env.NODE_ENV === "development";

// ─── Nonce Generation ──────────────────────────────────────
export function nonceMiddleware(_req: Request, res: Response, next: NextFunction) {
  res.locals.cspNonce = crypto.randomBytes(16).toString("base64");
  next();
}

// ─── Helmet CSP ────────────────────────────────────────────
export function helmetMiddleware(req: Request, res: Response, next: NextFunction) {
  const nonce = res.locals.cspNonce as string;

  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'strict-dynamic'",
          `'nonce-${nonce}'`,
          ...(DEVELOPMENT ? ["'unsafe-inline'"] : []),
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "blob:", ...(DEVELOPMENT ? ["http://localhost:*"] : [])],
        connectSrc: ["'self'", ...(DEVELOPMENT ? ["ws://localhost:*", "http://localhost:*"] : [])],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        workerSrc: ["'self'", ...(DEVELOPMENT ? ["blob:"] : [])],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: DEVELOPMENT ? false : undefined,
    strictTransportSecurity: {
      maxAge: 31_536_000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  })(req, res, next);
}

// ─── CORS ──────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim());

export const corsMiddleware = cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "X-CSRF-Token", "X-API-Key", "If-Match"],
});

// ─── Session Extraction ────────────────────────────────────
export function extractSessionUser(
  getSessionFn: (request: globalThis.Request) => Promise<{ get(key: string): unknown }>,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cookie = req.headers.cookie || "";
      const fakeReq = new globalThis.Request("http://localhost", {
        headers: { Cookie: cookie },
      });
      const session = await getSessionFn(fakeReq);
      const sessionId = session.get("sessionId");
      if (sessionId && typeof sessionId === "string") {
        res.locals.userId = sessionId;
      }
    } catch {
      // Silently fail — unauthenticated users fall back to IP-based limiting
    }
    next();
  };
}

// ─── Rate Limiting Helpers ─────────────────────────────────

export function createKeyGenerator() {
  return (req: Request, res: Response): string => {
    const userId = res.locals.userId as string | undefined;
    if (userId) return `user:${userId}`;
    return `ip:${req.ip || req.socket.remoteAddress || "unknown"}`;
  };
}

export function skipHealthCheck(req: Request): boolean {
  return req.path === "/up";
}

export function createRateLimitHandler(tier: string, limit: number) {
  return (req: Request, res: Response) => {
    const retryAfter = Math.ceil(Number(res.getHeader("Retry-After")) || 60);
    res.status(429).json({
      error: "TOO_MANY_REQUESTS",
      message: `Rate limit exceeded. Please retry after ${retryAfter} seconds.`,
      retryAfter,
      limit,
      tier,
    });
    logRateLimitViolation(extractViolationContext(req, res, tier, limit));
  };
}

// ─── Rate Limiting ─────────────────────────────────────────

export const generalLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 900_000,
  limit: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: createKeyGenerator(),
  skip: skipHealthCheck,
  handler: createRateLimitHandler("general", 100),
  validate: { keyGeneratorIpFallback: false },
});

export const mutationLimiter = rateLimit({
  windowMs: 60_000,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: createKeyGenerator(),
  skip: (req: Request) =>
    skipHealthCheck(req) ||
    req.method === "GET" ||
    req.method === "HEAD" ||
    req.method === "OPTIONS",
  handler: createRateLimitHandler("mutation", 50),
  validate: { keyGeneratorIpFallback: false },
});

export const authLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: createKeyGenerator(),
  skip: skipHealthCheck,
  handler: createRateLimitHandler("auth", 10),
  validate: { keyGeneratorIpFallback: false },
});

// ─── Suspicious Request Blocking ───────────────────────────
const SCANNER_AGENTS = /sqlmap|nikto|nessus|openvas/i;
const PATH_TRAVERSAL = /\.\.\//;
const XSS_PATTERN = /<script/i;
const SQLI_PATTERN = /union\s+select/i;

export function suspiciousRequestBlocker(req: Request, res: Response, next: NextFunction) {
  const userAgent = req.headers["user-agent"] || "";
  const path = req.path;
  const url = req.originalUrl || req.url;

  if (!req.headers["user-agent"] || !req.headers["accept"]) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  if (SCANNER_AGENTS.test(userAgent)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  if (PATH_TRAVERSAL.test(path) || PATH_TRAVERSAL.test(url)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  if (XSS_PATTERN.test(url)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  if (SQLI_PATTERN.test(url)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  next();
}

// ─── Permissions Policy ────────────────────────────────────
export function permissionsPolicy(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("Permissions-Policy", "camera=(self), microphone=(), geolocation=(), payment=()");
  next();
}

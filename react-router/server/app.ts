import "react-router";
import { createRequestHandler } from "@react-router/express";
import express from "express";
import { getSession } from "~/utils/auth/session.server";
import {
  nonceMiddleware,
  helmetMiddleware,
  corsMiddleware,
  generalLimiter,
  mutationLimiter,
  authLimiter,
  suspiciousRequestBlocker,
  permissionsPolicy,
  extractSessionUser,
} from "./security.js";
declare module "react-router" {
  interface AppLoadContext {
    cspNonce: string;
  }
}

export const app = express();

// ─── Security middleware (order matters) ───────────────────
// 1. Generate a per-request nonce first (used by helmet CSP and React)
app.use(nonceMiddleware);

// 2. Set security headers (CSP with nonce, HSTS, X-Frame-Options, etc.)
app.use(helmetMiddleware);

// 3. Permissions-Policy header
app.use(permissionsPolicy);

// 4. CORS
app.use(corsMiddleware);

// 5. Block suspicious requests before they hit rate limiter or app
app.use(suspiciousRequestBlocker);

// 6. Extract session user for user-aware rate limiting
app.use(extractSessionUser(getSession));

// ─── Static asset cache headers ──────────────────────────────
app.use("/assets", (_req, res, next) => {
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  next();
});

// ─── Rate limiting ─────────────────────────────────────────
// 7. General limiter (all routes)
app.use(generalLimiter);

// 8. Mutation limiter (non-GET on /api)
app.use("/api", mutationLimiter);

// 9. Auth limiter
app.use("/auth", authLimiter);

// ─── Data Export (direct download, bypasses React Router data layer) ───
app.get("/resources/export-download", async (req, res) => {
  try {
    const { requireUserId } = await import("~/utils/auth/session.server");
    const request = new Request(`${req.protocol}://${req.get("host")}${req.originalUrl}`, {
      headers: Object.fromEntries(
        Object.entries(req.headers).filter(([, v]) => typeof v === "string") as [string, string][],
      ),
    });
    const userId = await requireUserId(request);

    const { prisma } = await import("~/utils/db/db.server");
    const user = await prisma.user.findFirst({ where: { id: userId }, select: { tenantId: true } });
    if (!user?.tenantId) {
      res.status(403).json({ error: "No tenant" });
      return;
    }

    const entity = req.query.entity as string;
    const format = req.query.format as "csv" | "json";
    if (!entity || !format) {
      res.status(400).json({ error: "Missing entity or format" });
      return;
    }

    const { exportData } = await import("~/services/data-export.server");
    const result = await exportData({
      entity,
      tenantId: user.tenantId,
      format,
    });

    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    res.send(result.content);
  } catch (err) {
    if (err instanceof Response && (err.status === 302 || err.status === 301)) {
      res.redirect(err.headers.get("Location") || "/auth/login");
      return;
    }
    console.error("Export error:", err);
    res.status(500).json({ error: "Export failed" });
  }
});

// ─── Background Job Processor ────────────────────────────────
import("~/utils/events/job-handlers.server").then(() =>
  import("~/utils/events/job-queue.server").then(({ startJobProcessor }) => startJobProcessor()),
);

// ─── React Router handler ──────────────────────────────────
app.use(
  createRequestHandler({
    build: () => import("virtual:react-router/server-build"),
    getLoadContext(_req, res) {
      return {
        cspNonce: res.locals.cspNonce as string,
      };
    },
  }),
);

import "dotenv/config";
import "./server/sentry.js";
import { captureException } from "./server/sentry.js";
import compression from "compression";
import express from "express";
import { logger } from "./server/logger.js";
import { correlationMiddleware, getCorrelationId } from "./server/correlation.js";
import { requestLogger } from "./server/request-logger.js";

// Fail fast if required environment variables are missing
const required = ["DATABASE_URL", "SESSION_SECRET"];
for (const name of required) {
  if (!process.env[name]) {
    logger.fatal(
      { variable: name },
      `Missing required environment variable: ${name}. Copy .env.example to .env and fill in the values.`,
    );
    process.exit(1);
  }
}

// Short-circuit the type-checking of the built output.
const BUILD_PATH = "./build/server/index.js";
const DEVELOPMENT = process.env.NODE_ENV === "development";
const PORT = Number.parseInt(process.env.PORT || "3000");

const app = express();

app.use(
  compression({
    filter: (req, res) => {
      // SSE must not be compressed — buffering breaks the event stream
      if (req.path === "/api/sse") return false;
      return compression.filter(req, res);
    },
  }),
);
app.disable("x-powered-by");

// Correlation ID and structured request logging for all requests
app.use(correlationMiddleware);
app.use(requestLogger);

if (DEVELOPMENT) {
  logger.info("Starting development server");
  const viteDevServer = await import("vite").then((vite) =>
    vite.createServer({
      server: { middlewareMode: true },
    }),
  );
  app.use(viteDevServer.middlewares);
  app.use(async (req, res, next) => {
    try {
      const source = await viteDevServer.ssrLoadModule("./server/app.ts");
      return await source.app(req, res, next);
    } catch (error) {
      if (typeof error === "object" && error instanceof Error) {
        viteDevServer.ssrFixStacktrace(error);
      }
      captureException(error, { correlationId: getCorrelationId() });
      next(error);
    }
  });
} else {
  logger.info("Starting production server");
  app.use(
    "/assets",
    express.static("build/client/assets", { immutable: true, maxAge: "1y" }),
  );
  app.use(express.static("build/client", { maxAge: "1h" }));
  app.use(await import(BUILD_PATH).then((mod) => mod.app));
}

app.listen(PORT, () => {
  logger.info({ port: PORT }, `Server is running on http://localhost:${PORT}`);

  const shutdown = () => {
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
});

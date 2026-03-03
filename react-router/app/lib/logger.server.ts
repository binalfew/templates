import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(isProduction
    ? {
        formatters: {
          level(label: string) {
            return { level: label };
          },
        },
      }
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:HH:MM:ss.l",
            ignore: "pid,hostname",
          },
        },
      }),
  base: {
    service: "app",
    version: process.env.APP_VERSION || "dev",
    environment: process.env.NODE_ENV || "development",
  },
  redact: {
    paths: [
      "password",
      "passwordHash",
      "token",
      "authorization",
      "cookie",
      "sessionId",
      "req.headers.authorization",
      "req.headers.cookie",
    ],
    censor: "[REDACTED]",
  },
});

export type Logger = typeof logger;

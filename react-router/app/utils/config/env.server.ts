import { z } from "zod";

/**
 * Parses a string env var as a boolean.
 * z.coerce.boolean() treats "false" as true (since Boolean("false") === true),
 * so we use z.preprocess to correctly handle string "true"/"false" values.
 */
const booleanString = z.preprocess((v) => {
  if (typeof v === "string") return v === "true" || v === "1";
  if (typeof v === "boolean") return v;
  return false;
}, z.boolean());

const envSchema = z.object({
  // Required
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_SECRET: z.string().min(16, "SESSION_SECRET must be at least 16 characters"),

  // Optional with defaults
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),
  BASE_URL: z.string().default("http://localhost:3000"),

  // Database pool
  DATABASE_POOL_MIN: z.coerce.number().default(2),
  DATABASE_POOL_MAX: z.coerce.number().default(10),
  DATABASE_QUERY_TIMEOUT: z.coerce.number().default(5000),
  DATABASE_CONNECTION_TIMEOUT: z.coerce.number().default(10000),

  // Auth
  SESSION_MAX_AGE: z.coerce.number().default(2592000000),
  BCRYPT_ROUNDS: z.coerce.number().default(10),
  MAX_LOGIN_ATTEMPTS: z.coerce.number().default(5),
  LOCKOUT_DURATION_MINUTES: z.coerce.number().default(30),

  // Monitoring
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  SENTRY_DSN: z.string().default(""),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().default(0.1),

  // Security
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  TRUSTED_PROXIES: z.coerce.number().default(1),

  // Email (Resend)
  RESEND_API_KEY: z.string().default(""),
  SMTP_FROM: z.string().default("noreply@app.local"),

  // App
  APP_URL: z.string().default("http://localhost:3000"),

  // Feature flags
  ENABLE_2FA: booleanString.default(false),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    console.error(`\nInvalid environment variables:\n${formatted}\n`);
    process.exit(1);
  }

  return result.data;
}

export const env = validateEnv();

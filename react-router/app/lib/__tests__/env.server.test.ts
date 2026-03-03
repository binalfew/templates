import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("env validation", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("should export env object with defaults when required vars are set", async () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/testdb";
    process.env.SESSION_SECRET = "test-session-secret-at-least-16-chars";

    const { env } = await import("../config/env.server");
    expect(env).toBeDefined();
    expect(env.NODE_ENV).toBeDefined();
    expect(env.PORT).toBeTypeOf("number");
    expect(env.PORT).toBe(3000);
    expect(env.DATABASE_URL).toBe("postgresql://test:test@localhost:5432/testdb");
  });

  it("should exit process when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;
    process.env.SESSION_SECRET = "test-session-secret-at-least-16-chars";

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    await expect(import("../config/env.server")).rejects.toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
  });

  it("should exit process when SESSION_SECRET is too short", async () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/testdb";
    process.env.SESSION_SECRET = "short";

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    await expect(import("../config/env.server")).rejects.toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
  });
});

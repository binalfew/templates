import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../mocks/server";

vi.mock("~/utils/monitoring/logger.server", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("email.server", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.SMTP_FROM = "noreply@test.local";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("without RESEND_API_KEY", () => {
    it("should log email to console and return mocked success", async () => {
      delete process.env.RESEND_API_KEY;
      delete process.env.MOCKS;

      const { sendEmail } = await import("~/utils/email/email.server");

      const result = await sendEmail({
        to: "user@example.com",
        subject: "Test",
        html: "<p>Hello</p>",
      });

      expect(result).toEqual({ status: "success", data: { id: "mocked" } });
    });
  });

  describe("with RESEND_API_KEY", () => {
    beforeEach(() => {
      process.env.RESEND_API_KEY = "re_test_key_123";
    });

    it("should send email via Resend API and return success", async () => {
      let capturedBody: Record<string, unknown> | null = null;

      server.use(
        http.post("https://api.resend.com/emails", async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ id: "resend-msg-001" });
        }),
      );

      const { sendEmail } = await import("~/utils/email/email.server");

      const result = await sendEmail({
        to: "user@example.com",
        subject: "Test",
        html: "<p>Hello</p>",
      });

      expect(result).toEqual({ status: "success", data: { id: "resend-msg-001" } });
      expect(capturedBody).toMatchObject({
        from: "noreply@test.local",
        to: "user@example.com",
        subject: "Test",
        html: "<p>Hello</p>",
      });
    });

    it("should join array recipients", async () => {
      let capturedBody: Record<string, unknown> | null = null;

      server.use(
        http.post("https://api.resend.com/emails", async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ id: "resend-msg-002" });
        }),
      );

      const { sendEmail } = await import("~/utils/email/email.server");

      await sendEmail({
        to: ["a@example.com", "b@example.com"],
        subject: "Multi",
        html: "<p>Hi</p>",
      });

      expect(capturedBody?.to).toBe("a@example.com, b@example.com");
    });

    it("should use custom from address when provided", async () => {
      let capturedBody: Record<string, unknown> | null = null;

      server.use(
        http.post("https://api.resend.com/emails", async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ id: "resend-msg-003" });
        }),
      );

      const { sendEmail } = await import("~/utils/email/email.server");

      await sendEmail({
        to: "user@example.com",
        subject: "Custom From",
        html: "<p>Test</p>",
        from: "custom@example.com",
      });

      expect(capturedBody?.from).toBe("custom@example.com");
    });

    it("should return error when Resend returns a known error", async () => {
      server.use(
        http.post("https://api.resend.com/emails", () =>
          HttpResponse.json(
            { name: "validation_error", message: "Invalid API key", statusCode: 403 },
            { status: 403 },
          ),
        ),
      );

      const { sendEmail } = await import("~/utils/email/email.server");

      const result = await sendEmail({
        to: "user@example.com",
        subject: "Fail",
        html: "<p>fail</p>",
      });

      expect(result).toEqual({
        status: "error",
        error: { name: "validation_error", message: "Invalid API key", statusCode: 403 },
      });
    });

    it("should return unknown error when Resend returns unexpected shape", async () => {
      server.use(
        http.post("https://api.resend.com/emails", () =>
          HttpResponse.json({ unexpected: true }, { status: 500 }),
        ),
      );

      const { sendEmail } = await import("~/utils/email/email.server");

      const result = await sendEmail({
        to: "user@example.com",
        subject: "Unknown",
        html: "<p>unknown</p>",
      });

      expect(result.status).toBe("error");
      if (result.status === "error") {
        expect(result.error.name).toBe("UnknownError");
        expect(result.error.statusCode).toBe(500);
      }
    });

    it("should log success with message ID", async () => {
      server.use(
        http.post("https://api.resend.com/emails", () =>
          HttpResponse.json({ id: "resend-msg-004" }),
        ),
      );

      const { sendEmail } = await import("~/utils/email/email.server");
      const { logger } = await import("~/utils/monitoring/logger.server");

      await sendEmail({
        to: "user@example.com",
        subject: "Log Test",
        html: "<p>logged</p>",
      });

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user@example.com",
          subject: "Log Test",
          messageId: "resend-msg-004",
        }),
        "Email sent successfully",
      );
    });
  });
});

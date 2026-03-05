import { describe, it, expect, vi, beforeEach } from "vitest";

const mockResendSend = vi.fn();
const mockSendMail = vi.fn();

vi.mock("~/lib/config/env.server", () => ({
  env: {
    RESEND_API_KEY: "",
    SMTP_HOST: "smtp.test.local",
    SMTP_PORT: 587,
    SMTP_USER: "testuser",
    SMTP_PASS: "testpass",
    SMTP_FROM: "noreply@test.local",
  },
}));

vi.mock("~/lib/monitoring/logger.server", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("resend", () => {
  // Must use a regular function (not arrow) so it can be called with `new`
  function MockResend() {
    return { emails: { send: mockResendSend } };
  }
  return { Resend: MockResend };
});

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn().mockReturnValue({
      sendMail: mockSendMail,
    }),
  },
}));

describe("email.server", () => {
  beforeEach(() => {
    // Use clearAllMocks (not resetAllMocks) to preserve mock implementations
    // while clearing call counts and recorded arguments
    vi.clearAllMocks();
    // Reset modules so that the cached `provider` singleton is re-created on import
    vi.resetModules();
  });

  describe("sendEmail (SMTP provider)", () => {
    it("should send an email via SMTP and return the message ID", async () => {
      mockSendMail.mockResolvedValue({ messageId: "smtp-msg-001" });

      const { sendEmail } = await import("~/lib/email/email.server");

      const result = await sendEmail({
        to: "user@example.com",
        subject: "Test Subject",
        html: "<p>Hello</p>",
      });

      expect(result).toEqual({ id: "smtp-msg-001" });
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "noreply@test.local",
          to: "user@example.com",
          subject: "Test Subject",
          html: "<p>Hello</p>",
        }),
      );
    });

    it("should join array recipients with comma for SMTP", async () => {
      mockSendMail.mockResolvedValue({ messageId: "smtp-msg-002" });

      const { sendEmail } = await import("~/lib/email/email.server");

      await sendEmail({
        to: ["a@example.com", "b@example.com"],
        subject: "Multi-recipient",
        html: "<p>Hi all</p>",
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "a@example.com, b@example.com",
        }),
      );
    });

    it("should pass optional text, from, and replyTo fields", async () => {
      mockSendMail.mockResolvedValue({ messageId: "smtp-msg-003" });

      const { sendEmail } = await import("~/lib/email/email.server");

      await sendEmail({
        to: "user@example.com",
        subject: "Full Options",
        html: "<p>HTML</p>",
        text: "Plain text",
        from: "custom-sender@example.com",
        replyTo: "reply@example.com",
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "custom-sender@example.com",
          text: "Plain text",
          replyTo: "reply@example.com",
        }),
      );
    });

    it("should log success after sending", async () => {
      mockSendMail.mockResolvedValue({ messageId: "smtp-msg-004" });

      const { sendEmail } = await import("~/lib/email/email.server");
      const { logger } = await import("~/lib/monitoring/logger.server");

      await sendEmail({
        to: "user@example.com",
        subject: "Log Test",
        html: "<p>logged</p>",
      });

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user@example.com",
          subject: "Log Test",
          messageId: "smtp-msg-004",
        }),
        "Email sent successfully",
      );
    });

    it("should log error and re-throw when SMTP send fails", async () => {
      const smtpError = new Error("SMTP connection refused");
      mockSendMail.mockRejectedValue(smtpError);

      const { sendEmail } = await import("~/lib/email/email.server");
      const { logger } = await import("~/lib/monitoring/logger.server");

      await expect(
        sendEmail({
          to: "user@example.com",
          subject: "Fail Test",
          html: "<p>fail</p>",
        }),
      ).rejects.toThrow("SMTP connection refused");

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user@example.com",
          subject: "Fail Test",
          error: smtpError,
        }),
        "Failed to send email",
      );
    });
  });

  describe("sendEmail (Resend provider)", () => {
    it("should use Resend when RESEND_API_KEY is set", async () => {
      const envMod = await import("~/lib/config/env.server");
      (envMod.env as Record<string, unknown>).RESEND_API_KEY = "re_test_key_123";

      mockResendSend.mockResolvedValue({
        data: { id: "resend-msg-001" },
        error: null,
      });

      const { sendEmail } = await import("~/lib/email/email.server");

      const result = await sendEmail({
        to: "user@example.com",
        subject: "Resend Test",
        html: "<p>Via Resend</p>",
      });

      expect(result).toEqual({ id: "resend-msg-001" });
      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "noreply@test.local",
          to: ["user@example.com"],
          subject: "Resend Test",
          html: "<p>Via Resend</p>",
        }),
      );

      // Clean up for other tests
      (envMod.env as Record<string, unknown>).RESEND_API_KEY = "";
    });

    it("should wrap array recipients for Resend", async () => {
      const envMod = await import("~/lib/config/env.server");
      (envMod.env as Record<string, unknown>).RESEND_API_KEY = "re_test_key_456";

      mockResendSend.mockResolvedValue({
        data: { id: "resend-msg-002" },
        error: null,
      });

      const { sendEmail } = await import("~/lib/email/email.server");

      await sendEmail({
        to: ["a@example.com", "b@example.com"],
        subject: "Array recipients",
        html: "<p>Multi</p>",
      });

      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ["a@example.com", "b@example.com"],
        }),
      );

      (envMod.env as Record<string, unknown>).RESEND_API_KEY = "";
    });

    it("should throw when Resend returns an error", async () => {
      const envMod = await import("~/lib/config/env.server");
      (envMod.env as Record<string, unknown>).RESEND_API_KEY = "re_test_key_789";

      mockResendSend.mockResolvedValue({
        data: null,
        error: { message: "Invalid API key" },
      });

      const { sendEmail } = await import("~/lib/email/email.server");

      await expect(
        sendEmail({
          to: "user@example.com",
          subject: "Error Test",
          html: "<p>fail</p>",
        }),
      ).rejects.toThrow("Resend error: Invalid API key");

      (envMod.env as Record<string, unknown>).RESEND_API_KEY = "";
    });

    it("should return 'unknown' id when Resend data is null", async () => {
      const envMod = await import("~/lib/config/env.server");
      (envMod.env as Record<string, unknown>).RESEND_API_KEY = "re_test_key_aaa";

      mockResendSend.mockResolvedValue({
        data: null,
        error: null,
      });

      const { sendEmail } = await import("~/lib/email/email.server");

      const result = await sendEmail({
        to: "user@example.com",
        subject: "Null data",
        html: "<p>no data</p>",
      });

      expect(result).toEqual({ id: "unknown" });

      (envMod.env as Record<string, unknown>).RESEND_API_KEY = "";
    });
  });
});

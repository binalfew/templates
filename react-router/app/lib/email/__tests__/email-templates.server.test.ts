import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("~/lib/config/env.server", () => ({
  env: {
    APP_URL: "https://app.test.local",
  },
}));

describe("email-templates.server", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("otpEmail", () => {
    it("should return a valid email template with the OTP code", async () => {
      const { otpEmail } = await import("../email-templates.server");

      const result = otpEmail("123456", "user@example.com");

      expect(result.subject).toBe("Your verification code");
      expect(result.html).toContain("123456");
      expect(result.html).toContain("Verify your email");
      expect(result.html).toContain("expires in 10 minutes");
      expect(result.text).toContain("Your verification code is: 123456");
      expect(result.text).toContain("expires in 10 minutes");
    });

    it("should include the HTML layout wrapper", async () => {
      const { otpEmail } = await import("../email-templates.server");

      const result = otpEmail("654321", "test@example.com");

      expect(result.html).toContain("<!DOCTYPE html>");
      expect(result.html).toContain("<html>");
      expect(result.html).toContain("</html>");
      expect(result.html).toContain("automated message");
    });

    it("should handle short OTP codes", async () => {
      const { otpEmail } = await import("../email-templates.server");

      const result = otpEmail("12", "user@example.com");

      expect(result.html).toContain("12");
      expect(result.text).toContain("Your verification code is: 12");
    });

    it("should handle alphanumeric OTP codes", async () => {
      const { otpEmail } = await import("../email-templates.server");

      const result = otpEmail("AB3F9Z", "user@example.com");

      expect(result.html).toContain("AB3F9Z");
      expect(result.text).toContain("AB3F9Z");
    });
  });

  describe("passwordResetEmail", () => {
    it("should return a template with reset URL containing token and email", async () => {
      const { passwordResetEmail } = await import("../email-templates.server");

      const result = passwordResetEmail("reset-token-abc", "user@example.com");

      expect(result.subject).toBe("Reset your password");

      const expectedUrl =
        "https://app.test.local/auth/reset-password?token=reset-token-abc&email=user%40example.com";
      expect(result.html).toContain(expectedUrl);
      expect(result.text).toContain(expectedUrl);
    });

    it("should include proper HTML layout and messaging", async () => {
      const { passwordResetEmail } = await import("../email-templates.server");

      const result = passwordResetEmail("tok-123", "alice@example.com");

      expect(result.html).toContain("Reset your password");
      expect(result.html).toContain("expires in 1 hour");
      expect(result.html).toContain("Reset Password");
      expect(result.html).toContain("<!DOCTYPE html>");
      expect(result.text).toContain("expires in 1 hour");
    });

    it("should encode special characters in token and email", async () => {
      const { passwordResetEmail } = await import("../email-templates.server");

      const result = passwordResetEmail("token+with/special=chars", "user+tag@example.com");

      // encodeURIComponent encodes + as %2B, / as %2F, = as %3D
      expect(result.html).toContain("token%2Bwith%2Fspecial%3Dchars");
      expect(result.html).toContain("user%2Btag%40example.com");
    });

    it("should include a clickable reset link in HTML", async () => {
      const { passwordResetEmail } = await import("../email-templates.server");

      const result = passwordResetEmail("my-token", "bob@test.com");

      expect(result.html).toContain('href="https://app.test.local/auth/reset-password');
      expect(result.html).toContain("Reset Password</a>");
    });
  });

  describe("invitationEmail", () => {
    it("should return a template with tenant and inviter info", async () => {
      const { invitationEmail } = await import("../email-templates.server");

      const result = invitationEmail("invite-token-xyz", "Acme Corp", "Jane Doe");

      expect(result.subject).toBe("You've been invited to Acme Corp");
      expect(result.html).toContain("Jane Doe");
      expect(result.html).toContain("Acme Corp");
      expect(result.html).toContain("Accept Invitation");
    });

    it("should build the correct accept URL", async () => {
      const { invitationEmail } = await import("../email-templates.server");

      const result = invitationEmail("tok-inv-001", "My Org", "Alice");

      const expectedUrl =
        "https://app.test.local/auth/accept-invite?token=tok-inv-001";
      expect(result.html).toContain(expectedUrl);
      expect(result.text).toContain(expectedUrl);
    });

    it("should encode special characters in token", async () => {
      const { invitationEmail } = await import("../email-templates.server");

      const result = invitationEmail("token/with+chars", "Org", "Inviter");

      expect(result.html).toContain("token%2Fwith%2Bchars");
    });

    it("should mention 7-day expiration", async () => {
      const { invitationEmail } = await import("../email-templates.server");

      const result = invitationEmail("tok", "Org", "User");

      expect(result.html).toContain("expires in 7 days");
      expect(result.text).toContain("expires in 7 days");
    });

    it("should include inviter name and tenant name in plain text", async () => {
      const { invitationEmail } = await import("../email-templates.server");

      const result = invitationEmail("tok", "Global Inc", "Bob Smith");

      expect(result.text).toContain("Bob Smith invited you to join Global Inc");
    });

    it("should wrap the content in the HTML layout", async () => {
      const { invitationEmail } = await import("../email-templates.server");

      const result = invitationEmail("tok", "Org", "Admin");

      expect(result.html).toContain("<!DOCTYPE html>");
      expect(result.html).toContain("automated message");
    });
  });

  describe("welcomeEmail", () => {
    it("should return a template with personalized greeting when name is provided", async () => {
      const { welcomeEmail } = await import("../email-templates.server");

      const result = welcomeEmail("Charlie");

      expect(result.subject).toBe("Welcome!");
      expect(result.html).toContain("Welcome, Charlie!");
      expect(result.text).toContain("Welcome, Charlie!");
    });

    it("should return a generic greeting when name is empty", async () => {
      const { welcomeEmail } = await import("../email-templates.server");

      const result = welcomeEmail("");

      expect(result.subject).toBe("Welcome!");
      expect(result.html).toContain("Welcome!");
      // Should NOT contain a comma when name is empty
      expect(result.html).not.toContain("Welcome, !");
      expect(result.text).not.toContain("Welcome, !");
    });

    it("should include the login URL", async () => {
      const { welcomeEmail } = await import("../email-templates.server");

      const result = welcomeEmail("Dana");

      const expectedLoginUrl = "https://app.test.local/auth/login";
      expect(result.html).toContain(expectedLoginUrl);
      expect(result.text).toContain(expectedLoginUrl);
    });

    it("should include the login button in HTML", async () => {
      const { welcomeEmail } = await import("../email-templates.server");

      const result = welcomeEmail("Eve");

      expect(result.html).toContain('href="https://app.test.local/auth/login"');
      expect(result.html).toContain("Log In</a>");
    });

    it("should mention account creation", async () => {
      const { welcomeEmail } = await import("../email-templates.server");

      const result = welcomeEmail("Frank");

      expect(result.html).toContain("account has been created successfully");
      expect(result.text).toContain("account has been created");
    });

    it("should wrap the content in the HTML layout", async () => {
      const { welcomeEmail } = await import("../email-templates.server");

      const result = welcomeEmail("Grace");

      expect(result.html).toContain("<!DOCTYPE html>");
      expect(result.html).toContain("</html>");
      expect(result.html).toContain("automated message");
    });
  });
});

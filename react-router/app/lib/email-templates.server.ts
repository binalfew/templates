import { env } from "~/lib/env.server";

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

function layout(content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5;color:#18181b">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px">
<tr><td align="center">
<table width="100%" style="max-width:560px;background:#fff;border-radius:8px;border:1px solid #e4e4e7;padding:40px">
<tr><td>${content}</td></tr>
</table>
<p style="color:#71717a;font-size:12px;margin-top:24px">This is an automated message. Please do not reply directly.</p>
</td></tr>
</table>
</body>
</html>`;
}

export function otpEmail(otp: string, email: string): EmailTemplate {
  return {
    subject: "Your verification code",
    html: layout(`
      <h2 style="margin:0 0 8px;font-size:20px">Verify your email</h2>
      <p style="color:#52525b;margin:0 0 24px">Enter this code to continue:</p>
      <div style="background:#f4f4f5;border-radius:8px;padding:16px;text-align:center;font-size:32px;letter-spacing:8px;font-weight:700;font-family:monospace">${otp}</div>
      <p style="color:#71717a;font-size:13px;margin:24px 0 0">This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
    `),
    text: `Your verification code is: ${otp}\n\nThis code expires in 10 minutes.`,
  };
}

export function passwordResetEmail(token: string, email: string): EmailTemplate {
  const resetUrl = `${env.APP_URL}/auth/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
  return {
    subject: "Reset your password",
    html: layout(`
      <h2 style="margin:0 0 8px;font-size:20px">Reset your password</h2>
      <p style="color:#52525b;margin:0 0 24px">Click the button below to set a new password. This link expires in 1 hour.</p>
      <a href="${resetUrl}" style="display:inline-block;background:#18181b;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:500">Reset Password</a>
      <p style="color:#71717a;font-size:13px;margin:24px 0 0">If you didn't request a password reset, you can safely ignore this email.</p>
    `),
    text: `Reset your password by visiting: ${resetUrl}\n\nThis link expires in 1 hour.`,
  };
}

export function invitationEmail(
  token: string,
  tenantName: string,
  inviterName: string,
): EmailTemplate {
  const acceptUrl = `${env.APP_URL}/auth/accept-invite?token=${encodeURIComponent(token)}`;
  return {
    subject: `You've been invited to ${tenantName}`,
    html: layout(`
      <h2 style="margin:0 0 8px;font-size:20px">You're invited!</h2>
      <p style="color:#52525b;margin:0 0 24px">${inviterName} invited you to join <strong>${tenantName}</strong>. Click the button below to accept.</p>
      <a href="${acceptUrl}" style="display:inline-block;background:#18181b;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:500">Accept Invitation</a>
      <p style="color:#71717a;font-size:13px;margin:24px 0 0">This invitation expires in 7 days.</p>
    `),
    text: `${inviterName} invited you to join ${tenantName}.\n\nAccept the invitation: ${acceptUrl}\n\nThis invitation expires in 7 days.`,
  };
}

export function welcomeEmail(name: string): EmailTemplate {
  const loginUrl = `${env.APP_URL}/auth/login`;
  return {
    subject: "Welcome!",
    html: layout(`
      <h2 style="margin:0 0 8px;font-size:20px">Welcome${name ? `, ${name}` : ""}!</h2>
      <p style="color:#52525b;margin:0 0 24px">Your account has been created successfully. You can now log in to get started.</p>
      <a href="${loginUrl}" style="display:inline-block;background:#18181b;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:500">Log In</a>
    `),
    text: `Welcome${name ? `, ${name}` : ""}! Your account has been created. Log in at: ${loginUrl}`,
  };
}

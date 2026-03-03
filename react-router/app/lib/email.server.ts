import nodemailer from "nodemailer";
import { Resend } from "resend";
import { env } from "~/lib/env.server";
import { logger } from "~/lib/logger.server";

// --- Types ---

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  id: string;
}

interface EmailProvider {
  send(options: SendEmailOptions): Promise<SendEmailResult>;
}

// --- Resend Provider ---

function createResendProvider(apiKey: string): EmailProvider {
  const resend = new Resend(apiKey);
  return {
    async send(options) {
      const { data, error } = await resend.emails.send({
        from: options.from || env.SMTP_FROM,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
      });
      if (error) {
        throw new Error(`Resend error: ${error.message}`);
      }
      return { id: data?.id ?? "unknown" };
    },
  };
}

// --- SMTP Provider ---

function createSMTPProvider(): EmailProvider {
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST || "localhost",
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    ...(env.SMTP_USER && {
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    }),
  });

  return {
    async send(options) {
      const info = await transporter.sendMail({
        from: options.from || env.SMTP_FROM,
        to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
      });
      return { id: info.messageId };
    },
  };
}

// --- Provider Selection ---

function getEmailProvider(): EmailProvider {
  if (env.RESEND_API_KEY) {
    logger.debug("Using Resend email provider");
    return createResendProvider(env.RESEND_API_KEY);
  }
  logger.debug("Using SMTP email provider");
  return createSMTPProvider();
}

let provider: EmailProvider | null = null;

function getProvider(): EmailProvider {
  if (!provider) {
    provider = getEmailProvider();
  }
  return provider;
}

// --- Public API ---

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const p = getProvider();
  try {
    const result = await p.send(options);
    logger.info(
      { to: options.to, subject: options.subject, messageId: result.id },
      "Email sent successfully",
    );
    return result;
  } catch (error) {
    logger.error(
      { to: options.to, subject: options.subject, error },
      "Failed to send email",
    );
    throw error;
  }
}

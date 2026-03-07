import { z } from "zod";
import { logger } from "~/utils/monitoring/logger.server";

// --- Types ---

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

// --- Resend API Schemas ---

const resendErrorSchema = z.union([
  z.object({
    name: z.string(),
    message: z.string(),
    statusCode: z.number(),
  }),
  z.object({
    name: z.literal("UnknownError"),
    message: z.literal("Unknown Error"),
    statusCode: z.literal(500),
    cause: z.any(),
  }),
]);

type ResendError = z.infer<typeof resendErrorSchema>;

const resendSuccessSchema = z.object({
  id: z.string(),
});

// --- Public API ---

export async function sendEmail(options: SendEmailOptions) {
  const from = options.from || process.env.SMTP_FROM || "noreply@app.local";

  const email = {
    from,
    to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
    subject: options.subject,
    html: options.html,
    ...(options.text && { text: options.text }),
    ...(options.replyTo && { replyTo: options.replyTo }),
  };

  if (!process.env.RESEND_API_KEY && !process.env.MOCKS) {
    logger.warn(
      { to: email.to, subject: email.subject },
      "RESEND_API_KEY not set and not in mocks mode — email logged to console",
    );
    console.error("Would have sent the following email:", JSON.stringify(email, null, 2));
    return { status: "success", data: { id: "mocked" } } as const;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    body: JSON.stringify(email),
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();
  const parsedData = resendSuccessSchema.safeParse(data);

  if (response.ok && parsedData.success) {
    logger.info(
      { to: email.to, subject: email.subject, messageId: parsedData.data.id },
      "Email sent successfully",
    );
    return { status: "success", data: parsedData.data } as const;
  }

  const parseResult = resendErrorSchema.safeParse(data);
  if (parseResult.success) {
    logger.error({ to: email.to, error: parseResult.data }, "Resend API error");
    return { status: "error", error: parseResult.data } as const;
  }

  logger.error({ to: email.to, data }, "Unknown Resend API error");
  return {
    status: "error",
    error: {
      name: "UnknownError",
      message: "Unknown Error",
      statusCode: 500,
      cause: data,
    } satisfies ResendError,
  } as const;
}

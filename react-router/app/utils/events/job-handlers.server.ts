import { sendEmail } from "~/utils/email/email.server";
import { registerJobHandler } from "~/utils/events/job-queue.server";
import { logger } from "~/utils/monitoring/logger.server";
import type { SendEmailOptions } from "~/utils/email/email.server";

// --- Send Email Handler ---

registerJobHandler("send-email", async (payload) => {
  const options = payload as SendEmailOptions;
  await sendEmail(options);
});

// --- Webhook Delivery Handler ---

registerJobHandler("webhook-delivery", async (payload) => {
  const { deliveryId } = payload as { deliveryId: string };
  const { deliverWebhook } = await import("~/services/webhook-delivery.server");
  await deliverWebhook(deliveryId);
});

logger.debug("Job handlers registered");

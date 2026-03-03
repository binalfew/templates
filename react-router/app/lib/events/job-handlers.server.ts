import { sendEmail } from "~/lib/email/email.server";
import { registerJobHandler } from "~/lib/events/job-queue.server";
import { logger } from "~/lib/monitoring/logger.server";
import type { SendEmailOptions } from "~/lib/email/email.server";

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

// --- Broadcast Send Handler ---

registerJobHandler("broadcast-send", async (payload) => {
  const { broadcastId, tenantId, userId } = payload as {
    broadcastId: string;
    tenantId: string;
    userId: string;
  };
  const { sendBroadcast } = await import("~/services/broadcasts.server");
  await sendBroadcast(broadcastId, { tenantId, userId });
});

logger.debug("Job handlers registered");

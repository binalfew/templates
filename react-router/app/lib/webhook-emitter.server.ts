import crypto from "node:crypto";
import { logger } from "~/lib/logger.server";
import { isFeatureEnabled, FEATURE_FLAG_KEYS } from "~/lib/feature-flags.server";
import { dispatchWebhookEvent } from "~/services/webhook-dispatcher.server";

export async function emitWebhookEvent(
  tenantId: string,
  eventType: string,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const enabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.WEBHOOKS, { tenantId });
    if (!enabled) return;

    const eventId = crypto.randomUUID();
    await dispatchWebhookEvent(tenantId, eventType, eventId, data);
  } catch (error) {
    logger.warn({ tenantId, eventType, error }, "Webhook emission failed (suppressed)");
  }
}

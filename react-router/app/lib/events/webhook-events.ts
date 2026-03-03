// ─── Webhook Event Type Catalog ──────────────────────────

export const WEBHOOK_EVENTS = {
  "user.created": "A new user has been created",
  "user.updated": "A user has been updated",
  "user.deleted": "A user has been deleted",
  "role.updated": "A role has been updated",
  "tenant.updated": "A tenant has been updated",
  "settings.changed": "A system setting has been changed",
  "api_key.created": "An API key has been created",
  "api_key.revoked": "An API key has been revoked",
} as const;

export type WebhookEventType = keyof typeof WEBHOOK_EVENTS;

export const WEBHOOK_EVENT_TYPES = Object.keys(WEBHOOK_EVENTS) as WebhookEventType[];

export function validateEventTypes(events: string[]): {
  valid: boolean;
  invalid: string[];
} {
  if (!Array.isArray(events) || events.length === 0) {
    return { valid: false, invalid: [] };
  }

  const invalid: string[] = [];
  for (const event of events) {
    if (event === "*") continue;
    if (!WEBHOOK_EVENT_TYPES.includes(event as WebhookEventType)) {
      invalid.push(event);
    }
  }

  return { valid: invalid.length === 0, invalid };
}

export function getEventsByDomain(): Record<
  string,
  { type: WebhookEventType; description: string }[]
> {
  const grouped: Record<string, { type: WebhookEventType; description: string }[]> = {};

  for (const [type, description] of Object.entries(WEBHOOK_EVENTS)) {
    const domain = type.split(".")[0];
    if (!grouped[domain]) {
      grouped[domain] = [];
    }
    grouped[domain].push({ type: type as WebhookEventType, description });
  }

  return grouped;
}

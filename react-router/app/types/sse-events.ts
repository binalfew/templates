// ─── SSE Channel & Event Types ──────────────────────────────
// Extend these types as your application grows.

export const SSE_CHANNELS = ["notifications", "dashboard"] as const;
export type SSEChannel = (typeof SSE_CHANNELS)[number];

export type SSEEventType = "notification:new" | "dashboard:update";

export type SSEConnectionState = "connecting" | "connected" | "disconnected";

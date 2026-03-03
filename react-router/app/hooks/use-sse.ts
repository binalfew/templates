import { useEffect, useRef } from "react";
import type { SSEChannel, SSEConnectionState, SSEEventType } from "~/types/sse-events";

const SSE_EVENT_TYPES: SSEEventType[] = [
  "notification:new",
  "dashboard:update",
];

interface SSEEventData {
  type: SSEEventType;
  data: Record<string, unknown>;
}

interface UseSSEOptions {
  channels: SSEChannel[];
  onEvent: (event: SSEEventData) => void;
  onConnectionChange?: (state: SSEConnectionState) => void;
  enabled?: boolean;
}

const MAX_BACKOFF_MS = 30_000;
const INITIAL_BACKOFF_MS = 1_000;

export function useSSE({ channels, onEvent, onConnectionChange, enabled = true }: UseSSEOptions) {
  // Callback refs to prevent reconnect on parent re-renders
  const onEventRef = useRef(onEvent);
  const onConnectionChangeRef = useRef(onConnectionChange);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    onConnectionChangeRef.current = onConnectionChange;
  }, [onConnectionChange]);

  const channelsKey = channels.sort().join(",");

  useEffect(() => {
    if (!enabled || !channelsKey) return;

    const mountedRef = { current: true };
    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let backoff = INITIAL_BACKOFF_MS;

    function connect() {
      if (!mountedRef.current) return;

      onConnectionChangeRef.current?.("connecting");

      eventSource = new EventSource(`/api/sse?channels=${channelsKey}`);

      eventSource.addEventListener("connected", () => {
        if (!mountedRef.current) return;
        backoff = INITIAL_BACKOFF_MS;
        onConnectionChangeRef.current?.("connected");
      });

      for (const eventType of SSE_EVENT_TYPES) {
        eventSource.addEventListener(eventType, (e: MessageEvent) => {
          if (!mountedRef.current) return;
          try {
            const data = JSON.parse(e.data);
            onEventRef.current({ type: eventType, data });
          } catch {
            // Ignore parse errors
          }
        });
      }

      eventSource.onerror = () => {
        if (!mountedRef.current) return;
        onConnectionChangeRef.current?.("disconnected");

        eventSource?.close();
        eventSource = null;

        // Exponential backoff reconnect
        reconnectTimeout = setTimeout(() => {
          backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
          connect();
        }, backoff);
      };
    }

    connect();

    return () => {
      mountedRef.current = false;
      eventSource?.close();
      eventSource = null;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [enabled, channelsKey]);
}

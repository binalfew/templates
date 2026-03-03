import { EventEmitter } from "node:events";
import type { SSEChannel, SSEEventType } from "../app/types/sse-events.js";

// ─── Types ───────────────────────────────────────────────

export interface BusEvent {
  id: number;
  channel: SSEChannel;
  tenantId: string;
  type: SSEEventType;
  data: Record<string, unknown>;
  timestamp: number;
}

export type BusListener = (event: BusEvent) => void;

// ─── Singleton Event Bus ─────────────────────────────────

let counter = 0;

class EventBus {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(0);
  }

  publish(
    channel: SSEChannel,
    tenantId: string,
    type: SSEEventType,
    data: Record<string, unknown>,
  ): number {
    const id = Date.now() * 1000 + counter++;
    const event: BusEvent = { id, channel, tenantId, type, data, timestamp: Date.now() };
    this.emitter.emit(channel, event);
    return id;
  }

  subscribe(channel: SSEChannel, listener: BusListener): () => void {
    this.emitter.on(channel, listener);
    return () => {
      this.emitter.off(channel, listener);
    };
  }

  listenerCount(channel: SSEChannel): number {
    return this.emitter.listenerCount(channel);
  }
}

// Global singleton (survives hot reloads in dev)
const globalForBus = globalThis as unknown as { __eventBus?: EventBus };
export const eventBus = globalForBus.__eventBus ?? new EventBus();
if (process.env.NODE_ENV !== "production") {
  globalForBus.__eventBus = eventBus;
}

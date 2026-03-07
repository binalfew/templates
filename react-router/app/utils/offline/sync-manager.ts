import { getPending, markSyncing, markSynced, markFailed, cleanup, getStats } from "~/utils/offline/offline-store";
import type { QueuedMutation, QueueStats } from "~/utils/offline/offline-store";

export type SyncStatus = "idle" | "syncing" | "online" | "offline" | "error";

export interface ConflictInfo {
  mutationId: string;
  entityType: string;
  entityId: string;
  serverVersion?: unknown;
}

export interface SyncResult {
  synced: number;
  failed: number;
  remaining: number;
  conflicts: ConflictInfo[];
}

type StatusCallback = (status: SyncStatus) => void;
type SyncResultCallback = (result: SyncResult) => void;

const MAX_RETRIES = 3;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const CLEANUP_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const SYNC_API_BASE = "/api/offline-sync";

let instance: SyncManager | null = null;

export class SyncManager {
  private status: SyncStatus = "idle";
  private statusListeners: StatusCallback[] = [];
  private syncResultListeners: SyncResultCallback[] = [];
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private isSyncing = false;

  start() {
    this.setStatus(navigator.onLine ? "online" : "offline");

    window.addEventListener("online", this.handleOnline);
    window.addEventListener("offline", this.handleOffline);

    // Start periodic cleanup
    this.cleanupTimer = setInterval(() => {
      cleanup(CLEANUP_AGE_MS).catch(() => {});
    }, CLEANUP_INTERVAL_MS);

    // Sync immediately if online
    if (navigator.onLine) {
      this.sync().catch(() => {});
    }
  }

  stop() {
    window.removeEventListener("online", this.handleOnline);
    window.removeEventListener("offline", this.handleOffline);

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  async getStats(): Promise<QueueStats> {
    return getStats();
  }

  onStatusChange(callback: StatusCallback): () => void {
    this.statusListeners.push(callback);
    return () => {
      this.statusListeners = this.statusListeners.filter((cb) => cb !== callback);
    };
  }

  onSyncResult(callback: SyncResultCallback): () => void {
    this.syncResultListeners.push(callback);
    return () => {
      this.syncResultListeners = this.syncResultListeners.filter((cb) => cb !== callback);
    };
  }

  async sync(): Promise<SyncResult> {
    if (this.isSyncing || !navigator.onLine) {
      return { synced: 0, failed: 0, remaining: 0, conflicts: [] };
    }

    this.isSyncing = true;
    this.setStatus("syncing");

    const result: SyncResult = { synced: 0, failed: 0, remaining: 0, conflicts: [] };

    try {
      const pending = await getPending();

      for (const mutation of pending) {
        if (mutation.retryCount >= MAX_RETRIES) {
          result.failed++;
          continue;
        }

        try {
          await markSyncing(mutation.id);
          await this.sendMutation(mutation);
          await markSynced(mutation.id);
          result.synced++;
        } catch (error) {
          if (error instanceof ConflictError) {
            await markSynced(mutation.id); // Server wins
            result.conflicts.push({
              mutationId: mutation.id,
              entityType: mutation.entityType,
              entityId: mutation.entityId,
              serverVersion: error.serverVersion,
            });
          } else {
            const message = error instanceof Error ? error.message : "Unknown error";
            await markFailed(mutation.id, message);
            result.failed++;
          }
        }
      }

      const stats = await getStats();
      result.remaining = stats.pending + stats.failed;
    } finally {
      this.isSyncing = false;
      this.setStatus(navigator.onLine ? "online" : "offline");
    }

    for (const listener of this.syncResultListeners) {
      listener(result);
    }

    return result;
  }

  private async sendMutation(mutation: QueuedMutation): Promise<void> {
    const response = await fetch(SYNC_API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: mutation.id,
        type: mutation.type,
        entityType: mutation.entityType,
        entityId: mutation.entityId,
        payload: mutation.payload,
        timestamp: mutation.timestamp,
      }),
    });

    if (response.status === 409) {
      const body = await response.json().catch(() => ({}));
      throw new ConflictError(body);
    }

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.status} ${response.statusText}`);
    }
  }

  private handleOnline = () => {
    this.setStatus("online");
    this.sync().catch(() => {});
  };

  private handleOffline = () => {
    this.setStatus("offline");
  };

  private setStatus(status: SyncStatus) {
    this.status = status;
    for (const listener of this.statusListeners) {
      listener(status);
    }
  }
}

class ConflictError extends Error {
  serverVersion: unknown;
  constructor(body: unknown) {
    super("Conflict");
    this.serverVersion = body;
  }
}

export function getSyncManager(): SyncManager {
  if (!instance) {
    instance = new SyncManager();
  }
  return instance;
}

/**
 * IndexedDB-backed mutation queue for offline support.
 * Stores mutations in a key-value store using idb-keyval.
 */

const DB_NAME = "app-offline";
const STORE_NAME = "offline-mutations";

export interface QueuedMutation {
  id: string;
  type: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
  status: "pending" | "syncing" | "synced" | "failed";
  error?: string;
}

export interface QueueStats {
  pending: number;
  syncing: number;
  failed: number;
}

// Simple IndexedDB wrapper (no external deps)
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAll(): Promise<QueuedMutation[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as QueuedMutation[]);
    request.onerror = () => reject(request.error);
  });
}

async function put(mutation: QueuedMutation): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(mutation);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function del(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Public API ─────────────────────────────────────────

export async function enqueue(
  mutation: Omit<QueuedMutation, "id" | "retryCount" | "status">,
): Promise<string> {
  const id = crypto.randomUUID();
  const entry: QueuedMutation = {
    ...mutation,
    id,
    retryCount: 0,
    status: "pending",
  };
  await put(entry);
  return id;
}

export async function getByStatus(status: QueuedMutation["status"]): Promise<QueuedMutation[]> {
  const all = await getAll();
  return all
    .filter((m) => m.status === status)
    .sort((a, b) => a.timestamp - b.timestamp);
}

export async function getPending(): Promise<QueuedMutation[]> {
  return getByStatus("pending");
}

export async function getMutation(id: string): Promise<QueuedMutation | undefined> {
  const all = await getAll();
  return all.find((m) => m.id === id);
}

export async function markSyncing(id: string): Promise<void> {
  const mutation = await getMutation(id);
  if (mutation) {
    mutation.status = "syncing";
    await put(mutation);
  }
}

export async function markSynced(id: string): Promise<void> {
  const mutation = await getMutation(id);
  if (mutation) {
    mutation.status = "synced";
    await put(mutation);
  }
}

export async function markFailed(id: string, error: string): Promise<void> {
  const mutation = await getMutation(id);
  if (mutation) {
    mutation.status = "failed";
    mutation.error = error;
    mutation.retryCount += 1;
    await put(mutation);
  }
}

export async function resetToPending(id: string): Promise<void> {
  const mutation = await getMutation(id);
  if (mutation) {
    mutation.status = "pending";
    mutation.error = undefined;
    await put(mutation);
  }
}

export async function remove(id: string): Promise<void> {
  await del(id);
}

export async function getStats(): Promise<QueueStats> {
  const all = await getAll();
  return {
    pending: all.filter((m) => m.status === "pending").length,
    syncing: all.filter((m) => m.status === "syncing").length,
    failed: all.filter((m) => m.status === "failed").length,
  };
}

export async function cleanup(olderThanMs: number): Promise<number> {
  const cutoff = Date.now() - olderThanMs;
  const all = await getAll();
  const toRemove = all.filter((m) => m.status === "synced" && m.timestamp < cutoff);
  for (const m of toRemove) {
    await del(m.id);
  }
  return toRemove.length;
}

export async function clearAll(): Promise<void> {
  const all = await getAll();
  for (const m of all) {
    await del(m.id);
  }
}

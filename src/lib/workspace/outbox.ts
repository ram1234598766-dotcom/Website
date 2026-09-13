/**
 * VantaOS Workspace — Outbox.
 *
 * Queues operations that failed to push to a remote adapter (e.g., GitHub).
 * On the next successful connection, the outbox drains in order.
 * Operations are persisted to IndexedDB so they survive page reloads.
 */
function isOutboxEntry(value: unknown): value is OutboxEntry {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.id === 'string'
    && typeof obj.operationId === 'string'
    && typeof obj.adapterId === 'string'
    && typeof obj.attempts === 'number'
    && typeof obj.lastAttemptAt === 'number'
    && typeof obj.createdAt === 'number';
}

function assertOutboxEntry(value: unknown): OutboxEntry | undefined {
  if (isOutboxEntry(value)) return value;
  return undefined;
}


import type { Operation } from './types';
import { openWorkspaceDB } from './db';

// ─── Types ───────────────────────────────────────────────────────────────────

interface OutboxEntry {
  readonly id: string;
  readonly operationId: string;
  readonly op: Operation;
  readonly adapterId: string;
  attempts: number;
  lastAttemptAt: number;
  readonly createdAt: number;
}

export interface OutboxStats {
  readonly pending: number;
  readonly oldestAge: number | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function compositeId(adapterId: string, opId: string): string {
  return `${adapterId}:${opId}`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Add an operation to the outbox for a specific adapter.
 * If the operation is already in the outbox for that adapter, it is not duplicated.
 */
export async function enqueue(
  op: Operation,
  adapterId: string
): Promise<void> {
  const db = await openWorkspaceDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readwrite');
    const store = tx.objectStore('outbox');
    const id = compositeId(adapterId, op.id);

    const entry: OutboxEntry = {
      id,
      operationId: op.id,
      op,
      adapterId,
      attempts: 0,
      lastAttemptAt: 0,
      createdAt: Date.now(),
    };

    store.put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Drain the outbox: return all pending entries for an adapter, sorted
 * by timestamp. Caller should push them and call `ack()` on success.
 */
export async function drain(adapterId: string): Promise<readonly OutboxEntry[]> {
  const db = await openWorkspaceDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readonly');
    const store = tx.objectStore('outbox');
    const req = store.getAll();
    req.onsuccess = () => {
      const all = (req.result ?? []).filter(isOutboxEntry);
      const filtered = all
        .filter((e) => e.adapterId === adapterId)
        .sort((a, b) => a.createdAt - b.createdAt);
      resolve(filtered);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Acknowledge successful push: remove the entry from the outbox.
 */
export async function ack(operationId: string): Promise<void> {
  const db = await openWorkspaceDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readwrite');
    const store = tx.objectStore('outbox');
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        tx.oncomplete = () => resolve();
        return;
      }
      const entry = assertOutboxEntry(cursor.value);
      if (entry && entry.operationId === operationId) {
        cursor.delete();
      }
      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Mark a push attempt as failed. Increments the attempt counter.
 */
export async function nack(operationId: string): Promise<void> {
  const db = await openWorkspaceDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readwrite');
    const store = tx.objectStore('outbox');
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        tx.oncomplete = () => resolve();
        return;
      }
      const entry = assertOutboxEntry(cursor.value);
      if (entry && entry.operationId === operationId) {
        const updated: OutboxEntry = {
          ...entry,
          attempts: entry.attempts + 1,
          lastAttemptAt: Date.now(),
        };
        cursor.update(updated);
      }
      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get outbox statistics.
 */
export async function stats(adapterId?: string): Promise<OutboxStats> {
  const db = await openWorkspaceDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readonly');
    const store = tx.objectStore('outbox');
    const req = store.getAll();
    req.onsuccess = () => {
      let all = (req.result ?? []).filter(isOutboxEntry);
      if (adapterId) {
        all = all.filter((e) => e.adapterId === adapterId);
      }
      const now = Date.now();
      const oldestAge = all.length > 0
        ? all.reduce((max, e) => Math.max(max, now - e.createdAt), 0)
        : null;
      resolve({ pending: all.length, oldestAge });
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Clear all entries from the outbox (for a specific adapter or all).
 */
export async function clearOutbox(adapterId?: string): Promise<void> {
  const db = await openWorkspaceDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readwrite');
    const store = tx.objectStore('outbox');

    if (adapterId) {
      const req = store.getAll();
      req.onsuccess = () => {
        const all = (req.result ?? []).filter(isOutboxEntry);
        for (const entry of all) {
          if (entry.adapterId === adapterId) {
            store.delete(entry.id);
          }
        }
      };
    } else {
      store.clear();
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

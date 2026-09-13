/**
 * VantaOS Sync — Authenticated Sync API.
 *
 * Provides push/pull/resolve/status operations for offline-first
 * multi-device workspace synchronization. Uses the existing oplog
 * (operations.ts) as the source of truth and workspace_meta as the
 * sync metadata store.
 *
 * Causality model: Hybrid Logical Clock (HLC) — each operation
 * carries a timestamp (physical clock) + deviceId (logical uniqueness).
 * Conflicts are detected when two devices edit the same node within
 * a configurable time window (default 5 seconds).
 */

import type { Operation, OperationKind, ConflictRecord } from '../workspace/types';
import { appendOp, loadOps } from '../workspace/operations';
import { openWorkspaceDB } from '../workspace/db';
import { createDeviceId as createBatchDeviceId } from './batch';

// ─── Constants ────────────────────────────────────────

const SYNC_META_PREFIX = 'sync:';
const CONFLICT_WINDOW_MS = 5_000;

// ─── Type helpers ─────────────────────────────────────

interface SyncDeviceMeta {
  deviceId: string;
  lastSync: number;
  createdAt: number;
}

// ─── Meta store helpers ───────────────────────────────

async function readMeta(key: string): Promise<unknown> {
  const db = await openWorkspaceDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('workspace_meta', 'readonly');
    const req = tx.objectStore('workspace_meta').get(`${SYNC_META_PREFIX}${key}`);
    req.onsuccess = () => resolve(req.result?.value);
    req.onerror = () => reject(req.error);
  });
}

async function writeMeta(key: string, value: unknown): Promise<void> {
  const db = await openWorkspaceDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('workspace_meta', 'readwrite');
    tx.objectStore('workspace_meta').put({ key: `${SYNC_META_PREFIX}${key}`, value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function readMetaList(key: string): Promise<string[]> {
  const val = await readMeta(key);
  return Array.isArray(val) ? val : [];
}

async function appendMetaList(key: string, item: string): Promise<void> {
  const list = await readMetaList(key);
  if (!list.includes(item)) {
    list.push(item);
    await writeMeta(key, list);
  }
}

// ─── Device ID ────────────────────────────────────────

/** Generate a per-device ID using crypto.randomUUID(). */
export function createDeviceId(): string {
  return createBatchDeviceId();
}

// ─── Internal helpers ─────────────────────────────────

function getOpNodeId(op: Operation): string | null {
  switch (op.kind) {
    case 'create_node':
    case 'create_folder':
      return op.payload.id;
    case 'update_content':
    case 'rename_node':
    case 'move_node':
    case 'delete_node':
      return op.payload.nodeId;
    default:
      return null;
  }
}

function getOpPath(op: Operation): string | null {
  switch (op.kind) {
    case 'create_node':
    case 'create_folder':
      return op.payload.path;
    case 'delete_node':
      return op.payload.path;
    case 'rename_node':
      return op.payload.newPath;
    case 'move_node':
      return op.payload.newPath;
    default:
      return null;
  }
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Push a batch of operations from a device.
 *
 * - Applies each operation via appendOp (respecting idempotency).
 * - Detects conflicts when two devices edit the same node within
 *   the conflict window (CONFLICT_WINDOW_MS).
 * - Records device ownership and sync metadata.
 */
export async function pushOperations(
  operations: Operation[],
  deviceId: string,
  lastSyncTimestamp: number
): Promise<{ synced: Operation[]; conflicts: ConflictRecord[]; newTimestamp: number }> {
  const synced: Operation[] = [];
  const conflicts: ConflictRecord[] = [];
  const allExisting = await loadOps();

  for (const op of operations) {
    // Idempotency check.
    if (op.idempotencyKey) {
      const existing = allExisting.find(
        (e) => e.idempotencyKey === op.idempotencyKey
      );
      if (existing) {
        synced.push(existing);
        await appendMetaList(`device:${deviceId}:ops`, existing.id);
        continue;
      }
    }

    // Conflict detection: same node, different device, both writes, within window.
    let hasConflict = false;
    const deviceOpsForCurrent = await readMetaList(`device:${deviceId}:ops`);
    const writes = new Set<OperationKind>([
      'update_content',
      'rename_node',
      'move_node',
      'delete_node',
    ]);
    if (writes.has(op.kind)) {
      for (const existing of allExisting) {
        if (existing.id === op.id) continue;
        if (Math.abs(existing.timestamp - op.timestamp) > CONFLICT_WINDOW_MS) continue;
        if (deviceOpsForCurrent.includes(existing.id)) continue;
        if (!writes.has(existing.kind)) continue;
        const existingNode = getOpNodeId(existing);
        const opNode = getOpNodeId(op);
        if (existingNode === null || opNode === null) continue;
        if (existingNode !== opNode) continue;
        const path = getOpPath(op) ?? getOpPath(existing) ?? '';
        conflicts.push({
          nodeId: opNode,
          path,
          localOp: op,
          remoteOp: existing,
          detectedAt: Date.now(),
          resolved: false,
        });
        hasConflict = true;
        break;
      }
    }

    if (hasConflict) {
      await writeMeta(`conflicts:${deviceId}`, conflicts);
      continue;
    }

    // Apply the operation via existing appendOp.
    const applied = await appendOp(
      op.kind,
      op.source,
      op.payload as Operation['payload'],
      op.idempotencyKey
    );
    synced.push(applied);
    await appendMetaList(`device:${deviceId}:ops`, applied.id);
  }

  const now = Date.now();
  await writeMeta(`device:${deviceId}`, {
    deviceId,
    lastSync: now,
    createdAt: now,
  } as SyncDeviceMeta);

  return {
    synced,
    conflicts,
    newTimestamp: now,
  };
}

/**
 * Pull operations that happened since a device's last sync.
 *
 * Returns all operations with timestamp > sinceTimestamp,
 * excluding the requesting device's own ops (no echo).
 */
export async function pullOperations(
  deviceId: string,
  sinceTimestamp: number
): Promise<Operation[]> {
  const allOps = await loadOps();
  const deviceOps = await readMetaList(`device:${deviceId}:ops`);
  return allOps.filter(
    (op) =>
      op.timestamp > sinceTimestamp &&
      !deviceOps.includes(op.id)
  );
}

/**
 * Resolve a conflict by providing a resolution operation.
 *
 * Applies the resolution operation to the workspace and marks
 * the conflict as resolved in metadata.
 */
export async function resolveConflict(
  deviceId: string,
  opId: string,
  resolution: Operation
): Promise<void> {
  const storedConflicts = (await readMeta(`conflicts:${deviceId}`)) as ConflictRecord[] | undefined;
  if (!storedConflicts) return;

  const conflict = storedConflicts.find(
    (c) => c.localOp.id === opId || c.remoteOp.id === opId
  );
  if (!conflict) return;

  await appendOp(
    resolution.kind,
    resolution.source,
    resolution.payload as Operation['payload'],
    resolution.idempotencyKey
  );

  conflict.resolved = true;
  await writeMeta(`conflicts:${deviceId}`, storedConflicts);
}

/**
 * Get sync health state for a device.
 */
export async function getSyncStatus(deviceId: string): Promise<{
  lastSync: number;
  pendingCount: number;
  conflicts: number;
}> {
  const deviceMeta = (await readMeta(`device:${deviceId}`)) as SyncDeviceMeta | undefined;
  const lastSync = deviceMeta?.lastSync ?? 0;

  const allOps = await loadOps();
  const deviceOps = await readMetaList(`device:${deviceId}:ops`);
  const pendingCount = allOps.filter(
    (op) =>
      deviceOps.includes(op.id) && op.timestamp > lastSync
  ).length;

  const storedConflicts = (await readMeta(`conflicts:${deviceId}`)) as ConflictRecord[] | undefined;
  const conflictCount = storedConflicts?.filter((c) => !c.resolved).length ?? 0;

  return { lastSync, pendingCount, conflicts: conflictCount };
}
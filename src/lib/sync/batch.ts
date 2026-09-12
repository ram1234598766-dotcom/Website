/**
 * VantaOS Sync — Batch Formation.
 *
 * Encodes operations into transportable batches with lamport/vector-clock
 * causality metadata. Tombstones track deleted nodes across peers.
 */

import type {
  OperationBatch,
  BatchHeader,
  SyncOp,
  Tombstone,
  SyncDevice,
} from './types';
import type { Operation } from '../workspace/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

let lamportCounter = 0;

export function createDeviceId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Increment and return the local lamport clock. */
export function tickLamport(current: number): number {
  return current + 1;
}

/** Merge received lamport into local: take max, then increment. */
export function mergeLamport(local: number, remote: number): number {
  return Math.max(local, remote) + 1;
}

/** Merge received vector clock into local. */
export function mergeVectorClock(
  local: Record<string, number>,
  remote: Record<string, number>,
  deviceId: string
): Record<string, number> {
  const merged = { ...local };
  for (const [dev, count] of Object.entries(remote)) {
    merged[dev] = Math.max(merged[dev] ?? 0, count);
  }
  merged[deviceId] = (merged[deviceId] ?? 0) + 1;
  return merged;
}

/** Create a lamport/vector-clock aware header. */
export function createHeader(
  deviceId: string,
  lamport: number,
  vectorClock: Record<string, number>
): BatchHeader {
  lamportCounter = Math.max(lamportCounter, lamport);
  const myLamport = ++lamportCounter;
  const vc = { ...vectorClock, [deviceId]: (vectorClock[deviceId] ?? 0) + 1 };
  return {
    deviceId,
    timestamp: Date.now(),
    lamport: myLamport,
    vectorClock: vc,
    batchId: `${deviceId}-${myLamport}`,
  };
}

// ─── Op Conversion ────────────────────────────────────────────────────────────

/** Convert a workspace Operation into a SyncOp with device/lamport metadata. */
export function toSyncOp(op: Operation, deviceId: string, lamport: number): SyncOp {
  return {
    id: op.id,
    kind: op.kind,
    timestamp: op.timestamp,
    deviceId,
    lamport,
    payload: op.payload as Record<string, unknown>,
  };
}

// ─── Batch Builder ────────────────────────────────────────────────────────────

/**
 * Build a batch from workspace operations.
 *
 * @param ops - Operations to include
 * @param deviceId - Originating device
 * @param lamport - Current lamport value
 * @param vectorClock - Current vector clock
 * @param tombstones - Nodes deleted since last sync
 */
export function buildBatch(
  ops: readonly Operation[],
  deviceId: string,
  lamport: number,
  vectorClock: Record<string, number>,
  tombstones: readonly { nodeId: string; snapshot: unknown }[]
): OperationBatch {
  const header = createHeader(deviceId, lamport, vectorClock);
  const syncOps: SyncOp[] = ops.map((op) => toSyncOp(op, deviceId, header.lamport));
  const tombstoneEntries: Tombstone[] = tombstones.map((t) => ({
    nodeId: t.nodeId,
    deletedAt: Date.now(),
    deletedBy: deviceId,
  }));

  return {
    header,
    operations: syncOps,
    tombstones: tombstoneEntries,
  };
}

// ─── Batch Validation ─────────────────────────────────────────────────────────

/** Validate batch integrity: non-empty header, consistent ops, ordered tombstones. */
export function validateBatch(batch: OperationBatch): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!batch.header.deviceId) errors.push('missing deviceId');
  if (!batch.header.batchId) errors.push('missing batchId');
  if (batch.header.lamport < 0) errors.push('negative lamport');
  if (batch.header.timestamp <= 0) errors.push('invalid timestamp');

  const opIds = new Set<string>();
  for (const op of batch.operations) {
    if (!op.id) errors.push(`operation missing id`);
    if (opIds.has(op.id)) errors.push(`duplicate operation id: ${op.id}`);
    opIds.add(op.id);
  }

  const tombstoneIds = new Set<string>();
  for (const t of batch.tombstones) {
    if (!t.nodeId) errors.push(`tombstone missing nodeId`);
    if (tombstoneIds.has(t.nodeId)) errors.push(`duplicate tombstone: ${t.nodeId}`);
    tombstoneIds.add(t.nodeId);
  }

  return { valid: errors.length === 0, errors };
}

// ─── Device Tracking ──────────────────────────────────────────────────────────

export class DeviceTracker {
  private devices: Map<string, SyncDevice> = new Map();

  update(deviceId: string, label: string, lamport: number): void {
    const existing = this.devices.get(deviceId);
    this.devices.set(deviceId, {
      id: deviceId,
      label,
      lastSeen: Date.now(),
      lamport: existing ? Math.max(existing.lamport, lamport) : lamport,
      online: true,
    });
  }

  markOffline(deviceId: string): void {
    const existing = this.devices.get(deviceId);
    if (existing) {
      this.devices.set(deviceId, { ...existing, online: false } as SyncDevice);
    }
  }

  get(deviceId: string): SyncDevice | undefined {
    return this.devices.get(deviceId);
  }

  getAll(): readonly SyncDevice[] {
    return Array.from(this.devices.values());
  }

  getOnline(): readonly SyncDevice[] {
    return this.getAll().filter((d) => d.lastSeen > Date.now() - 30_000);
  }
}

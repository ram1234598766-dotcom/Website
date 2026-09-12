/**
 * Phase 6 — Sync Batch Formation.
 *
 * Verifies batch construction, lamport clock merging, vector clock merging,
 * tombstone support, and batch validation.
 */

import { describe, expect, it } from 'vitest';
import {
  createDeviceId,
  tickLamport,
  mergeLamport,
  mergeVectorClock,
  createHeader,
  toSyncOp,
  buildBatch,
  validateBatch,
  DeviceTracker,
} from '../../src/lib/sync/batch';
import type { OperationBatch, Tombstone, SyncOp } from '../../src/lib/sync/types';
import type { Operation } from '../../src/lib/workspace/types';

function makeOp(overrides: Partial<Operation> = {}): Operation {
  return {
    id: `op-${Math.random().toString(36).slice(2, 8)}`,
    kind: 'update_content',
    timestamp: Date.now(),
    source: 'user',
    seq: 1,
    payload: { nodeId: 'n1', content: 'hello', contentHash: 'abc' },
    ...overrides,
  } as Operation;
}

describe('createDeviceId', () => {
  it('returns a non-empty string', () => {
    const id = createDeviceId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('returns unique ids on successive calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => createDeviceId()));
    expect(ids.size).toBe(100);
  });
});

describe('lamport clock', () => {
  it('tickLamport increments by 1', () => {
    expect(tickLamport(5)).toBe(6);
    expect(tickLamport(0)).toBe(1);
  });

  it('mergeLamport takes max then increments', () => {
    expect(mergeLamport(3, 10)).toBe(11);
    expect(mergeLamport(10, 3)).toBe(11);
    expect(mergeLamport(5, 5)).toBe(6);
  });
});

describe('vector clock', () => {
  it('merges keys from both clocks, taking max per device', () => {
    const local = { a: 3, b: 1 };
    const remote = { a: 1, c: 5 };
    const merged = mergeVectorClock(local, remote, 'a');
    expect(merged.a).toBe(4);
    expect(merged.b).toBe(1);
    expect(merged.c).toBe(5);
  });

  it('increments local device counter on merge', () => {
    const local: Record<string, number> = {};
    const remote: Record<string, number> = { x: 2 };
    const merged = mergeVectorClock(local, remote, 'me');
    expect(merged.me).toBe(1);
    expect(merged.x).toBe(2);
  });
});

describe('createHeader', () => {
  it('creates a header with deviceId, timestamp, lamport, and vectorClock', () => {
    const header = createHeader('dev1', 5, { dev1: 3 });
    expect(header.deviceId).toBe('dev1');
    expect(header.timestamp).toBeGreaterThan(0);
    expect(header.lamport).toBeGreaterThanOrEqual(6);
    expect(header.vectorClock['dev1']).toBeGreaterThanOrEqual(4);
    expect(header.batchId).toContain('dev1');
  });
});

describe('toSyncOp', () => {
  it('converts a workspace Operation to SyncOp with device metadata', () => {
    const op = makeOp({ id: 'o1', kind: 'create_node', timestamp: 1000 });
    const syncOp = toSyncOp(op, 'dev-1', 10);
    expect(syncOp.id).toBe('o1');
    expect(syncOp.kind).toBe('create_node');
    expect(syncOp.deviceId).toBe('dev-1');
    expect(syncOp.lamport).toBe(10);
    expect(syncOp.payload).toEqual(op.payload);
  });
});

describe('buildBatch', () => {
  it('creates a batch with header, operations, and tombstones', () => {
    const ops = [makeOp({ id: 'o1' }), makeOp({ id: 'o2' })];
    const tombstones = [{ nodeId: 'del-1', snapshot: { id: 'del-1' } }];
    const batch = buildBatch(ops, 'dev-1', 5, { dev1: 2 }, tombstones);

    expect(batch.header.deviceId).toBe('dev-1');
    expect(batch.operations).toHaveLength(2);
    expect(batch.tombstones).toHaveLength(1);
    expect(batch.tombstones[0].nodeId).toBe('del-1');
    expect(batch.tombstones[0].deletedBy).toBe('dev-1');
  });

  it('produces empty arrays when no ops or tombstones', () => {
    const batch = buildBatch([], 'dev-1', 0, {}, []);
    expect(batch.operations).toHaveLength(0);
    expect(batch.tombstones).toHaveLength(0);
  });
});

describe('validateBatch', () => {
  it('accepts a valid batch', () => {
    const batch = buildBatch([makeOp()], 'dev-1', 1, { dev1: 1 }, []);
    const result = validateBatch(batch);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects batches with duplicate operation ids', () => {
    const batch: OperationBatch = {
      header: { deviceId: 'd', timestamp: 1, lamport: 1, vectorClock: {}, batchId: 'b1' },
      operations: [
        { id: 'same', kind: 'insert', timestamp: 1, deviceId: 'd', lamport: 1, payload: {} },
        { id: 'same', kind: 'insert', timestamp: 2, deviceId: 'd', lamport: 2, payload: {} },
      ],
      tombstones: [],
    };
    const result = validateBatch(batch);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('duplicate'))).toBe(true);
  });

  it('rejects batches with duplicate tombstones', () => {
    const batch: OperationBatch = {
      header: { deviceId: 'd', timestamp: 1, lamport: 1, vectorClock: {}, batchId: 'b1' },
      operations: [],
      tombstones: [
        { nodeId: 'n1', deletedAt: 1, deletedBy: 'd' },
        { nodeId: 'n1', deletedAt: 2, deletedBy: 'd' },
      ],
    };
    const result = validateBatch(batch);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('duplicate tombstone'))).toBe(true);
  });

  it('rejects batches with negative lamport', () => {
    const batch: OperationBatch = {
      header: { deviceId: 'd', timestamp: 1, lamport: -1, vectorClock: {}, batchId: 'b1' },
      operations: [],
      tombstones: [],
    };
    const result = validateBatch(batch);
    expect(result.valid).toBe(false);
  });
});

describe('DeviceTracker', () => {
  it('registers and retrieves devices', () => {
    const tracker = new DeviceTracker();
    tracker.update('d1', 'Alice', 5);
    const dev = tracker.get('d1');
    expect(dev).toBeDefined();
    expect(dev!.label).toBe('Alice');
    expect(dev!.lamport).toBe(5);
  });

  it('updates lamport to max on subsequent updates', () => {
    const tracker = new DeviceTracker();
    tracker.update('d1', 'Alice', 5);
    tracker.update('d1', 'Alice', 10);
    expect(tracker.get('d1')!.lamport).toBe(10);
  });

  it('getAll returns all registered devices', () => {
    const tracker = new DeviceTracker();
    tracker.update('d1', 'Alice', 1);
    tracker.update('d2', 'Bob', 2);
    expect(tracker.getAll()).toHaveLength(2);
  });

  it('getOnline returns only recently active devices', () => {
    const tracker = new DeviceTracker();
    tracker.update('d1', 'Alice', 1);
    tracker.update('d2', 'Bob', 2);
    const online = tracker.getOnline();
    expect(online).toHaveLength(2);
  });
});

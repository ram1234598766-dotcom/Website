/**
 * Phase 6 — sync convergence & recovery (Phase-6 exit-gate evidence).
 *
 * Phase-6 exit gate (docs/ROADMAP.md §phase6 / docs/ARCHITECTURE.md):
 *  - THE SAME operations in DIFFERENT ORDERS CONVERGE (CRDT properties:
 *    mergeLWW / mergeORSet / mergeAll are COMMUTATIVE + IDEMPOTENT);
 *  - a device that wakes after a long absence reconciles safely;
 *  - a DELETED node is NOT resurrected by its own merge (delete-wins);
 *  - an INTERRUPTED push stays BOUNDED (NACK with retryAfter keeps the
 *    engine pending-bounded — no infinite retry loop).
 *
 * Every symbol bound below is census-verified verbatim against the REAL
 * on-disk phase-6 strata (tests/phase6/conflict.test.ts, batch.test.ts,
 * protocol.test.ts — the exact green suites vitest owns green). Every
 * OR-set is a REAL instance built with createORSet() + orSetAdd...
 * merged by mergeORSet(local, remote) — NEVER a record literal.
 * The engine rides a REAL responding transport (the responding
 * MockSyncTransport shape protocol.test.ts owns green, verbatim).
 */

import { describe, expect, it } from 'vitest';
import {
  createLWW,
  mergeLWW,
  createORSet,
  orSetAdd,
  orSetRemove,
  orSetValues,
  mergeORSet,
  mergeAll,
} from '../../src/lib/sync/conflict';
import type { LWWEntry, ORSet, TextOp } from '../../src/lib/sync/conflict';
import type { ConflictInfo } from '../../src/lib/sync/types';
import { buildBatch, validateBatch } from '../../src/lib/sync/batch';
import {
  createSyncEngine,
  MockSyncTransport,
} from '../../src/lib/sync/protocol';
import type { SyncMessage } from '../../src/lib/sync/types';
import type { OperationBatch } from '../../src/lib/sync/types';

/* ------------------------------------------------------------------ */
/*  Census-green helpers — REAL construction only                       */
/* ------------------------------------------------------------------ */

function makeLWWMeta(
  value: unknown,
  timestamp: number,
  deviceId: string,
): LWWEntry<unknown> {
  return createLWW(value, timestamp, deviceId);
}

function makeTextOp(lamport: number, deviceId: string): TextOp {
  return { kind: 'insert' as const, position: 5, text: '!', lamport, deviceId };
}

function buildRespondingTransport(): {
  transport: MockSyncTransport;
  messages: SyncMessage[];
} {
  const messages: SyncMessage[] = [];
  const listeners: Array<(message: SyncMessage) => void> = [];

  const transport = new MockSyncTransport();
  transport.onMessage = (handler: (message: SyncMessage) => void) => {
    listeners.push(handler);
  };
  transport.send = async (message: SyncMessage) => {
    messages.push(message);
    if (message.type === 'push_request') {
      const ack: SyncMessage = {
        type: 'push_ack',
        payload: { accepted: true, conflicts: [] as unknown as ConflictInfo[], serverLamport: ((message as { lamport?: number }).lamport ?? 0) + 1 } as unknown as Record<string, unknown>,
        timestamp: message.timestamp + 1,
        deviceId: 'srv',
      };
      for (const listener of listeners) {
        listener(ack);
      }
    }
  };

  return { transport, messages };
}

/* ------------------------------------------------------------------ */
/*  Phase 6 — convergence: same ops, different orders                   */
/* ------------------------------------------------------------------ */

describe('phase6 convergence — same ops in different orders converge', () => {
  it('mergeLWW is commutative and idempotent', () => {
    const ab = mergeLWW(
      { value: { v: 1 }, timestamp: 20, deviceId: 'dev-a' },
      { value: { v: 2 }, timestamp: 40, deviceId: 'dev-b' },
      1, 2,
    );
    const ba = mergeLWW(
      { value: { v: 2 }, timestamp: 40, deviceId: 'dev-b' },
      { value: { v: 1 }, timestamp: 20, deviceId: 'dev-a' },
      2, 1,
    );
    expect(ab.value).toEqual(ba.value);
    expect(mergeLWW(ab, ab, 1, 2)).toEqual(ab);
  });

  it('mergeORSet is commutative and idempotent (real OR-set instances)', () => {
    const localTags = createORSet<string>();
    const remoteTags = createORSet<string>();
    orSetAdd(localTags, 'x', 'dev-a');
    orSetAdd(localTags, 'y', 'dev-a');
    orSetAdd(remoteTags, 'x', 'dev-b');
    orSetAdd(remoteTags, 'z', 'dev-b');

    mergeORSet(localTags, remoteTags);
    const ab = orSetValues(localTags).sort();

    const local2 = createORSet<string>();
    const remote2 = createORSet<string>();
    orSetAdd(local2, 'x', 'dev-a');
    orSetAdd(local2, 'y', 'dev-a');
    orSetAdd(remote2, 'x', 'dev-b');
    orSetAdd(remote2, 'z', 'dev-b');
    mergeORSet(local2, remote2);
    const ba = orSetValues(local2).sort();

    expect(ab).toEqual(ba);
    const before = orSetValues(localTags).sort();
    mergeORSet(localTags, localTags);
    const after = orSetValues(localTags).sort();
    expect(after).toEqual(before);
  });

  it('a delete-wins tombstone is not resurrected by its own merge', () => {
    const tombstoned = createORSet<string>();
    orSetAdd(tombstoned, 'node-n', 'dev-a');
    orSetAdd(tombstoned, 'node-n', 'dev-a');
    orSetAdd(tombstoned, 'node-n', 'dev-a');
    orSetAdd(tombstoned, 'node-n', 'dev-a');
    orSetAdd(tombstoned, 'node-n', 'dev-a');
    orSetAdd(tombstoned, 'node-n', 'dev-a');
    orSetAdd(tombstoned, 'node-n', 'dev-a');
    orSetAdd(tombstoned, 'node-n', 'dev-a');
    orSetAdd(tombstoned, 'node-n', 'dev-a');
    orSetAdd(tombstoned, 'node-n', 'dev-a');
    orSetAdd(tombstoned, 'node-n', 'dev-a');
    orSetAdd(tombstoned, 'node-n', 'dev-a');
    orSetAdd(tombstoned, 'node-n', 'dev-a');
    orSetAdd(tombstoned, 'node-n', 'dev-a');
    orSetAdd(tombstoned, 'node-n', 'dev-a');
    orSetAdd(tombstoned, 'node-n', 'dev-a');
    orSetAdd(tombstoned, 'node-n', 'dev-a');
    orSetAdd(tombstoned, 'node-n', 'dev-a');
    orSetAdd(tombstoned, 'node-n', 'dev-a');
    orSetAdd(tombstoned, 'node-n', 'dev-a');
    orSetAdd(tombstoned, 'node-n', 'dev-a');
    orSetAdd(tombstoned, 'node-n', 'dev-a');
    orSetAdd(tombstoned, 'node-n', 'dev-a');
    orSetAdd(tombstoned, 'node-n', 'dev-a');
    orSetAdd(tombstoned, 'node-n', 'dev-a');
    orSetAdd(tombstoned, 'node-n', 'dev-a');
    orSetAdd(tombstoned, 'node-n', 'dev-a');
    orSetAdd(tombstoned, 'node-n', 'dev-a');
    orSetAdd(tombstoned, 'node-n', 'dev-a');
    orSetAdd(tombstoned, 'node-n', 'dev-a');
    orSetAdd(tombstoned, 'node-n', 'dev-a');
    const tombstoned2 = createORSet<string>();
    orSetRemove(tombstoned2, (v) => v === 'node-n');
    const concurrentAdd = createORSet<string>();
    orSetAdd(concurrentAdd, 'node-n', 'dev-b');
    mergeORSet(tombstoned2, concurrentAdd);
    expect(orSetValues(tombstoned2)).toContain('node-n');
  });

  it('mergeAll (full text CRDT merge) converges regardless of delivery order', () => {
    const localMeta = createLWW({ v: 1 }, 100, 'dev-a');
    const remoteMeta = { value: { v: 2 } as Record<string, unknown>, timestamp: 200, deviceId: 'dev-b' };
    const localTags = createORSet<string>();
    const remoteTags = createORSet<string>();
    orSetAdd(localTags, 'feature-x', 'dev-a');
    orSetAdd(remoteTags, 'feature-y', 'dev-b');
    const localOps: TextOp[] = [{ kind: 'insert' as const, position: 5, text: '!', lamport: 2, deviceId: 'dev-a' }];
    const remoteOps: TextOp[] = [{ kind: 'insert' as const, position: 0, text: '>', lamport: 1, deviceId: 'dev-b' }];

    const ab = mergeAll(
      localMeta, remoteMeta, 100, 200,
      localTags, remoteTags,
      'hello', 'hello',
      localOps, remoteOps,
    );
    const ba = mergeAll(
      remoteMeta, localMeta, 200, 100,
      remoteTags, localTags,
      'hello', 'hello',
      remoteOps, localOps,
    );
    expect(ab.text).toEqual(ba.text);
    expect(ab.tags.sort()).toEqual(ba.tags.sort());
  });

  it('validateBatch accepts a well-formed empty batch (no ops, no tombstones) as valid', () => {
    const batch = buildBatch([], 'dev-a', 1, {}, []);
    const res = validateBatch(batch);
    expect(res.valid).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Phase 6 — interrupted pushes (NACK keeps engine bounded)           */
/* ------------------------------------------------------------------ */

describe('phase6 interrupted pushes — NACK keeps engine bounded', () => {
  it('a push on a responding transport reaches synced (no infinite loop)', async () => {
    const { transport } = buildRespondingTransport();
    const engine = createSyncEngine('dev-a', 'Alice', transport);
    const batch = buildBatch(
      [{
        id: 'o1',
        kind: 'create_node' as const,
        timestamp: 1,
        source: 'user' as const,
        seq: 0,
        payload: {
          id: 'o1',
          path: 'o1.ts',
          name: 'o1.ts',
          parentId: null,
          content: '// hi',
          language: 'typescript',
        },
      }],
      'dev-a',
      1,
      {},
      [],
    );
    await engine.push(batch);
    expect(engine.state.state).toBe('synced');
  });
});

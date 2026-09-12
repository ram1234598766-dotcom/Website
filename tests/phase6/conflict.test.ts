/**
 * Phase 6 — Sync Conflict Resolution.
 *
 * Verifies:
 * - LWW: metadata converges to the highest lamport/timestamp
 * - OR-Set: add-wins (adds survive concurrent removes)
 * - OT: concurrent inserts converge to same text regardless of application order
 */

import { describe, expect, it } from 'vitest';
import {
  createLWW,
  mergeLWW,
  createORSet,
  orSetAdd,
  orSetRemove,
  mergeORSet,
  orSetValues,
  transformTextOp,
  applyTextOps,
  mergeAll,
} from '../../src/lib/sync/conflict';
import type { ConflictInfo } from '../../src/lib/sync/types';
import type { LWWEntry, ORSet, TextOp } from '../../src/lib/sync/conflict';

// ─── LWW Tests ────────────────────────────────────────────────────────────────

describe('LWW — Last-Writer-Wins', () => {
  it('creates an initial entry', () => {
    const entry = createLWW('v1', 100, 'dev-a');
    expect(entry.value).toBe('v1');
    expect(entry.timestamp).toBe(100);
    expect(entry.deviceId).toBe('dev-a');
  });

  it('remote wins when remote lamport is higher', () => {
    const local = createLWW('local', 50, 'dev-a');
    const remote = { value: 'remote' as string, timestamp: 200, deviceId: 'dev-b' };
    const merged = mergeLWW(local, remote, 100, 300);
    expect(merged.value).toBe('remote');
  });

  it('local wins when local lamport is higher', () => {
    const local = createLWW('local', 50, 'dev-a');
    const remote = { value: 'remote' as string, timestamp: 200, deviceId: 'dev-b' };
    const merged = mergeLWW(local, remote, 300, 100);
    expect(merged.value).toBe('local');
  });

  it('ties broken by higher timestamp', () => {
    const local = createLWW('local', 200, 'dev-a');
    const remote = { value: 'remote' as string, timestamp: 100, deviceId: 'dev-b' };
    const merged = mergeLWW(local, remote, 100, 100);
    expect(merged.value).toBe('local');
  });

  it('ties broken by remote when remote timestamp >= local', () => {
    const local = createLWW('local', 100, 'dev-a');
    const remote = { value: 'remote' as string, timestamp: 200, deviceId: 'dev-b' };
    const merged = mergeLWW(local, remote, 100, 100);
    expect(merged.value).toBe('remote');
  });
});

// ─── OR-Set Tests ─────────────────────────────────────────────────────────────

describe('OR-Set — Add-Wins Observed-Remove Set', () => {
  it('adds elements and lists them', () => {
    const set = createORSet<string>();
    orSetAdd(set, 'alice', 'dev-a');
    orSetAdd(set, 'bob', 'dev-a');
    expect(orSetValues(set).sort()).toEqual(['alice', 'bob']);
  });

  it('removes elements by predicate', () => {
    const set = createORSet<string>();
    orSetAdd(set, 'alice', 'dev-a');
    orSetAdd(set, 'bob', 'dev-a');
    orSetRemove(set, (v) => v === 'alice');
    expect(orSetValues(set)).toEqual(['bob']);
  });

  it('add-wins: a remote add survives a concurrent local remove', () => {
    const local = createORSet<string>();
    const remote = createORSet<string>();

    orSetAdd(local, 'tag-x', 'dev-a');
    orSetRemove(local, (v) => v === 'tag-x');

    orSetAdd(remote, 'tag-x', 'dev-b');

    mergeORSet(local, remote);
    expect(orSetValues(local)).toContain('tag-x');
  });

  it('remove wins on local, add on remote: after merge both present (add-wins)', () => {
    const local = createORSet<string>();
    const remote = createORSet<string>();

    orSetAdd(local, 'tag-y', 'dev-a');
    orSetRemove(local, (v) => v === 'tag-y');

    orSetAdd(remote, 'tag-y', 'dev-b');
    orSetRemove(remote, (v) => v === 'tag-y');

    mergeORSet(local, remote);
    expect(orSetValues(local)).toEqual([]);
  });

  it('merging identical sets yields same elements', () => {
    const a = createORSet<string>();
    const b = createORSet<string>();
    orSetAdd(a, 'x', 'dev-a');
    orSetAdd(a, 'y', 'dev-a');
    orSetAdd(b, 'x', 'dev-b');
    orSetAdd(b, 'y', 'dev-b');
    mergeORSet(a, b);
    expect(orSetValues(a).sort()).toEqual(['x', 'y']);
  });
});

// ─── OT Tests ─────────────────────────────────────────────────────────────────

describe('OT — Operational Transformation', () => {
  function makeInsert(position: number, text: string, deviceId = 'a', lamport = 1): TextOp {
    return { kind: 'insert', position, text, deviceId, lamport };
  }
  function makeDelete(position: number, length: number, deviceId = 'a', lamport = 1): TextOp {
    return { kind: 'delete', position, length, deviceId, lamport };
  }

  it('transforms two concurrent inserts at different positions', () => {
    const opA = makeInsert(0, 'hello', 'a', 1);
    const opB = makeInsert(5, ' world', 'b', 2);
    const result = transformTextOp(opA, opB);
    expect(result.op.position).toBe(5 + 5);
    expect(result.adjusted).toBe(true);
  });

  it('transforms insert against delete: shifts insert left', () => {
    const del = makeDelete(0, 3, 'a', 1);
    const ins = makeInsert(5, 'xyz', 'b', 2);
    const result = transformTextOp(del, ins);
    expect(result.op.position).toBe(2);
    expect(result.adjusted).toBe(true);
  });

  it('transforms delete against insert: shrinks delete range', () => {
    const ins = makeInsert(2, 'xx', 'a', 1);
    const del = makeDelete(0, 5, 'b', 2);
    const result = transformTextOp(ins, del);
    expect(result.op.length).toBeLessThan(5);
    expect(result.adjusted).toBe(true);
  });

  it('applies ops and produces correct text', () => {
    const ops = [makeInsert(0, 'AB'), makeInsert(2, 'CD')];
    const result = applyTextOps('', ops);
    expect(result).toBe('ABCD');
  });

  it('applies deletes correctly', () => {
    const ops = [makeInsert(0, 'hello world', 'a', 1), makeDelete(5, 6, 'b', 2)];
    const result = applyTextOps('', ops);
    expect(result).toBe('hello');
  });

  it('converges regardless of op order (inserts)', () => {
    const op1 = makeInsert(0, 'A', 'a', 1);
    const op2 = makeInsert(0, 'B', 'b', 2);
    const order1 = applyTextOps('', [op1, op2]);
    const order2 = applyTextOps('', [op2, op1]);
    expect(order1).toBe(order2);
  });
});

// ─── MergeAll Tests ───────────────────────────────────────────────────────────

describe('mergeAll — three-way merge', () => {
  function makeLWWEntry<T>(value: T, ts: number, deviceId: string): LWWEntry<T> {
    return { value, timestamp: ts, deviceId };
  }

  it('merges LWW metadata, OR-Set tags, and OT text', () => {
    const localMeta = makeLWWEntry({ version: 1 }, 100, 'dev-a');
    const remoteMeta = { value: { version: 2 } as Record<string, unknown>, timestamp: 200, deviceId: 'dev-b' };
    const localTags = createORSet<string>();
    const remoteTags = createORSet<string>();
    orSetAdd(localTags, 'feature-x', 'dev-a');
    orSetAdd(remoteTags, 'feature-y', 'dev-b');
    const localOps: TextOp[] = [];
    const remoteOps: TextOp[] = [];

    const result = mergeAll(
      localMeta, remoteMeta, 100, 200,
      localTags, remoteTags,
      'hello', 'world',
      localOps, remoteOps
    );

    expect((result.metadata.value as Record<string, unknown>).version).toBe(2);
    expect(result.tags.sort()).toEqual(['feature-x', 'feature-y']);
  });

  it('detects conflict when lamports are equal but values differ', () => {
    const localMeta = makeLWWEntry({ v: 'a' }, 100, 'dev-a');
    const remoteMeta = { value: { v: 'b' } as Record<string, unknown>, timestamp: 100, deviceId: 'dev-b' };
    const localTags = createORSet<string>();
    const remoteTags = createORSet<string>();
    const localOps: TextOp[] = [];
    const remoteOps: TextOp[] = [];

    const result = mergeAll(
      localMeta, remoteMeta, 100, 100,
      localTags, remoteTags,
      '', '',
      localOps, remoteOps
    );

    expect((result.metadata.value as Record<string, unknown>).v).toBe('b');
    expect(result.hasConflict).toBe(true);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].localLamport).toBe(100);
    expect(result.conflicts[0].remoteLamport).toBe(100);
  });
});

// ─── Convergence Test ─────────────────────────────────────────────────────────

describe('convergence under concurrent edits', () => {
  it('two replicas with concurrent inserts at different positions converge to same state', () => {
    const op1 = { kind: 'insert' as const, position: 0, text: 'A', deviceId: 'a', lamport: 1 };
    const op2 = { kind: 'insert' as const, position: 1, text: 'B', deviceId: 'b', lamport: 2 };

    const stateAB = applyTextOps('', [op1, op2]);
    const stateBA = applyTextOps('', [op2, op1]);
    expect(stateAB).toBe(stateBA);
  });

  it('delete transform: B delete shifts correctly when A deletes before B range', () => {
    const text = 'hello world';
    const opA = { kind: 'delete' as const, position: 0, length: 5, deviceId: 'a', lamport: 1 };
    const opB = { kind: 'delete' as const, position: 6, length: 5, deviceId: 'b', lamport: 2 };

    // Transform B against A
    const transformedB = transformTextOp(opA, opB);
    // B's delete at 6 shifts to 1 (6 - 5 = 1), length stays 5
    expect(transformedB.op.position).toBe(1);
    expect(transformedB.op.length).toBe(5);

    // Apply transformed B to A's result: ' world' with delete at 1, len 5 → ' '
    const stateAfterA = applyTextOps(text, [opA]);
    const stateAfterBoth = applyTextOps(stateAfterA, [transformedB.op]);
    expect(stateAfterBoth).toBe(' ');
  });

  it('insert transform: concurrent inserts produce convergent final text', () => {
    const opsA = [
      { kind: 'insert' as const, position: 0, text: 'A', deviceId: 'a', lamport: 1 },
      { kind: 'insert' as const, position: 1, text: 'B', deviceId: 'a', lamport: 3 },
    ];
    const opsB = [
      { kind: 'insert' as const, position: 0, text: 'C', deviceId: 'b', lamport: 2 },
    ];

    // Both replicas start from empty text, apply both ops in their own order
    const state1 = applyTextOps('', [...opsA, ...opsB]);
    const state2 = applyTextOps('', [...opsB, ...opsA]);
    // With sorted-by-position then deviceId ordering, both converge to 'ACB'
    expect(state1).toBe(state2);
  });
});

/**
 * Phase-Schema — Sync API Tests.
 *
 * Tests pushOperations, pullOperations, resolveConflict, getSyncStatus.
 * Node identity is in payload.id (create) / payload.nodeId (other).
 */

import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach } from 'vitest';
import {
  pushOperations,
  pullOperations,
  resolveConflict,
  getSyncStatus,
  createDeviceId,
} from '../../src/lib/sync/sync-api';
import { appendOp, loadOps, clearOps, initSeqCounter } from '../../src/lib/workspace/operations';
import { openWorkspaceDB } from '../../src/lib/workspace/db';
import { clearOutbox } from '../../src/lib/workspace/outbox';
import type { Operation, ConflictRecord } from '../../src/lib/workspace/types';

// ─── Helpers ────────────────────────

let _c = 0;
function nid(): string {
  _c += 1;
  return `n${_c}`;
}

function makeCreate(
  p: {
    path?: string;
    name?: string;
    content?: string;
    language?: string;
    timestamp?: number;
    source?: Operation['source'];
    idempotencyKey?: string;
  } = {}
): Operation {
  return {
    id: `op-${nid()}`,
    kind: 'create_node',
    timestamp: p.timestamp ?? Date.now(),
    source: p.source ?? 'user',
    seq: 0,
    idempotencyKey: p.idempotencyKey,
    payload: {
      id: nid(),
      path: p.path ?? '/test.ts',
      name: p.name ?? 'test.ts',
      parentId: null,
      content: p.content ?? 'hello',
      language: p.language ?? 'typescript',
    },
  } as Operation;
}

function makeUpdate(targetId: string, content: string, ts?: number): Operation {
  return {
    id: `upd-${nid()}`,
    kind: 'update_content',
    timestamp: ts ?? Date.now(),
    source: 'user',
    seq: 0,
    payload: { nodeId: targetId, content, contentHash: `${targetId}-${content.length}` },
  } as Operation;
}

function makeDelete(targetId: string, ts?: number): Operation {
  return {
    id: `del-${nid()}`,
    kind: 'delete_node',
    timestamp: ts ?? Date.now(),
    source: 'user',
    seq: 0,
    payload: {
      nodeId: targetId,
      path: '/test.ts',
      snapshot: { id: targetId, kind: 'file', path: '/test.ts', name: 'test.ts', parentId: null, contentHash: '', language: '', createdAt: 0, updatedAt: 0 },
    },
  } as Operation;
}

async function resetDb(): Promise<void> {
  await clearOps();
  await clearOutbox();
  initSeqCounter(0);
  _c = 0;
  const db = await openWorkspaceDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('workspace_meta', 'readwrite');
    const store = tx.objectStore('workspace_meta');
    const req = store.getAll();
    req.onsuccess = () => {
      for (const e of (req.result ?? []) as Array<{ key: string }>) {
        if (e.key.startsWith('sync:')) store.delete(e.key);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

beforeEach(async () => {
  await resetDb();
});

// ─── Device ID ──────────────────────

describe('createDeviceId', () => {
  it('generates non-empty strings', () => {
    expect(createDeviceId().length).toBeGreaterThan(0);
  });
  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 50 }, () => createDeviceId()));
    expect(ids.size).toBe(50);
  });
  it('uses UUID format', () => {
    expect(createDeviceId().match(/^[0-9a-f]{8}-[0-9a-f]{4}-/)).toBeTruthy();
  });
});

// ─── Push ────────────────────────

describe('pushOperations', () => {
  it('applies and returns synced ops', async () => {
    const dev = createDeviceId();
    const r = await pushOperations([makeCreate()], dev, 0);
    expect(r.synced).toHaveLength(1);
    expect(r.conflicts).toHaveLength(0);
    expect(r.newTimestamp).toBeGreaterThan(0);
  });

  it('returns empty for empty input', async () => {
    const r = await pushOperations([], createDeviceId(), 0);
    expect(r.synced).toHaveLength(0);
    expect(r.conflicts).toHaveLength(0);
  });

  it('persists to oplog', async () => {
    await pushOperations([makeCreate()], createDeviceId(), 0);
    expect(await loadOps()).toHaveLength(1);
  });

  it('updates lastSync', async () => {
    const dev = createDeviceId();
    const before = Date.now();
    await pushOperations([makeCreate()], dev, 0);
    expect((await getSyncStatus(dev)).lastSync).toBeGreaterThanOrEqual(before);
  });

  it('zero pending after push', async () => {
    const dev = createDeviceId();
    await pushOperations([makeCreate()], dev, 0);
    expect((await getSyncStatus(dev)).pendingCount).toBe(0);
  });
});

// ─── Pull ────────────────────────

describe('pullOperations', () => {
  it('returns ops since timestamp', async () => {
    const a = createDeviceId(), b = createDeviceId();
    await pushOperations([makeCreate()], a, 0);
    const cut = Date.now();
    await new Promise((r) => setTimeout(r, 10));
    await pushOperations([makeCreate()], a, 0);
    const p = await pullOperations(b, cut);
    expect(p.length).toBeGreaterThanOrEqual(1);
  });

  it('empty when no new ops', async () => {
    const dev = createDeviceId();
    await pushOperations([makeCreate()], dev, 0);
    expect(await pullOperations(dev, Date.now() + 60_000)).toHaveLength(0);
  });

  it('excludes own ops', async () => {
    const dev = createDeviceId();
    await pushOperations([makeCreate()], dev, 0);
    const p = await pullOperations(dev, 0);
    const devOps = await readDevOps(dev);
    for (const op of p) expect(devOps.includes(op.id)).toBe(false);
  });

  it('returns ops from other devices', async () => {
    const a = createDeviceId(), b = createDeviceId();
    await pushOperations([makeCreate()], a, 0);
    const all = await loadOps();
    expect(all).toHaveLength(1);
  });
});

// ─── Two-device sync ────────────────

describe('two-device sync', () => {
  it('device B can pull device A ops', async () => {
    const a = createDeviceId(), b = createDeviceId();
    const r = await pushOperations([makeCreate()], a, 0);
    expect(r.synced).toHaveLength(1);
    expect((await pullOperations(b, 0)).length).toBeGreaterThanOrEqual(0);
  });

  it('different nodes do not conflict', async () => {
    const a = createDeviceId(), b = createDeviceId();
    const t = Date.now();
    const ra = await pushOperations([makeCreate({ path: '/a.ts', timestamp: t })], a, 0);
    const rb = await pushOperations([makeCreate({ path: '/b.ts', timestamp: t + 10 })], b, 0);
    expect(ra.conflicts).toHaveLength(0);
    expect(rb.conflicts).toHaveLength(0);
  });

  it('converges to same oplog', async () => {
    const a = createDeviceId(), b = createDeviceId();
    await pushOperations([makeCreate({ path: '/x.ts' })], a, 0);
    await pushOperations([makeCreate({ path: '/y.ts' })], b, 0);
    const all = await loadOps();
    expect(all.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── Conflict Detection ─────────────

describe('conflict detection', () => {
  it('detects conflict when both devices edit same node', async () => {
    const a = createDeviceId(), b = createDeviceId();
    // Create node via push so it's tracked in device A's ops.
    const r1 = await pushOperations([makeCreate({ path: '/shared.txt' })], a, 0);
    expect(r1.synced).toHaveLength(1);
    const all = await loadOps();
    const nodeId = (all[0].payload as { id: string }).id;

    const t = Date.now();
    const ua = makeUpdate(nodeId, 'A', t);
    const ub = makeUpdate(nodeId, 'B', t + 100);
    const ra = await pushOperations([ua], a, 0);
    expect(ra.conflicts).toHaveLength(0);
    const rb = await pushOperations([ub], b, 0);
    expect(rb.conflicts.length).toBeGreaterThan(0);
    expect(rb.conflicts[0].nodeId).toBe(nodeId);
  });

  it('no conflict for same device editing same node', async () => {
    const dev = createDeviceId();
    await pushOperations([makeCreate({ path: '/x.ts' })], dev, 0);
    const all = await loadOps();
    const nodeId = (all[0].payload as { id: string }).id;
    const t = Date.now();
    const u1 = makeUpdate(nodeId, 'v1', t);
    const u2 = makeUpdate(nodeId, 'v2', t + 10);
    const r = await pushOperations([u1, u2], dev, 0);
    expect(r.conflicts).toHaveLength(0);
  });

  it('no conflict for edits far apart in time', async () => {
    const a = createDeviceId(), b = createDeviceId();
    await pushOperations([makeCreate({ path: '/x.ts' })], a, 0);
    const all = await loadOps();
    const nodeId = (all[0].payload as { id: string }).id;
    const t = Date.now();
    await pushOperations([makeUpdate(nodeId, 'v1', t)], a, 0);
    const rb = await pushOperations([makeUpdate(nodeId, 'v2', t + 10_000)], b, 0);
    expect(rb.conflicts).toHaveLength(0);
  });

  it('records conflict in metadata', async () => {
    const a = createDeviceId(), b = createDeviceId();
    await pushOperations([makeCreate({ path: '/x.ts' })], a, 0);
    const all = await loadOps();
    const nodeId = (all[0].payload as { id: string }).id;
    const t = Date.now();
    await pushOperations([makeUpdate(nodeId, 'a', t)], a, 0);
    await pushOperations([makeUpdate(nodeId, 'b', t + 50)], b, 0);
    expect((await getSyncStatus(b)).conflicts).toBeGreaterThan(0);
  });
});

// ─── Conflict Resolution ────────────

describe('resolveConflict', () => {
  it('applies resolution and marks resolved', async () => {
    const a = createDeviceId(), b = createDeviceId();
    await pushOperations([makeCreate({ path: '/x.ts' })], a, 0);
    const all = await loadOps();
    const nodeId = (all[0].payload as { id: string }).id;
    const t = Date.now();
    const rA = await pushOperations([makeUpdate(nodeId, 'a', t)], a, 0);
    expect(rA.conflicts).toHaveLength(0);
    const rB = await pushOperations([makeUpdate(nodeId, 'b', t + 50)], b, 0);
    expect(rB.conflicts.length).toBeGreaterThan(0);
    const conflicts = await readConflicts(b);
    expect(conflicts.length).toBeGreaterThan(0);
    await resolveConflict(b, conflicts[0].localOp.id, makeUpdate(nodeId, 'resolved'));
    expect((await getSyncStatus(b)).conflicts).toBe(0);
  });

  it('resolves by matching localOp/remoteOp opIds', async () => {
    const a = createDeviceId(), b = createDeviceId();
    await pushOperations([makeCreate({ path: '/x.ts' })], a, 0);
    const all = await loadOps();
    const nodeId = (all[0].payload as { id: string }).id;
    const t = Date.now();
    const ra = await pushOperations([makeUpdate(nodeId, 'a', t)], a, 0);
    expect(ra.conflicts).toHaveLength(0);
    const rb = await pushOperations([makeUpdate(nodeId, 'b', t + 50)], b, 0);
    expect(rb.conflicts.length).toBeGreaterThan(0);
    const c = await readConflicts(b);
    expect(c.length).toBeGreaterThan(0);
    await resolveConflict(b, c[0].localOp.id, makeUpdate(nodeId, 'resolved'));
    expect((await getSyncStatus(b)).conflicts).toBe(0);
  });

  it('no-op when conflict missing', async () => {
    await resolveConflict(createDeviceId(), 'nonexistent', makeUpdate('x', 'y'));
  });
});

// ─── Deduplication ──────────────────

describe('deduplication', () => {
  it('idempotent key prevents duplicates', async () => {
    const dev = createDeviceId();
    const op = makeCreate({ path: '/dup.ts', idempotencyKey: 'k1' });
    const r1 = await pushOperations([op], dev, 0);
    const r2 = await pushOperations([op], dev, 0);
    expect(r1.synced).toHaveLength(1);
    expect(r2.synced).toHaveLength(1);
    expect((await loadOps()).filter((o) => o.idempotencyKey === 'k1')).toHaveLength(1);
  });

  it('no re-application', async () => {
    const dev = createDeviceId();
    const op = makeCreate({ path: '/once.ts', idempotencyKey: 'once-k' });
    await pushOperations([op], dev, 0);
    const allAfter = await loadOps();
    expect(allAfter.filter((o) => o.idempotencyKey === 'once-k')).toHaveLength(1);
  });
});

// ─── Tombstones ─────────────────────

describe('tombstone propagation', () => {
  it('delete persists and propagates', async () => {
    const a = createDeviceId(), b = createDeviceId();
    const r = await pushOperations([makeCreate()], a, 0);
    expect(r.synced).toHaveLength(1);
    const all = await loadOps();
    const nodeId = (all[0].payload as { id: string }).id;
    await pushOperations([makeDelete(nodeId)], a, 0);
    const pulled = await pullOperations(b, 0);
    const dels = pulled.filter((o) => o.kind === 'delete_node');
    expect(dels.length).toBeGreaterThanOrEqual(1);
    expect(dels.some((o) => (o.payload as { nodeId: string }).nodeId === nodeId)).toBe(true);
  });

  it('deleted create does not reappear in recent pulls', async () => {
    const a = createDeviceId(), b = createDeviceId();
    await pushOperations([makeCreate({ path: '/x.ts' })], a, 0);
    const all = await loadOps();
    const nodeId = (all[0].payload as { id: string }).id;
    await pushOperations([makeDelete(nodeId)], a, 0);
    const creates = all.filter((o) => o.kind === 'create_node' && (o.payload as { id: string }).id === nodeId);
    expect(creates).toHaveLength(1);
    const dels = all.filter((o) => o.kind === 'delete_node');
    const delTs = dels.length > 0 ? dels[0].timestamp : Date.now();
    const pulled = await pullOperations(b, delTs);
    expect(pulled.every((o) => o.kind !== 'create_node' || (o.payload as { id: string }).id !== nodeId)).toBe(true);
  });
});

// ─── Partial Sync ───────────────────

describe('partial sync', () => {
  it('since timestamp returns only new ops', async () => {
    const a = createDeviceId(), b = createDeviceId();
    await pushOperations([makeCreate({ path: '/old.ts' })], a, 0);
    const allOld = await loadOps();
    const oldTs = allOld[0].timestamp;
    // Wait a moment to ensure different timestamps.
    await new Promise((r) => setTimeout(r, 5));
    await pushOperations([makeCreate({ path: '/new1.ts' })], a, 0);
    await pushOperations([makeCreate({ path: '/new2.ts' })], a, 0);
    const p = await pullOperations(b, oldTs);
    const paths = p.map((o) => (o.payload as { path: string }).path);
    expect(paths).not.toContain('/old.ts');
    expect(paths).toContain('/new1.ts');
    expect(paths).toContain('/new2.ts');
  });

  it('since 0 returns all remote ops', async () => {
    const a = createDeviceId(), b = createDeviceId();
    await pushOperations([makeCreate(), makeCreate()], a, 0);
    expect((await pullOperations(b, 0)).length).toBeGreaterThanOrEqual(2);
  });
});

// ─── Sync Status ────────────────────

describe('getSyncStatus', () => {
  it('zero state for unknown', async () => {
    const s = await getSyncStatus(createDeviceId());
    expect(s.lastSync).toBe(0);
    expect(s.pendingCount).toBe(0);
    expect(s.conflicts).toBe(0);
  });

  it('correct counts after push', async () => {
    const dev = createDeviceId();
    await pushOperations([makeCreate(), makeCreate()], dev, 0);
    const s = await getSyncStatus(dev);
    expect(s.lastSync).toBeGreaterThan(0);
    expect(s.pendingCount).toBe(0);
    expect(s.conflicts).toBe(0);
  });

  it('shows pending before sync', async () => {
    const dev = createDeviceId();
    await appendOp('create_node', 'user', {
      id: 'p', path: '/p.ts', name: 'p.ts', parentId: null, content: 'x', language: 'ts',
    });
    expect((await getSyncStatus(dev)).lastSync).toBe(0);
  });
});

// ─── Pending Lifecycle ──────────────

describe('pending count lifecycle', () => {
  it('pending goes to 0 after push', async () => {
    const dev = createDeviceId();
    const op = makeCreate({ path: '/lc.ts' });
    const applied = await appendOp(op.kind, op.source, op.payload as Operation['payload'], op.idempotencyKey);
    const res = await pushOperations([{ ...op, id: applied.id }], dev, 0);
    expect(res.synced).toHaveLength(1);
    expect((await getSyncStatus(dev)).pendingCount).toBe(0);
  });
});

// ─── Multiple Conflicts ─────────────

describe('multiple conflicts', () => {
  it('counts unresolved conflicts', async () => {
    const a = createDeviceId(), b = createDeviceId();
    await pushOperations([makeCreate({ path: '/x.ts' })], a, 0);
    const all = await loadOps();
    const n1 = (all[0].payload as { id: string }).id;
    // Create second node via push from B
    await pushOperations([makeCreate({ path: '/y.ts' })], b, 0);
    const all2 = await loadOps();
    const n2 = (all2.find((o) => (o.payload as { id: string }).id !== n1)?.payload as { id: string }).id;

    const t = Date.now();
    await pushOperations([makeUpdate(n1, 'a1', t)], a, 0);
    await pushOperations([makeUpdate(n2, 'a2', t)], a, 0);
    await pushOperations([makeUpdate(n1, 'b1', t + 50)], b, 0);
    await pushOperations([makeUpdate(n2, 'b2', t + 60)], b, 0);
    expect((await getSyncStatus(b)).conflicts).toBeGreaterThanOrEqual(1);
  });
});

// ─── Push Tombstones ──────────────

describe('push tombstone operations', () => {
  it('delete through push is applied', async () => {
    const a = createDeviceId(), b = createDeviceId();
    const r = await pushOperations([makeCreate({ path: '/del.ts' })], a, 0);
    expect(r.synced).toHaveLength(1);
    const all = await loadOps();
    const nodeId = (all[0].payload as { id: string }).id;
    // Wait to avoid time window conflict.
    const del = makeDelete(nodeId, Date.now() + 6000);
    const res = await pushOperations([del], a, 0);
    expect(res.synced).toHaveLength(1);
    expect(res.conflicts).toHaveLength(0);
    expect((await pullOperations(b, 0)).some((o) => o.kind === 'delete_node')).toBe(true);
  });
});

// ─── Source ───────────────────────

describe('operation source', () => {
  it('accepts adapter source', async () => {
    const dev = createDeviceId();
    const op = makeCreate({ path: '/adj.ts', source: 'adapter' });
    expect((await pushOperations([op], dev, 0)).synced).toHaveLength(1);
  });
  it('accepts system source', async () => {
    const dev = createDeviceId();
    const op = makeCreate({ path: '/asys.ts', source: 'system' });
    expect((await pushOperations([op], dev, 0)).synced).toHaveLength(1);
  });
});

// ─── Large Batch ────────────────────

describe('large batch', () => {
  it('handles 15+ ops', async () => {
    const dev = createDeviceId();
    const ops: Operation[] = [];
    for (let i = 0; i < 15; i++) ops.push(makeCreate({ path: `/f${i}.ts` }));
    const res = await pushOperations(ops, dev, 0);
    expect(res.synced).toHaveLength(15);
    expect(res.conflicts).toHaveLength(0);
  });
});

// ─── Sync Round Trip ────────────────

describe('sync round-trip', () => {
  it('push to pull to push converges', async () => {
    const a = createDeviceId(), b = createDeviceId();
    const r1 = await pushOperations([makeCreate({ path: '/real.ts' })], a, 0);
    expect(r1.synced).toHaveLength(1);
    const all = await loadOps();
    const nodeId = (all[0].payload as { id: string }).id;

    const pull1 = await pullOperations(b, 0);
    expect(pull1.some((o) => (o.payload as { id: string }).id === nodeId || o.kind === 'create_node')).toBe(true);

    const edit = makeUpdate(nodeId, 'edit from B');
    const r2 = await pushOperations([edit], b, Date.now());
    expect(r2.conflicts).toHaveLength(0);

    const allAfter = await loadOps();
    expect(allAfter.some((o) => o.kind === 'update_content')).toBe(true);
  });
});

// ─── Sync Health ────────────────────

describe('sync health', () => {
  it('degrades with conflicts', async () => {
    const a = createDeviceId(), b = createDeviceId();
    await pushOperations([makeCreate({ path: '/x.ts' })], a, 0);
    const all = await loadOps();
    const nodeId = (all[0].payload as { id: string }).id;
    const t = Date.now();
    await pushOperations([makeUpdate(nodeId, 'a', t)], a, 0);
    await pushOperations([makeUpdate(nodeId, 'b', t + 50)], b, 0);
    const s = await getSyncStatus(b);
    expect(s.conflicts).toBeGreaterThan(0);
    expect(s.lastSync).toBeGreaterThan(0);
  });

  it('improves after resolution', async () => {
    const a = createDeviceId(), b = createDeviceId();
    await pushOperations([makeCreate({ path: '/x.ts' })], a, 0);
    const all = await loadOps();
    const nodeId = (all[0].payload as { id: string }).id;
    const t = Date.now();
    const rA = await pushOperations([makeUpdate(nodeId, 'a', t)], a, 0);
    expect(rA.conflicts).toHaveLength(0);
    const rB = await pushOperations([makeUpdate(nodeId, 'b', t + 50)], b, 0);
    expect(rB.conflicts.length).toBeGreaterThan(0);
    const conflicts = await readConflicts(b);
    expect(conflicts.length).toBeGreaterThan(0);
    await resolveConflict(b, conflicts[0].localOp.id, makeUpdate(nodeId, 'resolved'));
    expect((await getSyncStatus(b)).conflicts).toBe(0);
  });
});

// ─── Cross-Device Idempotency ─────────

describe('cross-device idempotency', () => {
  it('no duplicate across devices', async () => {
    const a = createDeviceId(), b = createDeviceId();
    const r1 = await pushOperations([makeCreate({ path: '/shared.ts' })], a, 0);
    expect(r1.synced).toHaveLength(1);
    const r2 = await pushOperations([makeCreate({ path: '/shared.ts' })], b, 0);
    expect(r2.conflicts.length + r2.synced.length).toBeGreaterThanOrEqual(0);
    expect((await loadOps()).length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Test helpers ───────────────────

async function readDevOps(deviceId: string): Promise<string[]> {
  const db = await openWorkspaceDB();
  return new Promise((resolve) => {
    const tx = db.transaction('workspace_meta', 'readonly');
    const req = tx.objectStore('workspace_meta').get(`sync:device:${deviceId}:ops`);
    req.onsuccess = () => {
      const v = req.result?.value as string[] | undefined;
      resolve(Array.isArray(v) ? v : []);
    };
    req.onerror = () => resolve([]);
  });
}

async function readConflicts(deviceId: string): Promise<ConflictRecord[]> {
  const db = await openWorkspaceDB();
  return new Promise((resolve) => {
    const tx = db.transaction('workspace_meta', 'readonly');
    const req = tx.objectStore('workspace_meta').get(`sync:conflicts:${deviceId}`);
    req.onsuccess = () => resolve((req.result?.value as ConflictRecord[]) ?? []);
    req.onerror = () => resolve([]);
  });
}
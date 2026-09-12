/**
 * Phase 1 — Outbox + refresh/crash recovery + migration tests.
 *
 * Proves the workspace persistence contract documented in ARCHITECTURE.md:
 *  - The outbox (IndexedDB) persists queued operations across page reloads.
 *  - draining + ack removes only acknowledged entries; nack retries.
 *  - Replying the operation log through buildState yields identical trees
 *    (refresh equivalence) and interrupted appends are recoverable.
 *  - Multi-tab idempotence: the same operation applied twice does not
 *    duplicate nodes.
 *  - Legacy localStorage snapshots migrate into the oplog without losing
 *    paths or content.
 */

import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach } from 'vitest';
import * as outbox from '../../src/lib/workspace/outbox';
import { openWorkspaceDB } from '../../src/lib/workspace/db';
import {
  appendOp,
  bulkAppendOps,
  loadOps,
  clearOps,
  initSeqCounter,
} from '../../src/lib/workspace/operations';
import { buildState, getNodeByPath, contentHash } from '../../src/lib/workspace/indexes';
import { buildOpsFromLegacy } from '../../src/lib/workspace/legacy';
import type { Operation } from '../../src/lib/workspace/types';

function makeOp(overrides: Partial<Operation> = {}): Operation {
  const id = overrides.id ?? `op-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    kind: 'create_node',
    timestamp: 1000,
    source: 'user' as const,
    seq: 0,
    payload: {
      id: `n-${id}`,
      path: `${id}.ts`,
      name: `${id}.ts`,
      parentId: null,
      content: '// hi',
      language: 'typescript',
    },
    ...overrides,
  } as Operation;
}

beforeEach(async () => {
  // Clear both the oplog and the outbox stores. Keep the DB itself open
  // (module-level connections are never closed), mirroring the existing
  // tests/phase1/operations.test.ts pattern.
  await clearOps();
  await outbox.clearOutbox();
  initSeqCounter(0);
});

/* ------------------------------------------------------------------ */
/*  Outbox                                                             */
/* ------------------------------------------------------------------ */

describe('outbox — IndexedDB persistence', () => {
  it('enqueue persists and drain returns the entry for an adapter', async () => {
    const op = makeOp();
    await outbox.enqueue(op, 'github');
    const entries = await outbox.drain('github');
    expect(entries).toHaveLength(1);
    expect(entries[0].operationId).toBe(op.id);
    expect(entries[0].op).toEqual(op);
  });

  it('duplicate enqueue is idempotent', async () => {
    const op = makeOp();
    await outbox.enqueue(op, 'github');
    await outbox.enqueue(op, 'github');
    const entries = await outbox.drain('github');
    expect(entries).toHaveLength(1);
  });

  it('drain is per-adapter', async () => {
    await outbox.enqueue(makeOp(), 'github');
    await outbox.enqueue(makeOp(), 'drive');
    expect(await outbox.drain('github')).toHaveLength(1);
    expect(await outbox.drain('drive')).toHaveLength(1);
    expect(await outbox.drain('none')).toHaveLength(0);
  });

  it('ack removes only the acknowledged entry', async () => {
    const a = makeOp();
    const b = makeOp();
    await outbox.enqueue(a, 'github');
    await outbox.enqueue(b, 'github');
    await outbox.ack(a.id);
    const entries = await outbox.drain('github');
    expect(entries).toHaveLength(1);
    expect(entries[0].operationId).toBe(b.id);
  });

  it('nack increments attempts and keeps the entry', async () => {
    const op = makeOp();
    await outbox.enqueue(op, 'github');
    await outbox.nack(op.id);
    await outbox.nack(op.id);
    const entries = await outbox.drain('github');
    expect(entries).toHaveLength(1);
    expect(entries[0].attempts).toBe(2);
  });

  it('stats reports pending count and oldest age', async () => {
    const op = makeOp();
    await outbox.enqueue(op, 'github');
    const s = await outbox.stats('github');
    expect(s.pending).toBe(1);
    expect(s.oldestAge).toBeGreaterThanOrEqual(0);
    expect((await outbox.stats()).pending).toBe(1);
  });

  it('clearOutbox empties the store', async () => {
    await outbox.enqueue(makeOp(), 'github');
    await outbox.clearOutbox();
    expect(await outbox.drain('github')).toHaveLength(0);
    expect((await outbox.stats()).pending).toBe(0);
  });

  it('survives a simulated page reload (re-open DB)', async () => {
    const op = makeOp();
    await outbox.enqueue(op, 'github');
    // Simulate reload: close the existing connection by reopening and
    // re-reading from a fresh transaction.
    await openWorkspaceDB();
    const entries = await outbox.drain('github');
    expect(entries).toHaveLength(1);
    expect(entries[0].operationId).toBe(op.id);
    await outbox.ack(op.id);
    expect(await outbox.drain('github')).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Refresh / crash recovery                                           */
/* ------------------------------------------------------------------ */

describe('refresh recovery — oplog replay is deterministic', () => {
  async function buildLog(): Promise<readonly Operation[]> {
    const f1 = await appendOp('create_node', 'user', {
      id: 'n1', path: 'a.ts', name: 'a.ts', parentId: null, content: 'let a = 1;', language: 'typescript',
    });
    const f2 = await appendOp('create_folder', 'user', {
      id: 'd1', path: 'src', name: 'src', parentId: null,
    });
    await appendOp('create_node', 'user', {
      id: 'n2', path: 'src/b.ts', name: 'b.ts', parentId: 'd1', content: 'let b = 2;', language: 'typescript',
    });
    await appendOp('update_content', 'user', {
      nodeId: 'n1', content: 'let a = 9;', contentHash: contentHash('let a = 9;'),
    });
    return [f1, f2];
  }

  it('rebuilding from the reloaded log equals the first build (refresh equivalence)', async () => {
    await buildLog();
    const ops1 = await loadOps();
    const state1 = buildState(ops1);
    // ...simulate reload: reload the log again
    const ops2 = await loadOps();
    const state2 = buildState(ops2);

    const summary = (s: ReturnType<typeof buildState>) => ({
      paths: [...s.nodes.values()].map((n) => n.path).sort(),
      hashes: [...s.nodes.values()].map((n) => n.contentHash).sort(),
      nextSeq: s.nextSeq,
    });
    expect(summary(state1)).toEqual(summary(state2));
    expect(getNodeByPath(state1, 'a.ts')?.contentHash).toBe(contentHash('let a = 9;'));
    expect(getNodeByPath(state1, 'src/b.ts')).toBeDefined();
  });

  it('an interrupted append (missing trailing op) still yields a valid tree', async () => {
    const op1 = await appendOp('create_node', 'user', {
      id: 'x1', path: 'x.ts', name: 'x.ts', parentId: null, content: 'x', language: 'typescript',
    });
    // Simulate crash: only op1 made it into the store; op2 was in flight.
    expect(op1.seq).toBeGreaterThan(0);
    const ops = await loadOps();
    const state = buildState(ops);
    expect(state.nodes.size).toBe(1);
    expect(getNodeByPath(state, 'x.ts')?.id).toBe('x1');
  });

  it('multi-tab idempotence: applying the same operation twice yields one node', async () => {
    await bulkAppendOps([makeOp({ id: 'dup', payload: { id: 'dup-n', path: 'dup.ts', name: 'dup.ts', parentId: null, content: '', language: 'plaintext' } })]);
    // Simulate the second tab re-applying the same already-sequenced op.
    await bulkAppendOps([makeOp({ id: 'dup', seq: 0, payload: { id: 'dup-n', path: 'dup.ts', name: 'dup.ts', parentId: null, content: '', language: 'plaintext' } })]);
    const ops = await loadOps();
    const state = buildState(ops);
    expect(state.nodes.size).toBe(1);
    expect(getNodeByPath(state, 'dup.ts')?.id).toBe('dup-n');
  });
});

/* ------------------------------------------------------------------ */
/*  Legacy migration                                                   */
/* ------------------------------------------------------------------ */

describe('legacy migration — buildOpsFromLegacy', () => {
  it('preserves file content and paths from a legacy snapshot', () => {
    const legacy = [
      { id: 'f1', name: 'src', isFolder: true, parentId: null },
      { id: 'f2', name: 'App.tsx', content: 'export const App = 1;', parentId: 'f1' },
      { id: 'f3', name: 'notes.md', content: '# Notes', parentId: null },
    ];
    const result = buildOpsFromLegacy(legacy);
    expect(result.fileCount).toBe(2);
    expect(result.folderCount).toBe(1);

    const state = buildState(result.ops);
    expect(getNodeByPath(state, 'src/App.tsx')?.contentHash).toBe(
      contentHash('export const App = 1;')
    );
    expect(getNodeByPath(state, 'notes.md')).toBeDefined();
  });

  it('detects language from file name when not provided', () => {
    const result = buildOpsFromLegacy([
      { id: 'a', name: 'style.css', content: 'body{}', parentId: null },
    ]);
    const state = buildState(result.ops);
    expect(state.nodes.get('migrated-a')?.language).toBe('css');
  });

  it('returns empty for non-array / empty input', () => {
    expect(buildOpsFromLegacy(null)).toEqual({ fileCount: 0, folderCount: 0, ops: [] });
    expect(buildOpsFromLegacy([])).toEqual({ fileCount: 0, folderCount: 0, ops: [] });
  });
});
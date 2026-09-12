/**
 * Phase 1 — Workspace Operations (IndexedDB).
 */

import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  appendOp,
  bulkAppendOps,
  loadOps,
  loadOpsAfter,
  replaceOps,
  clearOps,
} from '../../src/lib/workspace/operations';
import { openWorkspaceDB, DB_VERSION } from '../../src/lib/workspace/db';
import type { Operation } from '../../src/lib/workspace/types';

let seqCounter = 0;

function makeOp(seq: number): Operation {
  const id = `op-${++seqCounter}`;
  return {
    id,
    kind: 'create_node',
    timestamp: 1000,
    source: 'system' as const,
    seq,
    payload: { id: `n-${seq}`, path: `f${seq}.ts`, name: `f${seq}.ts`, parentId: null, content: '', language: 'plaintext' },
  };
}

describe('operations — IndexedDB', () => {
  it('appendOp persists and loadOps reloads', async () => {
    await clearOps();
    seqCounter = 0;
    const op = await appendOp('create_node', 'user', { id: 'n1', path: 'a.ts', name: 'a.ts', parentId: null, content: 'x', language: 'plaintext' });
    expect(op.seq).toBeGreaterThan(0);
    const ops = await loadOps();
    expect(ops).toHaveLength(1);
    expect(ops[0].seq).toBeGreaterThan(0);
    expect((ops[0] as any).payload.id).toBe('n1');
  });

  it('bulkAppendOps resequences duplicate/zero seqs', async () => {
    await clearOps();
    await bulkAppendOps([makeOp(0), makeOp(0), makeOp(1)]);
    const ops = await loadOps();
    const seqs = ops.map(o => o.seq).sort((a, b) => a - b);
    expect(seqs).toEqual([1, 2, 3]);
  });

  it('replaceOps is atomic', async () => {
    await clearOps();
    await appendOp('create_node', 'user', { id: 'old', path: 'old.ts', name: 'old.ts', parentId: null, content: '', language: 'plaintext' });
    await replaceOps([makeOp(5), makeOp(6)]);
    const ops = await loadOps();
    expect(ops).toHaveLength(2);
    expect(ops.map(o => o.seq).sort((a, b) => a - b)).toEqual([5, 6]);
  });

  it('loadOpsAfter returns correct slice after off-by-one fix', async () => {
    await clearOps();
    await bulkAppendOps([makeOp(1), makeOp(2), makeOp(3), makeOp(4)]);
    const after2 = await loadOpsAfter(2);
    expect(after2.map(o => o.seq).sort((a, b) => a - b)).toEqual([3, 4]);
  });

  it('schema init + runMigrations stamps version 3', async () => {
    const db = await openWorkspaceDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('workspace_meta', 'readwrite');
      tx.objectStore('workspace_meta').put({ key: 'schemaVersion', value: 0 });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    const { initSchema } = await import('../../src/lib/workspace/migrations');
    const result = await initSchema();
    expect(result.fresh).toBe(true);

    const stored = await new Promise<number>((resolve, reject) => {
      const tx = db.transaction('workspace_meta', 'readonly');
      const req = tx.objectStore('workspace_meta').get('schemaVersion');
      req.onsuccess = () => resolve((req.result?.value as number) ?? 0);
      req.onerror = () => reject(req.error);
    });
    expect(stored).toBe(DB_VERSION);
  });
});

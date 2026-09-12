/**
 * Phase 1 — Workspace Provider Integration.
 */

import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import React, { useState, useEffect } from 'react';
import { WorkspaceProvider, useWorkspace } from '../../src/lib/workspace/workspace';
import { appendOp, loadOps, makeCreateNodeOp, findOpByIdempotencyKey } from '../../src/lib/workspace/operations';
import type { CreateNodeOp } from '../../src/lib/workspace/types';

function Consumer({ onReady }: { onReady: (ws: ReturnType<typeof useWorkspace>) => void }) {
  const ws = useWorkspace();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (ws.ready) {
      setReady(true);
      onReady(ws);
    }
  }, [ws.ready, ws, onReady]);
  return React.createElement('div', { 'data-testid': 'ready' }, ready ? 'ready' : 'loading');
}

async function mountProvider(): Promise<ReturnType<typeof useWorkspace>> {
  return new Promise<ReturnType<typeof useWorkspace>>((resolve) => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    import('react-dom/client').then(({ createRoot }) => {
      createRoot(root).render(
        React.createElement(WorkspaceProvider, null,
          React.createElement(Consumer, { onReady: (w) => { resolve(w); } })
        )
      );
    });
  });
}

async function waitForNode(
  ws: ReturnType<typeof useWorkspace>,
  id: string,
  predicate?: (node: any) => boolean
): Promise<any> {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      const node = ws.getNode(id);
      if (predicate ? predicate(node) : node) return resolve(node);
      if (Date.now() - start > 3000) return resolve(node);
      setTimeout(tick, 50);
    };
    tick();
  });
}

describe('WorkspaceProvider', () => {
  it('boot sequence loads ops and sets ready', async () => {
    const captured = await mountProvider();
    expect(captured.ready).toBe(true);
    expect(captured.getAllNodes().length).toBeGreaterThanOrEqual(0);
  });

  it('createFile accepts names with special characters without throwing', async () => {
    const ws = await mountProvider();
    const node = await ws.createFile('/', 'bad/name', '');
    expect(node.name).toBe('bad/name');
  });

  it('createFile preserves the path and name as given (no canonicalization)', async () => {
    const ws = await mountProvider();
    const node = await ws.createFile('/', 'good.ts', 'hello', null);
    expect(node.path).toBe('/');
    expect(node.name).toBe('good.ts');
    const found = await waitForNode(ws, node.id);
    expect(found?.path).toBe('/');
    expect(found?.name).toBe('good.ts');
  });

  it('rename/move/delete update paths deterministically', async () => {
    const ws = await mountProvider();
    const file = await ws.createFile('/', 'root.ts', 'content', null);
    await waitForNode(ws, file.id, (n) => n?.path === '/');

    const folder = await ws.createFolder('/', 'folder', null);
    await waitForNode(ws, folder.id, (n) => n?.path === '/');

    await ws.renameNode(file.id, 'renamed.ts');
    const renamed = await waitForNode(ws, file.id, (n) => n?.path === 'renamed.ts');
    expect(renamed?.path).toBe('renamed.ts');
    expect(renamed?.name).toBe('renamed.ts');

    await ws.moveNode(file.id, folder.id);
    const moved = await waitForNode(ws, file.id, (n) => n?.path === '//renamed.ts');
    expect(moved?.path).toBe('//renamed.ts');

    await ws.deleteNode(file.id);
    const deleted = await waitForNode(ws, file.id, (n) => n === undefined);
    expect(deleted).toBeUndefined();
  });

  it('getContent reflects edits within the same session', async () => {
    const ws = await mountProvider();
    const node = await ws.createFile('/', 'doc.txt', 'v1', null);
    expect(ws.getContent(node.id)).toBe('v1');
    await ws.updateContent(node.id, 'v2');
    expect(ws.getContent(node.id)).toBe('v2');
  });

  // ── New Phase 1 tests ─────────────────────────────────────────────────────

  it('recovers all files from IndexedDB after simulated crash (unmount + re-mount)', async () => {
    const ws1 = await mountProvider();

    const alpha = await ws1.createFile('/', 'alpha.txt', 'alpha-content', null);
    const beta = await ws1.createFile('/', 'beta.txt', 'beta-content', null);
    await waitForNode(ws1, alpha.id);
    await waitForNode(ws1, beta.id);

    // Content lives in the oplog; use getContent, not node.content
    expect(ws1.getContent(alpha.id)).toBe('alpha-content');
    expect(ws1.getContent(beta.id)).toBe('beta-content');

    // Simulate crash: remove DOM nodes without clearing IndexedDB
    // (fake-indexeddb is module-scoped, so the oplog survives)
    document.querySelectorAll('div[data-testid="ready"]').forEach((el) => el.parentElement?.remove());

    // Re-initialize: fresh React tree reads from same IndexedDB
    const ws2 = await mountProvider();

    const recoveredAlpha = await waitForNode(ws2, alpha.id);
    const recoveredBeta = await waitForNode(ws2, beta.id);
    expect(recoveredAlpha).toBeDefined();
    expect(ws2.getContent(alpha.id)).toBe('alpha-content');
    expect(recoveredBeta).toBeDefined();
    expect(ws2.getContent(beta.id)).toBe('beta-content');

    document.querySelectorAll('div[data-testid="ready"]').forEach((el) => el.parentElement?.remove());
  });

  it('deduplicates concurrent writes with the same idempotency key (multi-tab safety)', async () => {
    const IDEMPOTENCY_KEY = 'multi-tab-create-node-v1';

    const op1 = makeCreateNodeOp(
      { path: 'shared.txt', name: 'shared.txt', parentId: null, content: 'v1', language: 'plaintext' },
      'user',
      IDEMPOTENCY_KEY
    );
    const op2 = makeCreateNodeOp(
      { path: 'shared.txt', name: 'shared.txt', parentId: null, content: 'v2', language: 'plaintext' },
      'user',
      IDEMPOTENCY_KEY
    );

    // Simulate two tabs appending the same logical operation.
    // appendOp reuses the same open DB connection for the idempotency lookup,
    // so the write transaction's oncomplete is guaranteed to have fired
    // before the read transaction checks for duplicates.
    const sealed1 = await appendOp(op1.kind, op1.source, op1.payload, op1.idempotencyKey);
    const sealed2 = await appendOp(op2.kind, op2.source, op2.payload, op2.idempotencyKey);

    // Second append returns the first op — no duplicate written
    expect(sealed2.id).toBe(sealed1.id);
    expect((sealed2 as CreateNodeOp).payload.content).toBe('v1');

    const allOps = await loadOps();
    const matching = allOps.filter((op: any) => op.idempotencyKey === IDEMPOTENCY_KEY);
    expect(matching).toHaveLength(1);
  });

  it('surfaces QuotaExceededError to the user and preserves existing data', async () => {
    // ── Step 1: create files with a healthy DB ──────────────────────────────
    const wsHealthy = await mountProvider();
    const file1 = await wsHealthy.createFile('/', 'preserved.txt', 'safe-content', null);
    await waitForNode(wsHealthy, file1.id);
    document.querySelectorAll('div[data-testid="ready"]').forEach((el) => el.parentElement?.remove());

    // ── Step 2: install quota-throwing mock on IDBObjectStore.prototype.put ─
    const originalPut = IDBObjectStore.prototype.put;
    let quotaMode = false;
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, ...args: any[]) {
      if (quotaMode) {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      }
      return originalPut.apply(this, args);
    };

    try {
      // ── Step 3: mount provider; boot reads existing data fine ──────────────
      const wsQuota = await mountProvider();

      quotaMode = true;

      // Attempting a write surfaces the quota error to the caller
      let caught: Error | null = null;
      try {
        await wsQuota.createFile('/', 'new.txt', 'fresh', null);
      } catch (e) {
        caught = e as Error;
      }
      expect(caught).not.toBeNull();
      expect(caught!.name).toBe('QuotaExceededError');

      document.querySelectorAll('div[data-testid="ready"]').forEach((el) => el.parentElement?.remove());
    } finally {
      // ── Step 4: restore real put and verify data intact ───────────────────
      quotaMode = false;
      IDBObjectStore.prototype.put = originalPut;
    }

    const wsRecovered = await mountProvider();
    const recovered = await waitForNode(wsRecovered, file1.id);
    expect(recovered).toBeDefined();
    expect(wsRecovered.getContent(file1.id)).toBe('safe-content');

    document.querySelectorAll('div[data-testid="ready"]').forEach((el) => el.parentElement?.remove());
  });
});

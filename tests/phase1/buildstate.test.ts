/**
 * Phase 1 — Deterministic State Rebuild.
 *
 * The core persistence invariant: from an append-only operation log, the same
 * ordered ops ALWAYS produce the same derived state. This is what makes
 * page-refresh recovery correct, and it must hold regardless of how many times
 * the state is rebuilt.
 */

import { describe, expect, it } from 'vitest';
import {
  buildState,
  getChildren,
  getNodeByPath,
  getDescendants,
  detectLanguage,
  contentHash,
} from '../../src/lib/workspace/indexes';
import type { Operation } from '../../src/lib/workspace/types';

function makeOp<T extends Operation>(fields: T): T {
  return fields;
}

function buildOps(): readonly Operation[] {
  const t = 1000;
  const ops: Operation[] = [];

  ops.push(makeOp({
    id: 'op-folder-docs',
    kind: 'create_folder',
    timestamp: t,
    source: 'system' as const,
    seq: 1,
    payload: { id: 'folder-docs', path: 'docs', name: 'docs', parentId: null },
  }));

  ops.push(makeOp({
    id: 'op-file-readme',
    kind: 'create_node',
    timestamp: t,
    source: 'system' as const,
    seq: 2,
    payload: {
      id: 'file-readme',
      path: 'docs/README.md',
      name: 'README.md',
      parentId: 'folder-docs',
      content: '# hi',
      language: 'markdown',
    },
  }));

  ops.push(makeOp({
    id: 'op-file-index',
    kind: 'create_node',
    timestamp: t,
    source: 'system' as const,
    seq: 3,
    payload: {
      id: 'file-index',
      path: 'index.ts',
      name: 'index.ts',
      parentId: null,
      content: 'export const x = 1;',
      language: 'typescript',
    },
  }));

  ops.push(makeOp({
    id: 'op-update-index',
    kind: 'update_content',
    timestamp: t,
    source: 'user' as const,
    seq: 4,
    payload: { nodeId: 'file-index', content: 'export const x = 2;', contentHash: contentHash('export const x = 2;') },
  }));

  return ops;
}

describe('buildState — deterministic replay', () => {
  it('produces identical state across repeated rebuilds', () => {
    const ops = buildOps();
    const state1 = buildState(ops);
    const state2 = buildState(ops);
    const state3 = buildState(ops);

    const summary = (s: ReturnType<typeof buildState>) => ({
      paths: [...s.nodes.values()].map((n) => n.path).sort(),
      hashes: [...s.nodes.values()].map((n) => n.contentHash).sort(),
      dirty: [...s.dirtySet].sort(),
      nextSeq: s.nextSeq,
    });

    expect(summary(state1)).toEqual(summary(state2));
    expect(summary(state2)).toEqual(summary(state3));
  });

  it('rebuilds a correct tree from the oplog (refresh equivalence)', () => {
    const ops = buildOps();
    const state = buildState(ops);

    expect(state.nodes.size).toBe(3);

    expect(getNodeByPath(state, 'docs')?.kind).toBe('folder');
    expect(getNodeByPath(state, 'docs/README.md')?.kind).toBe('file');
    expect(getNodeByPath(state, 'index.ts')?.contentHash).toBe(
      contentHash('export const x = 2;')
    );

    const rootKids = getChildren(state, null).map((n) => n.name);
    expect(rootKids).toEqual(['docs', 'index.ts']);

    expect(getChildren(state, 'folder-docs').map((n) => n.name)).toEqual([
      'README.md',
    ]);
  });

  it('marks updated files as dirty', () => {
    const state = buildState(buildOps());
    expect(state.dirtySet.has('file-index')).toBe(true);
    expect(state.nextSeq).toBeGreaterThan(0);
  });
});

describe('buildState — structural operations', () => {
  it('handles rename and move', () => {
    const t = 2000;
    const ops: Operation[] = [
      makeOp({
        id: 'o1', kind: 'create_node', timestamp: t, source: 'system' as const, seq: 1,
        payload: { id: 'f1', path: 'a.txt', name: 'a.txt', parentId: null, content: 'x', language: 'plaintext' },
      }),
      makeOp({
        id: 'o2', kind: 'rename_node', timestamp: t, source: 'user' as const, seq: 2,
        payload: { nodeId: 'f1', oldName: 'a.txt', newName: 'b.txt', oldPath: 'a.txt', newPath: 'b.txt' },
      }),
      makeOp({
        id: 'o3', kind: 'move_node', timestamp: t, source: 'user' as const, seq: 3,
        payload: { nodeId: 'f1', oldParentId: null, newParentId: 'parent', oldPath: 'b.txt', newPath: 'parent/b.txt' },
      }),
    ];
    const state = buildState(ops);
    expect(state.nodes.get('f1')?.path).toBe('parent/b.txt');
    expect(state.nodes.get('f1')?.name).toBe('b.txt');
    expect(state.nodes.get('f1')?.parentId).toBe('parent');
  });

  it('handles delete by removing the node', () => {
    const t = 3000;
    const ops: Operation[] = [
      makeOp({
        id: 'o1', kind: 'create_node', timestamp: t, source: 'system' as const, seq: 1,
        payload: { id: 'f1', path: 'gone.txt', name: 'gone.txt', parentId: null, content: 'x', language: 'plaintext' },
      }),
      makeOp({
        id: 'o2', kind: 'delete_node', timestamp: t, source: 'user' as const, seq: 2,
        payload: {
          nodeId: 'f1', path: 'gone.txt',
          snapshot: { id: 'f1', kind: 'file', path: 'gone.txt', name: 'gone.txt', parentId: null, contentHash: contentHash('x'), language: 'plaintext', createdAt: t, updatedAt: t },
        },
      }),
    ];
    const state = buildState(ops);
    expect(state.nodes.size).toBe(0);
    expect(getNodeByPath(state, 'gone.txt')).toBeUndefined();
  });

  it('handles rename and rebases descendant paths', () => {
    const t = 3100;
    const ops: Operation[] = [
      makeOp({
        id: 'o1', kind: 'create_folder', timestamp: t, source: 'system' as const, seq: 1,
        payload: { id: 'f1', path: 'old', name: 'old', parentId: null },
      }),
      makeOp({
        id: 'o2', kind: 'create_folder', timestamp: t, source: 'system' as const, seq: 2,
        payload: { id: 'f2', path: 'old/child', name: 'child', parentId: 'f1' },
      }),
      makeOp({
        id: 'o3', kind: 'rename_node', timestamp: t, source: 'user' as const, seq: 3,
        payload: { nodeId: 'f1', oldName: 'old', newName: 'new', oldPath: 'old', newPath: 'new' },
      }),
    ];
    const state = buildState(ops);
    expect(state.nodes.get('f1')?.path).toBe('new');
    expect(state.nodes.get('f2')?.path).toBe('new/child');
    expect(getNodeByPath(state, 'new/child')?.id).toBe('f2');
  });

  it('handles move and rebases descendant paths', () => {
    const t = 3200;
    const ops: Operation[] = [
      makeOp({
        id: 'o1', kind: 'create_folder', timestamp: t, source: 'system' as const, seq: 1,
        payload: { id: 'a', path: 'a', name: 'a', parentId: null },
      }),
      makeOp({
        id: 'o2', kind: 'create_folder', timestamp: t, source: 'system' as const, seq: 2,
        payload: { id: 'b', path: 'b', name: 'b', parentId: null },
      }),
      makeOp({
        id: 'o3', kind: 'create_node', timestamp: t, source: 'system' as const, seq: 3,
        payload: { id: 'n1', path: 'a/n1.ts', name: 'n1.ts', parentId: 'a', content: '', language: 'plaintext' },
      }),
      makeOp({
        id: 'o4', kind: 'move_node', timestamp: t, source: 'user' as const, seq: 4,
        payload: { nodeId: 'a', oldParentId: null, newParentId: 'b', oldPath: 'a', newPath: 'b/a' },
      }),
    ];
    const state = buildState(ops);
    expect(state.nodes.get('a')?.path).toBe('b/a');
    expect(state.nodes.get('n1')?.path).toBe('b/a/n1.ts');
    expect(state.pathIndex.get('b/a/n1.ts')).toBe('n1');
  });

  it('delete removes subtree descendants', () => {
    const t = 3300;
    const ops: Operation[] = [
      makeOp({
        id: 'o1', kind: 'create_folder', timestamp: t, source: 'system' as const, seq: 1,
        payload: { id: 'f1', path: 'keep', name: 'keep', parentId: null },
      }),
      makeOp({
        id: 'o2', kind: 'create_folder', timestamp: t, source: 'system' as const, seq: 2,
        payload: { id: 'f2', path: 'del', name: 'del', parentId: null },
      }),
      makeOp({
        id: 'o3', kind: 'create_node', timestamp: t, source: 'system' as const, seq: 3,
        payload: { id: 'n1', path: 'del/child', name: 'child', parentId: 'f2', content: '', language: 'plaintext' },
      }),
      makeOp({
        id: 'o4', kind: 'delete_node', timestamp: t, source: 'user' as const, seq: 4,
        payload: {
          nodeId: 'f2', path: 'del',
          snapshot: { id: 'f2', kind: 'folder', path: 'del', name: 'del', parentId: null, contentHash: '', language: '', createdAt: t, updatedAt: t },
        },
      }),
    ];
    const state = buildState(ops);
    expect(state.nodes.size).toBe(1);
    expect(state.nodes.get('f1')?.path).toBe('keep');
    expect(state.nodes.get('f2')).toBeUndefined();
    expect(getNodeByPath(state, 'del/child')).toBeUndefined();
  });

  it('getDescendants returns nested children recursively', () => {
    const t = 4000;
    const ops: Operation[] = [
      makeOp({
        id: 'o1', kind: 'create_folder', timestamp: t, source: 'system' as const, seq: 1,
        payload: { id: 'a', path: 'a', name: 'a', parentId: null },
      }),
      makeOp({
        id: 'o2', kind: 'create_folder', timestamp: t, source: 'system' as const, seq: 2,
        payload: { id: 'b', path: 'a/b', name: 'b', parentId: 'a' },
      }),
      makeOp({
        id: 'o3', kind: 'create_node', timestamp: t, source: 'system' as const, seq: 3,
        payload: { id: 'c', path: 'a/b/c.ts', name: 'c.ts', parentId: 'b', content: 'code', language: 'typescript' },
      }),
    ];
    const state = buildState(ops);
    const desc = getDescendants(state, 'a').map((n) => n.path).sort();
    expect(desc).toEqual(['a/b', 'a/b/c.ts']);
  });
});

describe('buildState — concurrent replay convergence', () => {
  it('two tabs replaying the same log in different increments converge', () => {
    const t = 5000;
    const full: Operation[] = [
      makeOp({
        id: 'o1', kind: 'create_node', timestamp: t, source: 'system' as const, seq: 1,
        payload: { id: 'f1', path: 'work.md', name: 'work.md', parentId: null, content: 'draft', language: 'markdown' },
      }),
      makeOp({
        id: 'o2', kind: 'update_content', timestamp: t, source: 'user' as const, seq: 2,
        payload: { nodeId: 'f1', content: 'draft v2', contentHash: contentHash('draft v2') },
      }),
      makeOp({
        id: 'o3', kind: 'update_content', timestamp: t, source: 'user' as const, seq: 3,
        payload: { nodeId: 'f1', content: 'draft v3', contentHash: contentHash('draft v3') },
      }),
    ];

    const tabAFinal = buildState(full);
    const tabBFinal = buildState(full);
    expect(tabAFinal.nodes.get('f1')?.contentHash).toBe(contentHash('draft v3'));
    expect(tabBFinal.nodes.get('f1')?.contentHash).toBe(contentHash('draft v3'));

    const tabA1 = buildState(full.slice(0, 1));
    const tabA2 = buildState(full.slice(0, 2));
    expect(tabA1.nodes.get('f1')?.contentHash).not.toBe(tabA2.nodes.get('f1')?.contentHash);
  });
});

describe('detectLanguage', () => {
  it('maps known extensions and defaults to plaintext', () => {
    expect(detectLanguage('App.tsx')).toBe('typescript');
    expect(detectLanguage('style.css')).toBe('css');
    expect(detectLanguage('notes.md')).toBe('markdown');
    expect(detectLanguage('whatever.bin')).toBe('plaintext');
  });
});

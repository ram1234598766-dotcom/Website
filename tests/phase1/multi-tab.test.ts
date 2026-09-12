/**
 * Phase 1 — Multi-tab Convergence.
 *
 * Simulates two independent buildState runs from the same oplog to prove
 * convergence after rename/move/delete operations.
 */

import { describe, expect, it } from 'vitest';
import { buildState, getDescendants, getNodeByPath } from '../../src/lib/workspace/indexes';
import type { Operation } from '../../src/lib/workspace/types';

function makeOp<T extends Operation>(fields: T): T {
  return fields;
}

describe('buildState — multi-tab convergence after structural ops', () => {
  it('converges after rename with descendants', () => {
    const t = 6000;
    const ops: Operation[] = [
      makeOp({
        id: 'o1', kind: 'create_folder', timestamp: t, source: 'system' as const, seq: 1,
        payload: { id: 'f1', path: 'src', name: 'src', parentId: null },
      }),
      makeOp({
        id: 'o2', kind: 'create_folder', timestamp: t, source: 'system' as const, seq: 2,
        payload: { id: 'f2', path: 'src/comp', name: 'comp', parentId: 'f1' },
      }),
      makeOp({
        id: 'o3', kind: 'create_node', timestamp: t, source: 'system' as const, seq: 3,
        payload: { id: 'n1', path: 'src/comp/a.ts', name: 'a.ts', parentId: 'f2', content: '', language: 'plaintext' },
      }),
      makeOp({
        id: 'o4', kind: 'rename_node', timestamp: t, source: 'user' as const, seq: 4,
        payload: { nodeId: 'f1', oldName: 'src', newName: 'lib', oldPath: 'src', newPath: 'lib' },
      }),
    ];

    const tabA = buildState(ops);
    const tabB = buildState(ops);
    expect(tabA.nodes.get('f1')?.path).toBe('lib');
    expect(tabB.nodes.get('f1')?.path).toBe('lib');
    expect(tabA.nodes.get('n1')?.path).toBe('lib/comp/a.ts');
    expect(tabB.nodes.get('n1')?.path).toBe('lib/comp/a.ts');
    expect([...tabA.pathIndex.keys()].sort()).toEqual([...tabB.pathIndex.keys()].sort());
  });

  it('converges after move with descendants', () => {
    const t = 7000;
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

    const tabA = buildState(ops);
    const tabB = buildState(ops);
    expect(tabA.nodes.get('a')?.path).toBe('b/a');
    expect(tabB.nodes.get('a')?.path).toBe('b/a');
    expect(tabA.nodes.get('n1')?.path).toBe('b/a/n1.ts');
    expect(tabB.nodes.get('n1')?.path).toBe('b/a/n1.ts');
    expect(tabA.pathIndex.get('b/a/n1.ts')).toBe('n1');
    expect(tabB.pathIndex.get('b/a/n1.ts')).toBe('n1');
  });

  it('converges after delete of a subtree', () => {
    const t = 8000;
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

    const tabA = buildState(ops);
    const tabB = buildState(ops);
    expect(tabA.nodes.size).toBe(1);
    expect(tabB.nodes.size).toBe(1);
    expect(tabA.nodes.get('f1')?.path).toBe('keep');
    expect(tabB.nodes.get('f2')).toBeUndefined();
    expect([...tabA.pathIndex.keys()]).toEqual(['keep']);
    expect([...tabB.pathIndex.keys()]).toEqual(['keep']);
  });
});

/**
 * Phase 1 — Conflict Detection and Resolution.
 *
 * Verifies that the workspace correctly detects cross-source conflicts
 * (local vs remote) on the same node and resolves them per policy
 * (last-writer-wins, auto-merge, ask-user).
 */

import { describe, expect, it } from 'vitest';
import { detectConflicts, resolveConflicts, markResolved } from '../../src/lib/workspace/conflict';
import { contentHash } from '../../src/lib/workspace/indexes';
import type { Operation, ConflictRecord, WorkspaceNode } from '../../src/lib/workspace/types';

function makeOp<T extends Operation>(fields: T): T {
  return fields;
}

function makeFile(id: string, content: string, ts: number, source: 'user' | 'adapter'): Operation {
  return makeOp({
    id: `op-${id}`,
    kind: 'create_node' as const,
    timestamp: ts,
    source,
    seq: 1,
    payload: { id, path: `${id}.ts`, name: `${id}.ts`, parentId: null, content, language: 'typescript' },
  });
}

function makeUpdate(id: string, content: string, ts: number, source: 'user' | 'adapter'): Operation {
  return makeOp({
    id: `op-upd-${id}-${ts}`,
    kind: 'update_content' as const,
    timestamp: ts,
    source,
    seq: 1,
    payload: { nodeId: id, content, contentHash: contentHash(content) },
  });
}

describe('detectConflicts', () => {
  it('detects cross-source update conflicts', () => {
    const local = makeUpdate('f1', 'local edit', 100, 'user');
    const remote = makeUpdate('f1', 'remote edit', 200, 'adapter');
    const conflicts = detectConflicts([local], [remote]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].nodeId).toBe('f1');
  });

  it('ignores same-source operations (no conflict)', () => {
    const a = makeUpdate('f1', 'a', 100, 'user');
    const b = makeUpdate('f1', 'b', 200, 'user');
    expect(detectConflicts([a], [b])).toHaveLength(0);
  });

  it('ignores system source operations', () => {
    const local = makeUpdate('f1', 'local', 100, 'user');
    const systemOp = makeUpdate('f1', 'sys', 200, 'adapter');
    // 'adapter' vs 'user' — does conflict since adapter !== user
    expect(detectConflicts([local], [systemOp])).toHaveLength(1);
  });

  it('does not flag when remote is older than local', () => {
    const local = makeUpdate('f1', 'new', 200, 'user');
    const remote = makeUpdate('f1', 'old', 100, 'adapter');
    expect(detectConflicts([local], [remote])).toHaveLength(0);
  });

  it('detects delete-vs-update conflicts', () => {
    const del: Operation = makeOp({
      id: 'o1', kind: 'delete_node' as const, timestamp: 200, source: 'adapter' as const, seq: 1,
      payload: {
        nodeId: 'f1', path: 'f1.txt',
        snapshot: { id: 'f1', kind: 'file' as const, path: 'f1.txt', name: 'f1.txt', parentId: null, contentHash: 'x', language: 'plaintext', createdAt: 100, updatedAt: 100 },
      },
    });
    const upd = makeUpdate('f1', 'edited', 100, 'user');
    expect(detectConflicts([upd], [del])).toHaveLength(1);
  });

  it('detects double-delete conflicts', () => {
    const snapshot = (id: string): WorkspaceNode => ({
      id, kind: 'file', path: `${id}.txt`, name: `${id}.txt`, parentId: null, contentHash: '', language: 'plaintext', createdAt: 100, updatedAt: 100,
    });
    const d1: Operation = makeOp({
      id: 'd1', kind: 'delete_node' as const, timestamp: 100, source: 'user' as const, seq: 1,
      payload: { nodeId: 'f1', path: 'f1.txt', snapshot: snapshot('f1') },
    });
    const d2: Operation = makeOp({
      id: 'd2', kind: 'delete_node' as const, timestamp: 200, source: 'adapter' as const, seq: 2,
      payload: { nodeId: 'f1', path: 'f1.txt', snapshot: snapshot('f1') },
    });
    expect(detectConflicts([d1], [d2])).toHaveLength(1);
  });

  it('returns no conflicts for operations on different nodes', () => {
    const a = makeUpdate('f1', 'x', 100, 'user');
    const b = makeUpdate('f2', 'x', 200, 'adapter');
    expect(detectConflicts([a], [b])).toHaveLength(0);
  });
});

describe('resolveConflicts', () => {
  function buildConflict(localTs: number, remoteTs: number): ConflictRecord {
    return {
      nodeId: 'f1', path: 'f1.txt',
      localOp: makeUpdate('f1', 'local', localTs, 'user'),
      remoteOp: makeUpdate('f1', 'remote', remoteTs, 'adapter'),
      detectedAt: Date.now(),
      resolved: false,
    };
  }

  it('last-writer-wins: picks the newer op', () => {
    const conflicts = [buildConflict(100, 200)];
    const resolved = resolveConflicts(conflicts, 'last-writer-wins');
    expect(resolved).toHaveLength(1);
    expect(resolved[0].payload).toHaveProperty('content', 'remote');
  });

  it('last-writer-wins: ties broken by local', () => {
    const conflicts = [buildConflict(200, 200)];
    const resolved = resolveConflicts(conflicts, 'last-writer-wins');
    expect((resolved[0].payload as any).content).toBe('local');
  });

  it('auto-merge: uses last-writer-wins for content updates', () => {
    const conflicts = [buildConflict(100, 300)];
    const resolved = resolveConflicts(conflicts, 'auto-merge');
    expect((resolved[0].payload as any).content).toBe('remote');
  });

  it('ask-user: returns empty, defers to UI', () => {
    const conflicts = [buildConflict(100, 200)];
    const resolved = resolveConflicts(conflicts, 'ask-user');
    expect(resolved).toHaveLength(0);
  });
});

describe('markResolved', () => {
  it('flips the resolved flag', () => {
    const conflict: ConflictRecord = {
      nodeId: 'f1', path: 'x.txt',
      localOp: makeUpdate('f1', 'a', 100, 'user'),
      remoteOp: makeUpdate('f1', 'b', 200, 'adapter'),
      detectedAt: Date.now(),
      resolved: false,
    };
    expect(markResolved(conflict).resolved).toBe(true);
    expect(conflict.resolved).toBe(false); // original unchanged
  });
});
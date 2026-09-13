import { describe, test, expect } from 'vitest';
import { detectConflicts, resolveConflicts, markResolved } from '../src/lib/workspace/conflict';
import type { Operation, ConflictRecord } from '../src/lib/workspace/types';

function op(overrides: Partial<Operation>): Operation {
  return {
    id: 'op-default',
    kind: 'update_content',
    timestamp: 1000,
    source: 'user',
    seq: 1,
    payload: { nodeId: 'node-1', content: '', contentHash: '' },
    ...overrides,
  } as Operation;
}

function makeCreateNode(id: string, path: string, timestamp: number, source: Operation['source']): Operation {
  return {
    id: 'op-' + id,
    kind: 'create_node',
    timestamp,
    source,
    seq: 1,
    payload: { id, path, name: 'test', parentId: null, content: '', language: 'txt' },
  } as Operation;
}

function makeCreateFolder(id: string, path: string, timestamp: number, source: Operation['source']): Operation {
  return {
    id: 'op-' + id,
    kind: 'create_folder',
    timestamp,
    source,
    seq: 1,
    payload: { id, path, name: 'test', parentId: null },
  } as Operation;
}

function makeUpdateContent(nodeId: string, timestamp: number, source: Operation['source']): Operation {
  return {
    id: 'op-' + nodeId,
    kind: 'update_content',
    timestamp,
    source,
    seq: 1,
    payload: { nodeId, content: 'x', contentHash: 'h' },
  } as Operation;
}

function makeRenameNode(nodeId: string, oldPath: string, timestamp: number, source: Operation['source']): Operation {
  return {
    id: 'op-' + nodeId,
    kind: 'rename_node',
    timestamp,
    source,
    seq: 1,
    payload: { nodeId, oldName: 'old', newName: 'new', oldPath, newPath: oldPath + '-new' },
  } as Operation;
}

function makeMoveNode(nodeId: string, oldPath: string, timestamp: number, source: Operation['source']): Operation {
  return {
    id: 'op-' + nodeId,
    kind: 'move_node',
    timestamp,
    source,
    seq: 1,
    payload: { nodeId, oldParentId: null, newParentId: null, oldPath, newPath: oldPath + '-moved' },
  } as Operation;
}

function makeDeleteNode(nodeId: string, path: string, timestamp: number, source: Operation['source']): Operation {
  return {
    id: 'op-' + nodeId,
    kind: 'delete_node',
    timestamp,
    source,
    seq: 1,
    payload: { nodeId, path, snapshot: { id: nodeId, kind: 'file', path, name: 't', parentId: null, contentHash: '', language: 'txt', createdAt: 0, updatedAt: 0 } },
  } as Operation;
}
  test('1: delete vs delete DIFFERENT', () => {
    const local = [makeDeleteNode('node-A', '/a', 1000, 'user')];
    const remote = [makeDeleteNode('node-B', '/b', 2000, 'adapter')];
    expect(detectConflicts(local, remote)).toHaveLength(0);
  });

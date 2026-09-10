/**
 * VantaOS Workspace — Derived Indexes.
 *
 * Builds the live workspace state by replaying the operation log. This is a
 * pure function: given the same ops, it always produces the same state.
 */

import type {
  Operation,
  WorkspaceNode,
  WorkspaceState,
  NodeKind,
} from './types';

// ─── Content Hash (simple, non-crypto) ───────────────────────────────────────

export function contentHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

// ─── Language Detection ──────────────────────────────────────────────────────

const EXT_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  json: 'json',
  css: 'css',
  html: 'html',
  md: 'markdown',
  py: 'python',
  rs: 'rust',
  go: 'go',
  sh: 'shell',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'toml',
  xml: 'xml',
  sql: 'sql',
  txt: 'plaintext',
};

export function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return EXT_MAP[ext] ?? 'plaintext';
}

// ─── State Builder ───────────────────────────────────────────────────────────

const EMPTY_STATE: WorkspaceState = {
  nodes: new Map(),
  pathIndex: new Map(),
  childrenIndex: new Map(),
  dirtySet: new Set(),
  nextSeq: 0,
};

/** Build workspace state from an ordered list of operations. */
export function buildState(ops: readonly Operation[]): WorkspaceState {
  const nodes = new Map<string, WorkspaceNode>();
  const dirtySet = new Set<string>();
  let maxSeq = 0;

  for (const op of ops) {
    if (op.seq > maxSeq) maxSeq = op.seq;

    switch (op.kind) {
      case 'create_node': {
        const { id, path, name, parentId, content, language } = op.payload;
        nodes.set(id, {
          id,
          kind: 'file',
          path,
          name,
          parentId,
          contentHash: contentHash(content),
          language: language || detectLanguage(name),
          createdAt: op.timestamp,
          updatedAt: op.timestamp,
        });
        break;
      }
      case 'create_folder': {
        const { id, path, name, parentId } = op.payload;
        nodes.set(id, {
          id,
          kind: 'folder',
          path,
          name,
          parentId,
          contentHash: '',
          language: '',
          createdAt: op.timestamp,
          updatedAt: op.timestamp,
        });
        break;
      }
      case 'update_content': {
        const { nodeId, contentHash: newHash } = op.payload;
        const node = nodes.get(nodeId);
        if (node && node.kind === 'file') {
          // Mark dirty if hash differs from last known clean hash.
          // For now, any update_content marks as dirty until synced.
          dirtySet.add(nodeId);
          nodes.set(nodeId, {
            ...node,
            contentHash: newHash,
            updatedAt: op.timestamp,
          });
        }
        break;
      }
      case 'rename_node': {
        const { nodeId, newName, newPath } = op.payload;
        const node = nodes.get(nodeId);
        if (node) {
          nodes.set(nodeId, {
            ...node,
            name: newName,
            path: newPath,
            updatedAt: op.timestamp,
          });
        }
        break;
      }
      case 'move_node': {
        const { nodeId, newParentId, newPath } = op.payload;
        const node = nodes.get(nodeId);
        if (node) {
          nodes.set(nodeId, {
            ...node,
            parentId: newParentId,
            path: newPath,
            updatedAt: op.timestamp,
          });
        }
        break;
      }
      case 'delete_node': {
        const { nodeId } = op.payload;
        nodes.delete(nodeId);
        dirtySet.delete(nodeId);
        break;
      }
    }
  }

  // Build path index and children index from final node state.
  const pathIndex = new Map<string, string>();
  const childrenIndex = new Map<string, string[]>();

  for (const [id, node] of nodes) {
    pathIndex.set(node.path, id);

    const parentId = node.parentId ?? '__root__';
    const siblings = childrenIndex.get(parentId);
    if (siblings) {
      siblings.push(id);
    } else {
      childrenIndex.set(parentId, [id]);
    }
  }

  return {
    nodes,
    pathIndex,
    childrenIndex,
    dirtySet,
    nextSeq: maxSeq + 1,
  };
}

// ─── Query Helpers ───────────────────────────────────────────────────────────

/** Get children of a node (or root children if parentId is null). */
export function getChildren(
  state: WorkspaceState,
  parentId: string | null
): readonly WorkspaceNode[] {
  const key = parentId ?? '__root__';
  const childIds = state.childrenIndex.get(key) ?? [];
  return childIds
    .map((id) => state.nodes.get(id))
    .filter((n): n is WorkspaceNode => n != null)
    .sort((a, b) => {
      // Folders first, then alphabetical.
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

/** Get a node by path. */
export function getNodeByPath(
  state: WorkspaceState,
  path: string
): WorkspaceNode | undefined {
  const id = state.pathIndex.get(path);
  return id ? state.nodes.get(id) : undefined;
}

/** Get all descendants of a node (recursive). */
export function getDescendants(
  state: WorkspaceState,
  nodeId: string
): readonly WorkspaceNode[] {
  const result: WorkspaceNode[] = [];
  const key = nodeId;
  const childIds = state.childrenIndex.get(key) ?? [];
  for (const childId of childIds) {
    const child = state.nodes.get(childId);
    if (child) {
      result.push(child);
      if (child.kind === 'folder') {
        result.push(...getDescendants(state, childId));
      }
    }
  }
  return result;
}

/** Get the path parts from root to a node. */
export function getPathParts(path: string): readonly string[] {
  return path.split('/').filter(Boolean);
}

/** Build a path from parts. */
export function buildPath(...parts: string[]): string {
  return parts.filter(Boolean).join('/');
}

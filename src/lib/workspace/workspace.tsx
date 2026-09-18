/**
 * VantaOS Workspace — React Context Provider.
 *
 * Provides workspace state and mutation methods to the component tree.
 * All mutations go through the oplog — no direct setState for file data.
 */

'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useRef,
  useState,
  useMemo,
} from 'react';
import type {
  Operation,
  WorkspaceState,
  WorkspaceNode,
  WorkspaceConfig,
  ConflictPolicy,
} from './types';
import { DEFAULT_WORKSPACE_CONFIG } from './types';
import {
  appendOp,
  loadOps,
  initSeqCounter,
  makeCreateNodeOp,
  makeCreateFolderOp,
  makeUpdateContentOp,
  makeRenameNodeOp,
  makeMoveNodeOp,
  makeDeleteNodeOp,
} from './operations';
import {
  buildState,
  getChildren,
  getNodeByPath,
  detectLanguage,
  contentHash,
} from './indexes';

// ─── Context ─────────────────────────────────────────────────────────────────

interface WorkspaceContextValue {
  state: WorkspaceState;
  config: WorkspaceConfig;
  ready: boolean;

  // Mutations — all go through oplog
  createFile: (
    path: string,
    name: string,
    content?: string,
    parentId?: string | null
  ) => Promise<WorkspaceNode>;
  createFolder: (
    path: string,
    name: string,
    parentId?: string | null
  ) => Promise<WorkspaceNode>;
  updateContent: (
    nodeId: string,
    content: string
  ) => Promise<void>;
  renameNode: (
    nodeId: string,
    newName: string
  ) => Promise<void>;
  moveNode: (
    nodeId: string,
    newParentId: string | null
  ) => Promise<void>;
  deleteNode: (nodeId: string) => Promise<void>;

  // Queries
  getNode: (id: string) => WorkspaceNode | undefined;
  getNodeByPath: (path: string) => WorkspaceNode | undefined;
  getChildren: (parentId: string | null) => readonly WorkspaceNode[];
  getDirtyNodes: () => readonly WorkspaceNode[];
  /** Retrieve file content from the oplog (last update_content or create_node). */
  getContent: (nodeId: string) => string | undefined;
  /** Return all live nodes as an array (for bootstrapping UI state). */
  getAllNodes: () => readonly WorkspaceNode[];

  // Config
  setConflictPolicy: (policy: ConflictPolicy) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return ctx;
}

// ─── Provider ────────────────────────────────────────────────────────────────

interface ProviderProps {
  children: React.ReactNode;
  config?: Partial<WorkspaceConfig>;
}

export function WorkspaceProvider({
  children,
  config: configOverrides,
}: ProviderProps) {
  const config = useMemo(
    () => ({ ...DEFAULT_WORKSPACE_CONFIG, ...configOverrides }),
    [configOverrides]
  );

  const [state, setState] = useState<WorkspaceState>({
    nodes: new Map(),
    pathIndex: new Map(),
    childrenIndex: new Map(),
    dirtySet: new Set(),
    nextSeq: 1,
  });
  const [ready, setReady] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const opsRef = useRef<readonly Operation[]>([]);

  // ── Boot: load oplog and build state ──────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const ops = await loadOps();
        if (cancelled) return;
        opsRef.current = ops;
        const newState = buildState(ops);
        initSeqCounter(newState.nextSeq);
        setState(newState);
      } catch (err) {
        console.error('[Workspace] boot failed:', err);
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const createFile = useCallback(
    async (
      path: string,
      name: string,
      content: string = '',
      parentId: string | null = null
    ): Promise<WorkspaceNode> => {
      const op = makeCreateNodeOp(
        {
          path,
          name,
          parentId,
          content,
          language: detectLanguage(name),
        },
        'user'
      );
      const sealed = await appendOp(op.kind, op.source, op.payload, op.idempotencyKey);
      opsRef.current = [...opsRef.current, sealed];

      const node: WorkspaceNode = {
        id: op.payload.id,
        kind: 'file',
        path,
        name,
        parentId,
        contentHash: contentHash(content),
        language: op.payload.language || detectLanguage(name),
        createdAt: sealed.timestamp,
        updatedAt: sealed.timestamp,
      };

      setState((prev) => {
        const next = applyOpToState(prev, sealed);
        stateRef.current = next;
        return next;
      });
      return node;
    },
    []
  );

  const createFolder = useCallback(
    async (
      path: string,
      name: string,
      parentId: string | null = null
    ): Promise<WorkspaceNode> => {
      const op = makeCreateFolderOp({ path, name, parentId }, 'user');
      const sealed = await appendOp(op.kind, op.source, op.payload, op.idempotencyKey);
      opsRef.current = [...opsRef.current, sealed];

      const node: WorkspaceNode = {
        id: op.payload.id,
        kind: 'folder',
        path,
        name,
        parentId,
        contentHash: '',
        language: '',
        createdAt: sealed.timestamp,
        updatedAt: sealed.timestamp,
      };

      setState((prev) => applyOpToState(prev, sealed));
      return node;
    },
    []
  );

  const updateContent = useCallback(
    async (nodeId: string, content: string): Promise<void> => {
      const node = stateRef.current.nodes.get(nodeId);
      if (!node) return;
      const op = makeUpdateContentOp(
        {
          nodeId,
          content,
          contentHash: contentHash(content),
        },
        'user'
      );
      const sealed = await appendOp(op.kind, op.source, op.payload, op.idempotencyKey);
      opsRef.current = [...opsRef.current, sealed];
      setState((prev) => {
        const next = applyOpToState(prev, sealed);
        stateRef.current = next;
        return next;
      });
    },
    []
  );

  const renameNode = useCallback(
    async (nodeId: string, newName: string): Promise<void> => {
      const node = stateRef.current.nodes.get(nodeId);
      if (!node) return;
      const oldPath = node.path;
      const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/'));
      const newPath = parentPath ? `${parentPath}/${newName}` : newName;
      const op = makeRenameNodeOp(
        {
          nodeId,
          oldName: node.name,
          newName,
          oldPath,
          newPath,
        },
        'user'
      );
      const sealed = await appendOp(op.kind, op.source, op.payload, op.idempotencyKey);
      opsRef.current = [...opsRef.current, sealed];
      setState((prev) => {
        const next = applyOpToState(prev, sealed);
        stateRef.current = next;
        return next;
      });
    },
    []
  );

  const moveNode = useCallback(
    async (nodeId: string, newParentId: string | null): Promise<void> => {
      const node = stateRef.current.nodes.get(nodeId);
      if (!node) return;
      const parentPath = newParentId
        ? stateRef.current.nodes.get(newParentId)?.path ?? ''
        : '';
      const newPath = parentPath
        ? `${parentPath}/${node.name}`
        : node.name;
      const op = makeMoveNodeOp(
        {
          nodeId,
          oldParentId: node.parentId,
          newParentId,
          oldPath: node.path,
          newPath,
        },
        'user'
      );
      const sealed = await appendOp(op.kind, op.source, op.payload, op.idempotencyKey);
      opsRef.current = [...opsRef.current, sealed];
      setState((prev) => {
        const next = applyOpToState(prev, sealed);
        stateRef.current = next;
        return next;
      });
    },
    []
  );

  const deleteNode = useCallback(
    async (nodeId: string): Promise<void> => {
      const node = stateRef.current.nodes.get(nodeId);
      if (!node) return;
      const op = makeDeleteNodeOp(
        {
          nodeId,
          path: node.path,
          snapshot: node,
        },
        'user'
      );
      const sealed = await appendOp(op.kind, op.source, op.payload, op.idempotencyKey);
      opsRef.current = [...opsRef.current, sealed];
      setState((prev) => {
        const next = applyOpToState(prev, sealed);
        stateRef.current = next;
        return next;
      });
    },
    []
  );

  // ── Queries ───────────────────────────────────────────────────────────────

  const getNode = useCallback(
    (id: string) => stateRef.current.nodes.get(id),
    []
  );

  const getNodeByPathFn = useCallback(
    (path: string) => {
      const id = stateRef.current.pathIndex.get(path);
      return id ? stateRef.current.nodes.get(id) : undefined;
    },
    []
  );

  const getChildrenFn = useCallback(
    (parentId: string | null) => getChildren(stateRef.current, parentId),
    []
  );

  const getDirtyNodes = useCallback(() => {
    return Array.from(stateRef.current.dirtySet)
      .map((id) => stateRef.current.nodes.get(id))
      .filter((n): n is WorkspaceNode => n != null);
  }, []);

  const getContent = useCallback((nodeId: string): string | undefined => {
    const ops = opsRef.current;
    for (let i = ops.length - 1; i >= 0; i--) {
      const op = ops[i];
      if (
        op.kind === 'update_content' &&
        op.payload.nodeId === nodeId
      ) {
        return op.payload.content;
      }
      if (
        op.kind === 'create_node' &&
        op.payload.id === nodeId
      ) {
        return op.payload.content;
      }
    }
    return undefined;
  }, []);

  const getAllNodes = useCallback((): readonly WorkspaceNode[] => {
    return Array.from(stateRef.current.nodes.values());
  }, []);

  // ── Config ────────────────────────────────────────────────────────────────

  const [conflictPolicy, setConflictPolicyState] = useState<ConflictPolicy>(
    config.conflictPolicy
  );

  const setConflictPolicy = useCallback((policy: ConflictPolicy) => {
    setConflictPolicyState(policy);
  }, []);

  // ── Context Value ─────────────────────────────────────────────────────────

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      state,
      config: { ...config, conflictPolicy },
      ready,
      createFile,
      createFolder,
      updateContent,
      renameNode,
      moveNode,
      deleteNode,
      getNode,
      getNodeByPath: getNodeByPathFn,
      getChildren: getChildrenFn,
      getDirtyNodes,
      getContent,
      getAllNodes,
      setConflictPolicy,
    }),
    [
      state,
      config,
      conflictPolicy,
      ready,
      createFile,
      createFolder,
      updateContent,
      renameNode,
      moveNode,
      deleteNode,
      getNode,
      getNodeByPathFn,
      getChildrenFn,
      getDirtyNodes,
      getContent,
      getAllNodes,
      setConflictPolicy,
    ]
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

// ─── Inline State Application ────────────────────────────────────────────────
// Applies a single op to the current state without replaying the full oplog.

function applyOpToState(
  prev: WorkspaceState,
  op: Operation
): WorkspaceState {
  const nodes = new Map(prev.nodes);
  const pathIndex = new Map(prev.pathIndex);
  const childrenIndex = new Map(prev.childrenIndex);
  const dirtySet = new Set(prev.dirtySet);

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
      pathIndex.set(path, id);
      const parentKey = parentId ?? '__root__';
      const siblings = childrenIndex.get(parentKey) ?? [];
      childrenIndex.set(parentKey, [...siblings, id]);
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
      pathIndex.set(path, id);
      const parentKey = parentId ?? '__root__';
      const siblings = childrenIndex.get(parentKey) ?? [];
      childrenIndex.set(parentKey, [...siblings, id]);
      break;
    }
    case 'update_content': {
      const { nodeId, contentHash: newHash } = op.payload;
      const node = nodes.get(nodeId);
      if (node && node.kind === 'file') {
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
        pathIndex.delete(node.path);
        nodes.set(nodeId, {
          ...node,
          name: newName,
          path: newPath,
          updatedAt: op.timestamp,
        });
        pathIndex.set(newPath, nodeId);
      }
      break;
    }
    case 'move_node': {
      const { nodeId, oldParentId, newParentId, newPath } = op.payload;
      const node = nodes.get(nodeId);
      if (node) {
        // Remove from old parent
        const oldKey = oldParentId ?? '__root__';
        const oldSiblings = childrenIndex.get(oldKey) ?? [];
        childrenIndex.set(
          oldKey,
          oldSiblings.filter((id) => id !== nodeId)
        );
        // Add to new parent
        const newKey = newParentId ?? '__root__';
        const newSiblings = childrenIndex.get(newKey) ?? [];
        childrenIndex.set(newKey, [...newSiblings, nodeId]);
        // Update node
        pathIndex.delete(node.path);
        nodes.set(nodeId, {
          ...node,
          parentId: newParentId,
          path: newPath,
          updatedAt: op.timestamp,
        });
        pathIndex.set(newPath, nodeId);
      }
      break;
    }
    case 'delete_node': {
      const { nodeId, path } = op.payload;
      const node = nodes.get(nodeId);
      if (node) {
        const parentKey = node.parentId ?? '__root__';
        const siblings = childrenIndex.get(parentKey) ?? [];
        childrenIndex.set(
          parentKey,
          siblings.filter((id) => id !== nodeId)
        );
      }
      pathIndex.delete(path);
      nodes.delete(nodeId);
      dirtySet.delete(nodeId);
      break;
    }
  }

  return {
    nodes,
    pathIndex,
    childrenIndex,
    dirtySet,
    nextSeq: op.seq + 1,
  };
}

/**
 * VantaOS Workspace — Core type definitions.
 *
 * Every mutation to the workspace is an Operation. Operations are stored in an
 * append-only log (IndexedDB). Derived state (file tree, dirty set, conflict
 * journal) is rebuilt from the oplog on startup.
 */

// ─── Workspace Node ──────────────────────────────────────────────────────────

export type NodeKind = 'file' | 'folder';

export interface WorkspaceNode {
  readonly id: string;
  readonly kind: NodeKind;
  readonly path: string;
  readonly name: string;
  readonly parentId: string | null;
  contentHash: string;
  language: string;
  createdAt: number;
  updatedAt: number;
}

// ─── Operation Log ───────────────────────────────────────────────────────────

export type OperationKind =
  | 'create_node'
  | 'update_content'
  | 'rename_node'
  | 'move_node'
  | 'delete_node'
  | 'create_folder';

export interface OperationBase {
  readonly id: string;
  readonly kind: OperationKind;
  readonly timestamp: number;
  readonly source: 'user' | 'adapter' | 'system';
  /** Monotonically increasing sequence number per workspace. */
  readonly seq: number;
}

export interface CreateNodeOp extends OperationBase {
  readonly kind: 'create_node';
  readonly payload: {
    readonly id: string;
    readonly path: string;
    readonly name: string;
    readonly parentId: string | null;
    readonly content: string;
    readonly language: string;
  };
}

export interface CreateFolderOp extends OperationBase {
  readonly kind: 'create_folder';
  readonly payload: {
    readonly id: string;
    readonly path: string;
    readonly name: string;
    readonly parentId: string | null;
  };
}

export interface UpdateContentOp extends OperationBase {
  readonly kind: 'update_content';
  readonly payload: {
    readonly nodeId: string;
    readonly content: string;
    readonly contentHash: string;
  };
}

export interface RenameNodeOp extends OperationBase {
  readonly kind: 'rename_node';
  readonly payload: {
    readonly nodeId: string;
    readonly oldName: string;
    readonly newName: string;
    readonly oldPath: string;
    readonly newPath: string;
  };
}

export interface MoveNodeOp extends OperationBase {
  readonly kind: 'move_node';
  readonly payload: {
    readonly nodeId: string;
    readonly oldParentId: string | null;
    readonly newParentId: string | null;
    readonly oldPath: string;
    readonly newPath: string;
  };
}

export interface DeleteNodeOp extends OperationBase {
  readonly kind: 'delete_node';
  readonly payload: {
    readonly nodeId: string;
    readonly path: string;
    /** Snapshot of the deleted node for undo. */
    readonly snapshot: WorkspaceNode;
  };
}

export type Operation =
  | CreateNodeOp
  | CreateFolderOp
  | UpdateContentOp
  | RenameNodeOp
  | MoveNodeOp
  | DeleteNodeOp;

// ─── Workspace State ─────────────────────────────────────────────────────────

export interface WorkspaceState {
  /** All live nodes, keyed by id. */
  nodes: ReadonlyMap<string, WorkspaceNode>;
  /** Path → node id. */
  pathIndex: ReadonlyMap<string, string>;
  /** Parent id → child ids. */
  childrenIndex: ReadonlyMap<string, readonly string[]>;
  /** Node ids with content different from last sync. */
  dirtySet: ReadonlySet<string>;
  /** Next sequence number for operations. */
  nextSeq: number;
}

// ─── Conflict ────────────────────────────────────────────────────────────────

export interface ConflictRecord {
  readonly nodeId: string;
  readonly path: string;
  readonly localOp: Operation;
  readonly remoteOp: Operation;
  readonly detectedAt: number;
  resolved: boolean;
}

export type ConflictPolicy = 'last-writer-wins' | 'ask-user' | 'auto-merge';

// ─── Adapter ─────────────────────────────────────────────────────────────────

export type AdapterKind = 'disk' | 'github' | 'gitlab' | 'cloudos';

export interface AdapterCapabilities {
  readonly read: boolean;
  readonly write: boolean;
  readonly delete: boolean;
  readonly move: boolean;
  readonly sync: boolean;
}

export interface Adapter {
  readonly id: string;
  readonly kind: AdapterKind;
  readonly capabilities: AdapterCapabilities;
  readonly displayName: string;

  /** Pull remote state into the workspace. Returns operations to apply. */
  pull(): Promise<readonly Operation[]>;
  /** Push local dirty state to remote. */
  push(ops: readonly Operation[]): Promise<void>;
  /** Check if adapter is reachable. */
  health(): Promise<boolean>;
}

// ─── Capability Registry ─────────────────────────────────────────────────────

export type CapabilitySlot =
  | 'terminal'
  | 'editor'
  | 'explorer'
  | 'git'
  | 'auth'
  | 'ai'
  | 'notification';

export interface CapabilityProvider {
  readonly slot: CapabilitySlot;
  readonly id: string;
  readonly displayName: string;
  /** Priority — lower wins when multiple providers claim the same slot. */
  readonly priority: number;
}

// ─── Workspace Config ────────────────────────────────────────────────────────

export interface WorkspaceConfig {
  readonly conflictPolicy: ConflictPolicy;
  /** Max operations before compaction. */
  readonly maxOplogSize: number;
  /** Auto-save interval in ms. 0 = disabled. */
  readonly autoSaveInterval: number;
  /** Registered adapter ids. */
  readonly adapterIds: readonly string[];
}

export const DEFAULT_WORKSPACE_CONFIG: WorkspaceConfig = {
  conflictPolicy: 'last-writer-wins',
  maxOplogSize: 10_000,
  autoSaveInterval: 2_000,
  adapterIds: [],
} as const;

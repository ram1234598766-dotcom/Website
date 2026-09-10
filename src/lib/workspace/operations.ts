/**
 * VantaOS Workspace — Operation Log.
 *
 * Append-only log of every intent to mutate the workspace. Each operation is
 * persisted to IndexedDB before being applied to in-memory state.
 */

import type {
  Operation,
  OperationKind,
  WorkspaceNode,
  CreateNodeOp,
  CreateFolderOp,
  UpdateContentOp,
  RenameNodeOp,
  MoveNodeOp,
  DeleteNodeOp,
} from './types';

// ─── IndexedDB helpers ───────────────────────────────────────────────────────

const DB_NAME = 'VantaOSWorkspace';
const DB_VERSION = 2;
const OPS_STORE = 'operations';
const META_STORE = 'workspace_meta';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OPS_STORE)) {
        const store = db.createObjectStore(OPS_STORE, { keyPath: 'id' });
        store.createIndex('by_seq', 'seq', { unique: true });
        store.createIndex('by_timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ─── Sequence Counter ────────────────────────────────────────────────────────

async function getNextSeq(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readwrite');
    const store = tx.objectStore(META_STORE);
    const req = store.get('nextSeq');
    req.onsuccess = () => {
      const current = (req.result?.value as number) ?? 0;
      const next = current + 1;
      store.put({ key: 'nextSeq', value: next });
      tx.oncomplete = () => resolve(next);
    };
    req.onerror = () => reject(req.error);
  });
}

async function setNextSeq(value: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readwrite');
    const store = tx.objectStore(META_STORE);
    store.put({ key: 'nextSeq', value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Public API ──────────────────────────────────────────────────────────────

let _seqCounter = 0;

export function initSeqCounter(startFrom: number): void {
  _seqCounter = startFrom;
}

function bumpSeq(): number {
  _seqCounter += 1;
  // Persist asynchronously — don't block the caller.
  setNextSeq(_seqCounter).catch(console.error);
  return _seqCounter;
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Append an operation to the log and persist it. Returns the sealed op. */
export async function appendOp(
  kind: OperationKind,
  source: Operation['source'],
  payload: Operation['payload']
): Promise<Operation> {
  const seq = bumpSeq();
  const op = {
    id: generateId(),
    kind,
    timestamp: Date.now(),
    source,
    seq,
    payload,
  } as Operation;

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(OPS_STORE, 'readwrite');
    tx.objectStore(OPS_STORE).put(op);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return op;
}

/** Bulk-append operations (used during migration from localStorage). */
export async function bulkAppendOps(
  ops: readonly Operation[]
): Promise<void> {
  if (ops.length === 0) return;
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(OPS_STORE, 'readwrite');
    const store = tx.objectStore(OPS_STORE);
    for (const op of ops) {
      store.put(op);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Load all operations sorted by sequence number. */
export async function loadOps(): Promise<readonly Operation[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OPS_STORE, 'readonly');
    const store = tx.objectStore(OPS_STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      const ops = (req.result ?? []) as Operation[];
      ops.sort((a, b) => a.seq - b.seq);
      resolve(ops);
    };
    req.onerror = () => reject(req.error);
  });
}

/** Load operations after a given sequence number (for incremental sync). */
export async function loadOpsAfter(seq: number): Promise<readonly Operation[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OPS_STORE, 'readonly');
    const store = tx.objectStore(OPS_STORE);
    const index = store.index('by_seq');
    const range = IDBKeyRange.lowerBound(seq + 1, true);
    const req = index.getAll(range);
    req.onsuccess = () => resolve((req.result ?? []) as Operation[]);
    req.onerror = () => reject(req.error);
  });
}

/** Delete all operations (used during compaction). */
export async function clearOps(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OPS_STORE, 'readwrite');
    tx.objectStore(OPS_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Replace the entire log (used after compaction). */
export async function replaceOps(ops: readonly Operation[]): Promise<void> {
  await clearOps();
  if (ops.length > 0) {
    await bulkAppendOps(ops);
  }
}

// ─── Op Factories ────────────────────────────────────────────────────────────

/** Create a file node operation. */
export function makeCreateNodeOp(
  params: {
    path: string;
    name: string;
    parentId: string | null;
    content: string;
    language: string;
  },
  source: Operation['source'] = 'user'
): CreateNodeOp {
  return {
    id: generateId(),
    kind: 'create_node',
    timestamp: Date.now(),
    source,
    seq: 0, // will be overwritten by appendOp
    payload: {
      id: generateId(),
      ...params,
    },
  };
}

/** Create a folder node operation. */
export function makeCreateFolderOp(
  params: {
    path: string;
    name: string;
    parentId: string | null;
  },
  source: Operation['source'] = 'user'
): CreateFolderOp {
  return {
    id: generateId(),
    kind: 'create_folder',
    timestamp: Date.now(),
    source,
    seq: 0,
    payload: {
      id: generateId(),
      ...params,
    },
  };
}

/** Update file content operation. */
export function makeUpdateContentOp(
  params: {
    nodeId: string;
    content: string;
    contentHash: string;
  },
  source: Operation['source'] = 'user'
): UpdateContentOp {
  return {
    id: generateId(),
    kind: 'update_content',
    timestamp: Date.now(),
    source,
    seq: 0,
    payload: params,
  };
}

/** Rename node operation. */
export function makeRenameNodeOp(
  params: {
    nodeId: string;
    oldName: string;
    newName: string;
    oldPath: string;
    newPath: string;
  },
  source: Operation['source'] = 'user'
): RenameNodeOp {
  return {
    id: generateId(),
    kind: 'rename_node',
    timestamp: Date.now(),
    source,
    seq: 0,
    payload: params,
  };
}

/** Move node operation. */
export function makeMoveNodeOp(
  params: {
    nodeId: string;
    oldParentId: string | null;
    newParentId: string | null;
    oldPath: string;
    newPath: string;
  },
  source: Operation['source'] = 'user'
): MoveNodeOp {
  return {
    id: generateId(),
    kind: 'move_node',
    timestamp: Date.now(),
    source,
    seq: 0,
    payload: params,
  };
}

/** Delete node operation. */
export function makeDeleteNodeOp(
  params: {
    nodeId: string;
    path: string;
    snapshot: WorkspaceNode;
  },
  source: Operation['source'] = 'user'
): DeleteNodeOp {
  return {
    id: generateId(),
    kind: 'delete_node',
    timestamp: Date.now(),
    source,
    seq: 0,
    payload: params,
  };
}

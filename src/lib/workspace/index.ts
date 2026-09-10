/**
 * VantaOS Workspace — Public API.
 *
 * Re-exports all workspace types, operations, indexes, and the React provider.
 */

// Types
export type {
  WorkspaceNode,
  NodeKind,
  Operation,
  OperationKind,
  CreateNodeOp,
  CreateFolderOp,
  UpdateContentOp,
  RenameNodeOp,
  MoveNodeOp,
  DeleteNodeOp,
  WorkspaceState,
  WorkspaceConfig,
  ConflictRecord,
  ConflictPolicy,
  AdapterKind,
  AdapterCapabilities,
  Adapter,
  CapabilitySlot,
  CapabilityProvider,
} from './types';

export { DEFAULT_WORKSPACE_CONFIG } from './types';

// Operations
export {
  appendOp,
  bulkAppendOps,
  loadOps,
  loadOpsAfter,
  clearOps,
  replaceOps,
  initSeqCounter,
  makeCreateNodeOp,
  makeCreateFolderOp,
  makeUpdateContentOp,
  makeRenameNodeOp,
  makeMoveNodeOp,
  makeDeleteNodeOp,
} from './operations';

// Indexes
export {
  contentHash,
  detectLanguage,
  buildState,
  getChildren,
  getNodeByPath,
  getDescendants,
  getPathParts,
  buildPath,
} from './indexes';

// Conflict
export {
  detectConflicts,
  resolveConflicts,
  markResolved,
} from './conflict';

// Adapter
export {
  InMemoryAdapter,
  GitHubAdapter,
  registerAdapter,
  getAdapter,
  getAllAdapters,
  removeAdapter,
  initDefaultAdapters,
} from './adapter';

// Capabilities
export {
  registerCapability,
  getCapability,
  getCapabilities,
  removeCapability,
  clearCapabilities,
  occupiedSlots,
} from './capabilities';

// React
export { WorkspaceProvider, useWorkspace } from './workspace';

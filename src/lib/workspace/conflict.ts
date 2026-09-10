/**
 * VantaOS Workspace — Conflict Detection.
 *
 * Detects when local and remote operations affect the same node in incompatible
 * ways. The default policy is last-writer-wins with a user notification.
 */

import type {
  Operation,
  ConflictRecord,
  ConflictPolicy,
} from './types';

// ─── Conflict Detection ──────────────────────────────────────────────────────

/** Two operations conflict if they affect the same node and one is a write. */
function affectsSameNode(a: Operation, b: Operation): boolean {
  if (a.kind === 'delete_node' && b.kind === 'delete_node') {
    return a.payload.nodeId === b.payload.nodeId;
  }
  if (a.kind === 'delete_node') {
    return (
      b.kind === 'update_content' ||
      b.kind === 'rename_node' ||
      b.kind === 'move_node'
    ) && b.payload.nodeId === a.payload.nodeId;
  }
  if (b.kind === 'delete_node') {
    return (
      a.kind === 'update_content' ||
      a.kind === 'rename_node' ||
      a.kind === 'move_node'
    ) && a.payload.nodeId === b.payload.nodeId;
  }
  if (
    (a.kind === 'update_content' || a.kind === 'rename_node' || a.kind === 'move_node') &&
    (b.kind === 'update_content' || b.kind === 'rename_node' || b.kind === 'move_node')
  ) {
    return a.payload.nodeId === b.payload.nodeId;
  }
  return false;
}

/** Check if two operations are from different sources (local vs remote). */
function isCrossSource(a: Operation, b: Operation): boolean {
  return a.source !== b.source && a.source !== 'system' && b.source !== 'system';
}

/** Detect all conflicts between a set of local and remote operations. */
export function detectConflicts(
  localOps: readonly Operation[],
  remoteOps: readonly Operation[]
): ConflictRecord[] {
  const conflicts: ConflictRecord[] = [];

  for (const localOp of localOps) {
    for (const remoteOp of remoteOps) {
      if (
        affectsSameNode(localOp, remoteOp) &&
        isCrossSource(localOp, remoteOp) &&
        // Only flag if remote is newer than local
        remoteOp.timestamp > localOp.timestamp
      ) {
        conflicts.push({
          nodeId:
            localOp.kind === 'create_node' || localOp.kind === 'create_folder'
              ? localOp.payload.id
              : localOp.payload.nodeId,
          path:
            localOp.kind === 'create_node' || localOp.kind === 'create_folder'
              ? localOp.payload.path
              : localOp.kind === 'delete_node'
              ? localOp.payload.path
              : localOp.kind === 'rename_node'
              ? localOp.payload.oldPath
              : localOp.kind === 'move_node'
              ? localOp.payload.oldPath
              : '',
          localOp,
          remoteOp,
          detectedAt: Date.now(),
          resolved: false,
        });
      }
    }
  }

  return conflicts;
}

// ─── Conflict Resolution ─────────────────────────────────────────────────────

/** Resolve conflicts using the given policy. Returns operations to apply. */
export function resolveConflicts(
  conflicts: readonly ConflictRecord[],
  policy: ConflictPolicy
): readonly Operation[] {
  if (policy === 'last-writer-wins') {
    return conflicts.map((c) =>
      c.localOp.timestamp >= c.remoteOp.timestamp ? c.localOp : c.remoteOp
    );
  }

  if (policy === 'auto-merge') {
    // For content updates, take the remote (assumed to be from a different
    // device that may have more recent edits). For structural changes,
    // last-writer-wins.
    return conflicts.map((c) => {
      if (
        c.localOp.kind === 'update_content' &&
        c.remoteOp.kind === 'update_content'
      ) {
        // Could implement merge logic here — for now, last-writer-wins.
        return c.localOp.timestamp >= c.remoteOp.timestamp
          ? c.localOp
          : c.remoteOp;
      }
      return c.localOp.timestamp >= c.remoteOp.timestamp
        ? c.localOp
        : c.remoteOp;
    });
  }

  // 'ask-user' — return empty, let the UI handle it.
  return [];
}

/** Mark a conflict as resolved. */
export function markResolved(conflict: ConflictRecord): ConflictRecord {
  return { ...conflict, resolved: true };
}

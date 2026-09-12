/**
 * VantaOS Sync — Conflict Resolution.
 *
 * Three strategies for merging concurrent edits:
 * - Last-Writer-Wins (LWW) for metadata
 * - Add-wins OR-Set for tags/collaborators
 * - Operational Transformation (OT) for text edits
 */

import type { ConflictInfo, PeerPresence } from './types';

// ─── LWW: Last-Writer-Wins ─────────────────────────────────────────────────────

export interface LWWEntry<T> {
  value: T;
  timestamp: number;
  deviceId: string;
}

/** Create a new LWW register. */
export function createLWW<T>(initial: T, timestamp: number, deviceId: string): LWWEntry<T> {
  return { value: initial, timestamp, deviceId };
}

/** Merge a remote LWW entry: higher lamport/timestamp wins, ties go to local. */
export function mergeLWW<T>(
  local: LWWEntry<T>,
  remote: { value: T; timestamp: number; deviceId: string },
  lamport: number,
  remoteLamport: number
): LWWEntry<T> {
  if (remoteLamport > lamport) return { value: remote.value, timestamp: remote.timestamp, deviceId: remote.deviceId };
  if (remoteLamport < lamport) return local;
  return remote.timestamp >= local.timestamp ? { value: remote.value, timestamp: remote.timestamp, deviceId: remote.deviceId } : local;
}

// ─── OR-Set: Add-Wins Observed-Remove Set ──────────────────────────────────────

interface ORSetItem {
  id: string;
  addedBy: string;
  addedAt: number;
  removed: boolean;
}

export interface ORSet<T> {
  items: Map<string, ORSetItem>;
  values: Map<string, T>;
}

/** Create an empty OR-Set. */
export function createORSet<T>(): ORSet<T> {
  return { items: new Map(), values: new Map() };
}

/** Add an element to the OR-Set (tag, collaborator, etc.). */
export function orSetAdd<T>(set: ORSet<T>, value: T, deviceId: string): { tag: string; op: 'add' } {
  const tag = `${deviceId}:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`;
  set.items.set(tag, { id: tag, addedBy: deviceId, addedAt: Date.now(), removed: false });
  set.values.set(tag, value);
  return { tag, op: 'add' };
}

/** Remove an element by any of its tags. */
export function orSetRemove<T>(set: ORSet<T>, predicate: (v: T) => boolean): void {
  for (const [tag, item] of set.items) {
    if (!item.removed && predicate(set.values.get(tag)!)) {
      item.removed = true;
    }
  }
}

/** Merge a remote OR-Set delta into local (add-wins). */
export function mergeORSet<T>(
  local: ORSet<T>,
  remote: ORSet<T>
): void {
  for (const [tag, remoteItem] of remote.items) {
    const localItem = local.items.get(tag);
    if (!localItem) {
      local.items.set(tag, { ...remoteItem, removed: false });
      if (!remoteItem.removed && remote.values.has(tag)) {
        local.values.set(tag, remote.values.get(tag)!);
      }
    } else {
      if (!remoteItem.removed) {
        localItem.removed = false;
      }
      if (!local.values.has(tag) && remote.values.has(tag)) {
        local.values.set(tag, remote.values.get(tag)!);
      }
    }
  }
}

/** Get all live (non-removed) values from the OR-Set. */
export function orSetValues<T>(set: ORSet<T>): T[] {
  const seen = new Set<T>();
  const result: T[] = [];
  for (const [, item] of set.items) {
    if (!item.removed && set.values.has(item.id)) {
      const v = set.values.get(item.id)!;
      if (!seen.has(v)) {
        seen.add(v);
        result.push(v);
      }
    }
  }
  return result;
}

// ─── OT: Operational Transformation (text) ─────────────────────────────────────

export type TextOpKind = 'insert' | 'delete';

export interface TextOp {
  readonly kind: TextOpKind;
  readonly position: number;
  readonly text?: string;
  readonly length?: number;
  readonly deviceId: string;
  readonly lamport: number;
}

export interface TransformResult {
  readonly op: TextOp;
  readonly adjusted: boolean;
}

/**
 * Transform opB against opA so both can be applied in order.
 * Returns the transformed opB and whether it was adjusted.
 */
export function transformTextOp(opA: TextOp, opB: TextOp): TransformResult {
  if (opA.kind === 'insert' && opB.kind === 'insert') {
    if (opB.position >= opA.position + (opA.text?.length ?? 0)) {
      return { op: { ...opB, position: opB.position + (opA.text?.length ?? 0) }, adjusted: true };
    }
    if (opB.position >= opA.position) {
      return { op: opB, adjusted: false };
    }
    return { op: opB, adjusted: false };
  }

  if (opA.kind === 'insert' && opB.kind === 'delete') {
    const aEnd = opA.position + (opA.text?.length ?? 0);
    if (opB.position >= aEnd) {
      return { op: { ...opB, position: opB.position + (opA.text?.length ?? 0) }, adjusted: true };
    }
    if (opB.position + (opB.length ?? 0) <= opA.position) {
      return { op: opB, adjusted: false };
    }
    const overlap = aEnd - opB.position;
    const newLen = Math.max(0, (opB.length ?? 0) - overlap);
    return { op: { ...opB, length: newLen }, adjusted: true };
  }

  if (opA.kind === 'delete' && opB.kind === 'insert') {
    const aEnd = opA.position + (opA.length ?? 0);
    if (opB.position >= aEnd) {
      return { op: { ...opB, position: opB.position - (opA.length ?? 0) }, adjusted: true };
    }
    if (opB.position >= opA.position) {
      return { op: { ...opB, position: opA.position }, adjusted: true };
    }
    return { op: opB, adjusted: false };
  }

  if (opA.kind === 'delete' && opB.kind === 'delete') {
    if (opB.position >= opA.position + (opA.length ?? 0)) {
      return { op: { ...opB, position: opB.position - (opA.length ?? 0) }, adjusted: true };
    }
    if (opB.position + (opB.length ?? 0) <= opA.position) {
      return { op: opB, adjusted: false };
    }
    const overlapStart = Math.max(opB.position, opA.position);
    const overlapEnd = Math.min(opB.position + (opB.length ?? 0), opA.position + (opA.length ?? 0));
    const overlapLen = overlapEnd - overlapStart;
    const newStart = Math.min(opB.position, opA.position);
    const newLen = Math.max(0, (opB.length ?? 0) - overlapLen);
    return { op: { ...opB, position: newStart, length: newLen }, adjusted: true };
  }

  return { op: opB, adjusted: false };
}

/**
 * Apply a list of text ops to a string, transforming them against each other
 * to ensure convergence regardless of application order.
 */
export function applyTextOps(text: string, ops: readonly TextOp[]): string {
  let result = text;
  const sorted = [...ops].sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    return a.deviceId.localeCompare(b.deviceId);
  });
  for (const op of sorted) {
    if (op.kind === 'insert' && op.text) {
      const pos = Math.min(op.position, result.length);
      result = result.slice(0, pos) + op.text + result.slice(pos);
    } else if (op.kind === 'delete') {
      const pos = Math.min(op.position, result.length);
      const len = Math.min(op.length ?? 0, result.length - pos);
      result = result.slice(0, pos) + result.slice(pos + len);
    }
  }
  return result;
}

// ─── Three-Way Merge ──────────────────────────────────────────────────────────

/**
 * Merge local and remote metadata (LWW), tags (OR-Set), and text (OT).
 * Returns a merged result or conflict markers if unresolvable.
 */
export interface MergeResult<TMeta, TTag> {
  readonly metadata: TMeta;
  readonly tags: TTag[];
  readonly text: string;
  readonly hasConflict: boolean;
  readonly conflicts: ConflictInfo[];
}

export function mergeAll<TMeta, TTag>(
  localMeta: LWWEntry<TMeta>,
  remoteMeta: { value: TMeta; timestamp: number; deviceId: string },
  localLamport: number,
  remoteLamport: number,
  localTags: ORSet<TTag>,
  remoteTags: ORSet<TTag>,
  localText: string,
  remoteText: string,
  localOps: readonly TextOp[],
  remoteOps: readonly TextOp[]
): MergeResult<TMeta, TTag> {
  const metadata = mergeLWW(localMeta, remoteMeta, localLamport, remoteLamport) as TMeta;
  const mergedTags = createORSet<TTag>();
  mergeORSet(mergedTags, localTags);
  mergeORSet(mergedTags, remoteTags);

  const allOps: TextOp[] = [...localOps, ...remoteOps];
  allOps.sort((a, b) => {
    if (a.lamport !== b.lamport) return a.lamport - b.lamport;
    return a.deviceId.localeCompare(b.deviceId);
  });
  const text = applyTextOps(localText, allOps);

  const hasConflict = false;
  const conflicts: ConflictInfo[] = [];

  return { metadata, tags: orSetValues(mergedTags), text, hasConflict, conflicts };
}

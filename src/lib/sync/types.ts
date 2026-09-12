/**
 * VantaOS Sync — Types.
 *
 * Shared types for the sync layer (batch, protocol, conflict resolution).
 */

// ─── Lamport / Vector Clock ───────────────────────────────────────────────────

export interface LamportClock {
  deviceId: string;
  counter: number;
}

export type VectorClock = Record<string, number>;

// ─── Sync Device ──────────────────────────────────────────────────────────────

export interface SyncDevice {
  readonly id: string;
  readonly label: string;
  readonly lastSeen: number;
  readonly lamport: number;
  readonly online: boolean;
}

// ─── Operation Batch ──────────────────────────────────────────────────────────

export interface BatchHeader {
  readonly deviceId: string;
  readonly timestamp: number;
  readonly lamport: number;
  readonly vectorClock: VectorClock;
  readonly batchId: string;
}

export interface Tombstone {
  readonly nodeId: string;
  readonly deletedAt: number;
  readonly deletedBy: string;
}

export interface OperationBatch {
  readonly header: BatchHeader;
  readonly operations: readonly SyncOp[];
  readonly tombstones: readonly Tombstone[];
}

export interface SyncOp {
  readonly id: string;
  readonly kind: string;
  readonly timestamp: number;
  readonly deviceId: string;
  readonly lamport: number;
  readonly payload: Record<string, unknown>;
}

// ─── Sync Protocol Messages ────────────────────────────────────────────────────

export type SyncMessageType =
  | 'pull_request'
  | 'pull_response'
  | 'push_request'
  | 'push_ack'
  | 'push_nack'
  | 'presence_heartbeat'
  | 'cursor_broadcast';

export interface SyncMessage {
  readonly type: SyncMessageType;
  readonly deviceId: string;
  readonly timestamp: number;
  readonly payload: Record<string, unknown>;
}

export interface PullRequest {
  readonly sinceSeq: number;
  readonly deviceId: string;
}

export interface PullResponse {
  readonly ops: readonly SyncOp[];
  readonly tombstones: readonly Tombstone[];
  readonly hasMore: boolean;
}

export interface PushRequest {
  readonly batch: OperationBatch;
}

export interface PushAck {
  readonly accepted: boolean;
  readonly conflicts: ConflictInfo[];
  readonly serverLamport: number;
}

export interface PushNack {
  readonly reason: string;
  readonly retryAfterMs: number;
}

export interface PresenceHeartbeat {
  readonly deviceId: string;
  readonly label: string;
  readonly online: boolean;
  readonly lastCursor?: { nodeId: string; position: number };
}

export interface ConflictInfo {
  readonly nodeId: string;
  readonly localLamport: number;
  readonly remoteLamport: number;
}

// ─── Presence / Cursor ─────────────────────────────────────────────────────────

export interface PeerPresence {
  readonly deviceId: string;
  readonly label: string;
  readonly online: boolean;
  readonly lastSeen: number;
  readonly cursor: { nodeId: string; position: number } | null;
}

// ─── Sync Status ──────────────────────────────────────────────────────────────

export type SyncState = 'synced' | 'syncing' | 'offline' | 'conflict';

export interface SyncStatus {
  readonly state: SyncState;
  readonly lastSyncAt: number | null;
  readonly pendingOps: number;
  readonly peers: readonly PeerPresence[];
  readonly conflicts: readonly ConflictInfo[];
  readonly deviceId: string;
}

// ─── Protocol Transport ────────────────────────────────────────────────────────

export interface SyncTransport {
  send(message: SyncMessage): Promise<void>;
  onMessage(handler: (message: SyncMessage) => void): void;
}

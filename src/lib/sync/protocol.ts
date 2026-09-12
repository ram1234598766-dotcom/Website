/**
 * VantaOS Sync — Protocol.
 *
 * Defines pull/push/presence protocol messages and a mock transport.
 * Designed for a future backend; tests use MockSyncTransport.
 */

import type {
  SyncMessage,
  SyncMessageType,
  SyncTransport,
  PullRequest,
  PullResponse,
  PushRequest,
  PushAck,
  PushNack,
  PresenceHeartbeat,
  OperationBatch,
  SyncOp,
  Tombstone,
  PeerPresence,
  SyncState,
  SyncStatus,
  ConflictInfo,
} from './types';
import type { Operation } from '../workspace/types';

// ─── Message Builders ──────────────────────────────────────────────────────────

export function buildPullRequest(sinceSeq: number, deviceId: string): SyncMessage {
  return { type: 'pull_request', deviceId, timestamp: Date.now(), payload: { sinceSeq } as unknown as Record<string, unknown> };
}

export function buildPullResponse(
  ops: readonly SyncOp[],
  tombstones: readonly Tombstone[],
  hasMore: boolean,
  deviceId: string
): SyncMessage {
  return {
    type: 'pull_response',
    deviceId,
    timestamp: Date.now(),
    payload: { ops, tombstones, hasMore } as unknown as Record<string, unknown>,
  };
}

export function buildPushRequest(batch: OperationBatch, deviceId: string): SyncMessage {
  return { type: 'push_request', deviceId, timestamp: Date.now(), payload: { batch } as unknown as Record<string, unknown> };
}

export function buildPushAck(
  accepted: boolean,
  conflicts: ConflictInfo[],
  serverLamport: number,
  deviceId: string
): SyncMessage {
  return { type: 'push_ack', deviceId, timestamp: Date.now(), payload: { accepted, conflicts, serverLamport } as unknown as Record<string, unknown> };
}

export function buildPushNack(reason: string, retryAfterMs: number, deviceId: string): SyncMessage {
  return { type: 'push_nack', deviceId, timestamp: Date.now(), payload: { reason, retryAfterMs } as unknown as Record<string, unknown> };
}

export function buildPresenceHeartbeat(
  deviceId: string,
  label: string,
  online: boolean,
  cursor?: { nodeId: string; position: number }
): SyncMessage {
  return { type: 'presence_heartbeat', deviceId, timestamp: Date.now(), payload: { label, online, cursor } as unknown as Record<string, unknown> };
}

export function buildCursorBroadcast(
  deviceId: string,
  nodeId: string,
  position: number
): SyncMessage {
  return { type: 'cursor_broadcast', deviceId, timestamp: Date.now(), payload: { nodeId, position } as unknown as Record<string, unknown> };
}

// ─── Protocol State ────────────────────────────────────────────────────────────

export interface ProtocolState {
  readonly deviceId: string;
  readonly label: string;
  lamport: number;
  vectorClock: Record<string, number>;
  lastSyncSeq: number;
  lastSyncAt: number | null;
  pendingOps: number;
  peers: Map<string, PeerPresence>;
  state: SyncState;
  conflicts: ConflictInfo[];
}

export function createProtocolState(deviceId: string, label: string): ProtocolState {
  return {
    deviceId,
    label,
    lamport: 0,
    vectorClock: {},
    lastSyncSeq: 0,
    lastSyncAt: null,
    pendingOps: 0,
    peers: new Map(),
    state: 'synced',
    conflicts: [],
  };
}

// ─── Sync Engine ──────────────────────────────────────────────────────────────

export interface SyncEngine {
  readonly state: ProtocolState;
  pull(sinceSeq: number): Promise<PullResponse>;
  push(batch: OperationBatch): Promise<PushAck | PushNack>;
  heartbeat(): Promise<void>;
  broadcastCursor(nodeId: string, position: number): Promise<void>;
  onPeerPresence(handler: (peer: PeerPresence) => void): void;
}

export interface SyncEngineOptions {
  onRequest?: (msg: SyncMessage) => void;
}

export function createSyncEngine(
  deviceId: string,
  label: string,
  transport: SyncTransport,
  options: SyncEngineOptions = {}
): SyncEngine {
  const state = createProtocolState(deviceId, label);

  transport.onMessage((msg: SyncMessage) => {
    if (options.onRequest) {
      options.onRequest(msg);
    }

    switch (msg.type) {
      case 'pull_response': {
        const resp = msg.payload as unknown as PullResponse;
        state.lastSyncSeq += resp.ops.length;
        state.lastSyncAt = Date.now();
        state.state = 'synced';
        break;
      }
      case 'push_ack': {
        const ack = msg.payload as unknown as PushAck;
        if (!ack.accepted) {
          state.conflicts.push(...ack.conflicts);
          state.state = 'conflict';
        } else {
          state.state = 'synced';
        }
        state.lamport = Math.max(state.lamport, ack.serverLamport);
        state.pendingOps = Math.max(0, state.pendingOps - 1);
        state.lastSyncAt = Date.now();
        break;
      }
      case 'push_nack': {
        state.state = 'syncing';
        break;
      }
      case 'presence_heartbeat': {
        const hb = msg.payload as unknown as PresenceHeartbeat;
        state.peers.set(msg.deviceId, {
          deviceId: msg.deviceId,
          label: hb.label,
          online: hb.online,
          lastSeen: Date.now(),
          cursor: hb.lastCursor ?? null,
        });
        break;
      }
      case 'cursor_broadcast': {
        const cursor = msg.payload as unknown as { nodeId: string; position: number };
        const existing = state.peers.get(msg.deviceId);
        if (existing) {
          state.peers.set(msg.deviceId, { ...existing, cursor: { nodeId: cursor.nodeId, position: cursor.position }, lastSeen: Date.now() });
        }
        break;
      }
    }
  });

  return {
    get state() { return state; },

    async pull(sinceSeq: number): Promise<PullResponse> {
      state.state = 'syncing';
      const req = buildPullRequest(sinceSeq, deviceId);

      return new Promise<PullResponse>((resolve) => {
        const handler = (msg: SyncMessage) => {
          if (msg.type === 'pull_response' && msg.deviceId !== deviceId) {
            const resp = msg.payload as unknown as PullResponse;
            state.lastSyncSeq = sinceSeq + resp.ops.length;
            state.lastSyncAt = Date.now();
            state.state = 'synced';
            resolve(resp);
          }
        };
        transport.onMessage(handler);
        transport.send(req).then(() => {
          setTimeout(() => {
            (transport as { offMessage?: (h: (msg: SyncMessage) => void) => void }).offMessage?.(handler);
            resolve({ ops: [], tombstones: [], hasMore: false });
          }, 5000);
        });
      });
    },

    async push(batch: OperationBatch): Promise<PushAck | PushNack> {
      state.state = 'syncing';
      state.pendingOps += batch.operations.length;
      const req = buildPushRequest(batch, deviceId);

      return new Promise<PushAck | PushNack>((resolve) => {
        const handler = (msg: SyncMessage) => {
          if (msg.deviceId !== deviceId) {
            if (msg.type === 'push_ack') resolve(msg.payload as unknown as PushAck);
            if (msg.type === 'push_nack') resolve(msg.payload as unknown as PushNack);
          }
        };
        transport.onMessage(handler);
        transport.send(req).then(() => {
          setTimeout(() => {
            (transport as { offMessage?: (h: (msg: SyncMessage) => void) => void }).offMessage?.(handler);
            state.state = 'offline';
            resolve({ accepted: false, conflicts: [], serverLamport: state.lamport, reason: 'timeout', retryAfterMs: 5000 });
          }, 5000);
        });
      });
    },

    async heartbeat(): Promise<void> {
      const hb = buildPresenceHeartbeat(deviceId, label, true);
      await transport.send(hb);
      state.peers.set(deviceId, { deviceId, label, online: true, lastSeen: Date.now(), cursor: null });
    },

    async broadcastCursor(nodeId: string, position: number): Promise<void> {
      const cursor = buildCursorBroadcast(deviceId, nodeId, position);
      await transport.send(cursor);
    },

    onPeerPresence(handler: (peer: PeerPresence) => void): void {
      transport.onMessage((msg: SyncMessage) => {
        if (msg.type === 'presence_heartbeat') {
          const hb = msg.payload as unknown as PresenceHeartbeat;
          const peer: PeerPresence = {
            deviceId: msg.deviceId,
            label: hb.label,
            online: hb.online,
            lastSeen: Date.now(),
            cursor: hb.lastCursor ?? null,
          };
          handler(peer);
        }
      });
    },
  };
}

// ─── Mock Transport (for tests) ────────────────────────────────────────────────

export class MockSyncTransport implements SyncTransport {
  private listeners: ((msg: SyncMessage) => void)[] = [];
  private messageLog: SyncMessage[] = [];
  private pairedEngine: MockSyncTransport | null = null;

  pairWith(other: MockSyncTransport): void {
    this.pairedEngine = other;
    other.pairedEngine = this;
  }

  send(message: SyncMessage): Promise<void> {
    this.messageLog.push(message);
    if (this.pairedEngine) {
      this.pairedEngine.messageLog.push(message);
      for (const listener of this.pairedEngine.listeners) {
        listener(message);
      }
    }
    return Promise.resolve();
  }

  onMessage(handler: (message: SyncMessage) => void): void {
    this.listeners.push(handler);
  }

  getLog(): readonly SyncMessage[] {
    return this.messageLog;
  }

  clear(): void {
    this.messageLog = [];
    this.listeners = [];
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

export function getSyncStatus(state: ProtocolState): SyncStatus {
  return {
    state: state.state,
    lastSyncAt: state.lastSyncAt,
    pendingOps: state.pendingOps,
    peers: Array.from(state.peers.values()),
    conflicts: state.conflicts,
    deviceId: state.deviceId,
  };
}

export function countOnlinePeers(state: ProtocolState): number {
  return Array.from(state.peers.values()).filter((p) => p.online && Date.now() - p.lastSeen < 30_000).length;
}

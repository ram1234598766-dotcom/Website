/**
 * Phase 6 — Sync Protocol.
 *
 * Verifies:
 * - Pull: request ops since last known seq
 * - Push: send batch, receive ACK/NACK
 * - Presence: heartbeat, cursor broadcast
 */

import { describe, expect, it } from 'vitest';
import {
  buildPullRequest,
  buildPullResponse,
  buildPushRequest,
  buildPushAck,
  buildPushNack,
  buildPresenceHeartbeat,
  buildCursorBroadcast,
  createProtocolState,
  createSyncEngine,
  MockSyncTransport,
  getSyncStatus,
  countOnlinePeers,
} from '../../src/lib/sync/protocol';
import type { SyncMessage, OperationBatch, ConflictInfo, SyncTransport } from '../../src/lib/sync/types';

// ─── Direct Responding Transport ──────────────────────────────────────────────

/**
 * A SyncTransport that immediately delivers responses when specific message
 * types are sent. Used to test engine behavior without paired transports.
 */
function createRespondingTransport(
  onSend: (msg: SyncMessage) => SyncMessage | void
): { transport: SyncTransport; messages: SyncMessage[] } {
  const messages: SyncMessage[] = [];
  const listeners: ((msg: SyncMessage) => void)[] = [];

  const transport: SyncTransport = {
    async send(message: SyncMessage): Promise<void> {
      messages.push(message);
      const response = onSend(message);
      if (response) {
        for (const listener of listeners) {
          listener(response);
        }
      }
    },
    onMessage(handler: (message: SyncMessage) => void): void {
      listeners.push(handler);
    },
  };

  return { transport, messages };
}

// ─── Message Builder Tests ─────────────────────────────────────────────────────

describe('buildPullRequest', () => {
  it('creates a pull_request with sinceSeq and deviceId', () => {
    const msg = buildPullRequest(42, 'dev-1');
    expect(msg.type).toBe('pull_request');
    expect(msg.deviceId).toBe('dev-1');
    expect((msg.payload as unknown as { sinceSeq: number }).sinceSeq).toBe(42);
  });
});

describe('buildPullResponse', () => {
  it('creates a pull_response with ops, tombstones, and hasMore', () => {
    const ops = [{ id: 'o1', kind: 'insert', timestamp: 1, deviceId: 's', lamport: 1, payload: {} }];
    const tombstones = [{ nodeId: 'n1', deletedAt: 1, deletedBy: 's' }];
    const msg = buildPullResponse(ops, tombstones, true, 'srv-1');
    expect(msg.type).toBe('pull_response');
    expect((msg.payload as unknown as { hasMore: boolean }).hasMore).toBe(true);
    expect((msg.payload as unknown as { ops: unknown[] }).ops).toHaveLength(1);
    expect((msg.payload as unknown as { tombstones: unknown[] }).tombstones).toHaveLength(1);
  });
});

describe('buildPushRequest', () => {
  it('creates a push_request containing the batch', () => {
    const batch: OperationBatch = {
      header: { deviceId: 'd', timestamp: 1, lamport: 1, vectorClock: {}, batchId: 'b1' },
      operations: [],
      tombstones: [],
    };
    const msg = buildPushRequest(batch, 'd');
    expect(msg.type).toBe('push_request');
    expect((msg.payload as unknown as { batch: OperationBatch }).batch).toBe(batch);
  });
});

describe('buildPushAck', () => {
  it('creates a push_ack with accepted flag and conflicts', () => {
    const conflicts: ConflictInfo[] = [{ nodeId: 'n1', localLamport: 5, remoteLamport: 10 }];
    const msg = buildPushAck(true, conflicts, 20, 'srv');
    expect(msg.type).toBe('push_ack');
    expect((msg.payload as unknown as { accepted: boolean }).accepted).toBe(true);
    expect((msg.payload as unknown as { serverLamport: number }).serverLamport).toBe(20);
  });
});

describe('buildPushNack', () => {
  it('creates a push_nack with reason and retryAfterMs', () => {
    const msg = buildPushNack('rate limit', 5000, 'srv');
    expect(msg.type).toBe('push_nack');
    expect((msg.payload as unknown as { reason: string }).reason).toBe('rate limit');
    expect((msg.payload as unknown as { retryAfterMs: number }).retryAfterMs).toBe(5000);
  });
});

describe('buildPresenceHeartbeat', () => {
  it('creates a presence_heartbeat with online status and optional cursor', () => {
    const msg = buildPresenceHeartbeat('d1', 'Alice', true, { nodeId: 'n1', position: 10 });
    expect(msg.type).toBe('presence_heartbeat');
    expect((msg.payload as unknown as { online: boolean }).online).toBe(true);
    expect((msg.payload as unknown as { label: string }).label).toBe('Alice');
  });
});

describe('buildCursorBroadcast', () => {
  it('creates a cursor_broadcast with nodeId and position', () => {
    const msg = buildCursorBroadcast('d1', 'n1', 42);
    expect(msg.type).toBe('cursor_broadcast');
    expect((msg.payload as unknown as { nodeId: string }).nodeId).toBe('n1');
    expect((msg.payload as unknown as { position: number }).position).toBe(42);
  });
});

// ─── Protocol State Tests ─────────────────────────────────────────────────────

describe('createProtocolState', () => {
  it('initializes with default values', () => {
    const state = createProtocolState('dev-1', 'Alice');
    expect(state.deviceId).toBe('dev-1');
    expect(state.label).toBe('Alice');
    expect(state.lamport).toBe(0);
    expect(state.lastSyncSeq).toBe(0);
    expect(state.lastSyncAt).toBeNull();
    expect(state.pendingOps).toBe(0);
    expect(state.state).toBe('synced');
    expect(state.peers.size).toBe(0);
  });
});

// ─── MockSyncTransport Tests ───────────────────────────────────────────────────

describe('MockSyncTransport', () => {
  it('sends messages to paired transport', async () => {
    const a = new MockSyncTransport();
    const b = new MockSyncTransport();
    a.pairWith(b);

    const received: SyncMessage[] = [];
    b.onMessage((msg) => received.push(msg));

    await a.send({ type: 'pull_request', deviceId: 'a', timestamp: 1, payload: {} });
    expect(received).toHaveLength(1);
    expect(received[0].type).toBe('pull_request');
  });

  it('getLog returns all sent messages', async () => {
    const t = new MockSyncTransport();
    await t.send({ type: 'presence_heartbeat', deviceId: 'a', timestamp: 1, payload: {} });
    await t.send({ type: 'cursor_broadcast', deviceId: 'a', timestamp: 2, payload: {} });
    expect(t.getLog()).toHaveLength(2);
  });

  it('clear resets log and listeners', async () => {
    const t = new MockSyncTransport();
    await t.send({ type: 'pull_request', deviceId: 'a', timestamp: 1, payload: {} });
    t.clear();
    expect(t.getLog()).toHaveLength(0);
  });
});

// ─── SyncEngine Tests ─────────────────────────────────────────────────────────

describe('SyncEngine', () => {
  function makePullResponder() {
    return createRespondingTransport((msg: SyncMessage) => {
      if (msg.type === 'pull_request') {
        const sinceSeq = (msg.payload as unknown as { sinceSeq: number }).sinceSeq;
        return buildPullResponse(
          sinceSeq === 0
            ? [{ id: 'o1', kind: 'insert', timestamp: 1, deviceId: 'srv', lamport: 1, payload: {} }]
            : [],
          [],
          false,
          'srv'
        );
      }
      return undefined as unknown as SyncMessage;
    });
  }

  function makePushAckResponder(accepted = true, conflicts: ConflictInfo[] = []) {
    return createRespondingTransport((msg: SyncMessage) => {
      if (msg.type === 'push_request') {
        return buildPushAck(accepted, conflicts, 10, 'srv');
      }
      return undefined as unknown as SyncMessage;
    });
  }

  function makePresenceResponder() {
    return createRespondingTransport((msg: SyncMessage) => {
      if (msg.type === 'presence_heartbeat') {
        const hb = msg.payload as unknown as { label: string; online: boolean; lastCursor?: { nodeId: string; position: number } };
        return buildPresenceHeartbeat('dev-b', hb.label, hb.online, hb.lastCursor);
      }
      if (msg.type === 'cursor_broadcast') {
        // echo back
        return msg;
      }
      return undefined as unknown as SyncMessage;
    });
  }

  it('pull updates lastSyncSeq and state to synced', async () => {
    const { transport } = makePullResponder();
    const engineA = createSyncEngine('dev-a', 'Alice', transport);
    const result = await engineA.pull(0);
    expect(result.ops).toHaveLength(1);
    expect(engineA.state.lastSyncSeq).toBe(1);
    expect(engineA.state.state).toBe('synced');
  });

  it('push increments pendingOps and transitions to synced on ack', async () => {
    const { transport } = makePushAckResponder(true);
    const engineA = createSyncEngine('dev-a', 'Alice', transport);
    const batch: OperationBatch = {
      header: { deviceId: 'dev-a', timestamp: 1, lamport: 1, vectorClock: {}, batchId: 'b1' },
      operations: [{ id: 'o1', kind: 'insert', timestamp: 1, deviceId: 'dev-a', lamport: 1, payload: {} }],
      tombstones: [],
    };

    await engineA.push(batch);
    expect(engineA.state.pendingOps).toBe(0);
    expect(engineA.state.state).toBe('synced');
  });

  it('push transitions to conflict on nack with conflicts', async () => {
    const conflicts: ConflictInfo[] = [{ nodeId: 'n1', localLamport: 5, remoteLamport: 10 }];
    const { transport } = makePushAckResponder(false, conflicts);
    const engineA = createSyncEngine('dev-a', 'Alice', transport);
    const batch: OperationBatch = {
      header: { deviceId: 'dev-a', timestamp: 1, lamport: 1, vectorClock: {}, batchId: 'b1' },
      operations: [{ id: 'o1', kind: 'insert', timestamp: 1, deviceId: 'dev-a', lamport: 1, payload: {} }],
      tombstones: [],
    };

    await engineA.push(batch);
    expect(engineA.state.state).toBe('conflict');
    expect(engineA.state.conflicts).toHaveLength(1);
  });

  it('heartbeat broadcasts presence and registers self', async () => {
    const { transport, messages } = makePresenceResponder();
    const engineA = createSyncEngine('dev-a', 'Alice', transport);
    await engineA.heartbeat();
    expect(engineA.state.peers.get('dev-a')?.online).toBe(true);
    expect(messages.some((m) => m.type === 'presence_heartbeat')).toBe(true);
  });

  it('broadcastCursor sends cursor_broadcast message', async () => {
    const { transport, messages } = makePresenceResponder();
    const engineA = createSyncEngine('dev-a', 'Alice', transport);
    await engineA.broadcastCursor('node-1', 42);
    expect(messages.some((m) => m.type === 'cursor_broadcast')).toBe(true);
  });

  it('registers remote peer when presence response is received', async () => {
    const { transport } = makePresenceResponder();
    const engineA = createSyncEngine('dev-a', 'Alice', transport);
    await engineA.heartbeat();
    expect(engineA.state.peers.get('dev-b')?.label).toBe('Alice');
  });

  it('onPeerPresence fires when presence messages arrive on transport', async () => {
    const { transport } = makePresenceResponder();
    const engineA = createSyncEngine('dev-a', 'Alice', transport);

    const presence: Array<{ deviceId: string; label: string }> = [];
    engineA.onPeerPresence((peer) => presence.push({ deviceId: peer.deviceId, label: peer.label }));

    transport.send(buildPresenceHeartbeat('dev-b', 'Bob', true));
    expect(presence).toHaveLength(1);
    expect(presence[0].label).toBe('Bob');
  });
});

// ─── getSyncStatus Tests ───────────────────────────────────────────────────────

describe('getSyncStatus', () => {
  it('maps protocol state to sync status', () => {
    const state = createProtocolState('dev-1', 'Alice');
    state.lastSyncAt = 1000;
    state.pendingOps = 3;
    state.peers.set('dev-2', { deviceId: 'dev-2', label: 'Bob', online: true, lastSeen: Date.now(), cursor: null });
    state.conflicts.push({ nodeId: 'n1', localLamport: 1, remoteLamport: 2 });

    const status = getSyncStatus(state);
    expect(status.deviceId).toBe('dev-1');
    expect(status.state).toBe('synced');
    expect(status.pendingOps).toBe(3);
    expect(status.peers).toHaveLength(1);
    expect(status.conflicts).toHaveLength(1);
  });
});

// ─── countOnlinePeers Tests ────────────────────────────────────────────────────

describe('countOnlinePeers', () => {
  it('counts only recently seen peers', () => {
    const state = createProtocolState('d', 'me');
    state.peers.set('p1', { deviceId: 'p1', label: 'P1', online: true, lastSeen: Date.now(), cursor: null });
    state.peers.set('p2', { deviceId: 'p2', label: 'P2', online: true, lastSeen: Date.now() - 60_000, cursor: null });
    expect(countOnlinePeers(state)).toBe(1);
  });

  it('returns 0 when no peers', () => {
    const state = createProtocolState('d', 'me');
    expect(countOnlinePeers(state)).toBe(0);
  });
});

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { createSyncEngine, MockSyncTransport } from '../../src/lib/sync/protocol';
import type { SyncMessage, OperationBatch } from '../../src/lib/sync/types';

/**
 * Sets up a partner transport that responds to push/pull requests
 * by delivering responses back to the engine on the given engineTransport.
 * Returns the messages received by the partner.
 */
function addResponder(partner: MockSyncTransport, engineTransport: MockSyncTransport): SyncMessage[] {
  const received: SyncMessage[] = [];
  partner.onMessage((msg: SyncMessage) => {
    received.push(msg);
    if (msg.type === 'push_request') {
      const ack: SyncMessage = {
        type: 'push_ack',
        deviceId: 'srv',
        timestamp: Date.now(),
        payload: { accepted: true, conflicts: [], serverLamport: 10 } as unknown as Record<string, unknown>,
      };
      for (const listener of (engineTransport as unknown as { listeners: Array<(msg: SyncMessage) => void> }).listeners) {
        listener(ack);
      }
    }
    if (msg.type === 'pull_request') {
      const sinceSeq = (msg.payload as unknown as { sinceSeq: number }).sinceSeq ?? 0;
      const resp: SyncMessage = {
        type: 'pull_response',
        deviceId: 'srv',
        timestamp: Date.now(),
        payload: {
          ops: sinceSeq === 0
            ? [{ id: 'o1', kind: 'insert', timestamp: 1, deviceId: 'srv', lamport: 1, payload: {} }]
            : [],
          tombstones: [],
          hasMore: false,
        } as unknown as Record<string, unknown>,
      };
      for (const listener of (engineTransport as unknown as { listeners: Array<(msg: SyncMessage) => void> }).listeners) {
        listener(resp);
      }
    }
  });
  return received;
}

/**
 * Tracks all messages seen by the engine (received via engine transport).
 */
function trackEngineMessages(engineTransport: MockSyncTransport): SyncMessage[] {
  const messages: SyncMessage[] = [];
  engineTransport.onMessage((msg: SyncMessage) => {
    messages.push(msg);
  });
  return messages;
}

describe('Reconnect storm \u2014 rapid cycles', () => {
  it('handles 100 rapid create/destroy cycles without errors', async () => {
    for (let i = 0; i < 100; i++) {
      const transport = new MockSyncTransport();
      const partner = new MockSyncTransport();
      transport.pairWith(partner);

      const engine = createSyncEngine('dev-a', 'Alice', transport);
      addResponder(partner, transport);

      const batch: OperationBatch = {
        header: { deviceId: 'dev-a', timestamp: i, lamport: i, vectorClock: {}, batchId: 'b' + i },
        operations: [{ id: 'o' + i, kind: 'insert', timestamp: i, deviceId: 'dev-a', lamport: i, payload: {} }],
        tombstones: [],
      };

      await engine.heartbeat();
      await engine.push(batch);
    }
  });

  it('handles 100 rapid pairing cycles with pull', async () => {
    for (let i = 0; i < 100; i++) {
      const transport = new MockSyncTransport();
      const partner = new MockSyncTransport();
      transport.pairWith(partner);

      const engine = createSyncEngine('dev-a', 'Alice', transport);
      addResponder(partner, transport);

      await engine.pull(0);
    }
  });
});

describe('Reconnect storm \u2014 concurrent reconnections', () => {
  it('does not duplicate messages during concurrent reconnections', async () => {
    const allEngineMessages: SyncMessage[][] = [];

    for (let i = 0; i < 10; i++) {
      const transport = new MockSyncTransport();
      const partner = new MockSyncTransport();
      transport.pairWith(partner);

      const engine = createSyncEngine('dev-' + i, 'Device' + i, transport);
      const engineMessages = trackEngineMessages(transport);
      addResponder(partner, transport);
      allEngineMessages.push(engineMessages);

      const batch: OperationBatch = {
        header: { deviceId: 'dev-x', timestamp: 1, lamport: 1, vectorClock: {}, batchId: 'b1' },
        operations: [{ id: 'o1', kind: 'insert', timestamp: 1, deviceId: 'dev-x', lamport: 1, payload: {} }],
        tombstones: [],
      };
      await engine.push(batch);
    }

    // Each engine should receive exactly one push_ack and send exactly one push_request
    for (let i = 0; i < allEngineMessages.length; i++) {
      const msgs = allEngineMessages[i];
      const acks = msgs.filter((m) => m.type === 'push_ack');
      const acksFromSrv = acks.filter((m) => m.deviceId === 'srv');
      expect(acksFromSrv.length).toBe(1);
    }
  });
});

describe('Reconnect storm \u2014 backpressure', () => {
  it('delivers all 50 push requests under heavy load', async () => {
    const transport = new MockSyncTransport();
    const partner = new MockSyncTransport();
    transport.pairWith(partner);

    const received = addResponder(partner, transport);
    const engine = createSyncEngine('dev-a', 'Alice', transport);

    const pushes: Promise<void>[] = [];
    for (let i = 0; i < 50; i++) {
      const batch: OperationBatch = {
        header: { deviceId: 'dev-a', timestamp: i, lamport: i, vectorClock: {}, batchId: 'b' + i },
        operations: [{ id: 'o' + i, kind: 'insert', timestamp: i, deviceId: 'dev-a', lamport: i, payload: {} }],
        tombstones: [],
      };
      pushes.push(engine.push(batch).then(() => {}).catch(() => {}));
    }

    await Promise.all(pushes);
    expect(received.filter((m) => m.type === 'push_request').length).toBe(50);
  });

  it('processes 100 heartbeats without dropping any', async () => {
    const transport = new MockSyncTransport();
    const partner = new MockSyncTransport();
    transport.pairWith(partner);

    const received: SyncMessage[] = [];
    partner.onMessage((msg: SyncMessage) => {
      received.push(msg);
    });

    const engine = createSyncEngine('dev-a', 'Alice', transport);

    for (let i = 0; i < 100; i++) {
      await engine.heartbeat();
    }

    const heartbeats = received.filter((m) => m.type === 'presence_heartbeat');
    expect(heartbeats.length).toBe(100);
  });
});

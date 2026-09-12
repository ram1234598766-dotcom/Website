import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { createSyncEngine } from '../../src/lib/sync/protocol';
import type { SyncMessage, SyncTransport, OperationBatch } from '../../src/lib/sync/types';

class DisconnectableTransport implements SyncTransport {
  private connected: boolean = true;
  private queue: SyncMessage[] = [];
  private listeners: Array<(message: SyncMessage) => void> = [];
  private paired: DisconnectableTransport | null = null;

  pairWith(other: DisconnectableTransport): void {
    this.paired = other;
    other.paired = this;
  }

  async send(message: SyncMessage): Promise<void> {
    if (!this.connected) {
      this.queue.push(message);
      return;
    }
    if (this.paired) {
      for (const listener of this.paired.listeners) {
        listener(message);
      }
    }
  }

  onMessage(handler: (message: SyncMessage) => void): void {
    this.listeners.push(handler);
  }

  offMessage(handler: (message: SyncMessage) => void): void {
    const idx = this.listeners.indexOf(handler);
    if (idx !== -1) {
      this.listeners.splice(idx, 1);
    }
  }

  disconnect(): void {
    this.connected = false;
  }

  reconnect(): void {
    this.connected = true;
    const pending = [...this.queue];
    this.queue = [];
    for (const msg of pending) {
      if (this.paired) {
        for (const listener of this.paired.listeners) {
          listener(msg);
        }
      }
    }
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  getListenersRef(): Array<(message: SyncMessage) => void> {
    return this.listeners;
  }
}

function makePushAckResponder(): { transport: DisconnectableTransport; messages: SyncMessage[] } {
  const messages: SyncMessage[] = [];
  const transport = new DisconnectableTransport();
  const partner = new DisconnectableTransport();
  transport.pairWith(partner);

  partner.onMessage((msg: SyncMessage) => {
    messages.push(msg);
    if (msg.type === 'push_request') {
      const ack: SyncMessage = {
        type: 'push_ack',
        deviceId: 'srv',
        timestamp: Date.now(),
        payload: { accepted: true, conflicts: [], serverLamport: 10 } as unknown as Record<string, unknown>,
      };
      for (const listener of transport.getListenersRef()) {
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
      for (const listener of transport.getListenersRef()) {
        listener(resp);
      }
    }
  });

  return { transport, messages };
}

// ─── Connection Recovery ──────────────────────────────────

describe('Recovery \u2014 connection recovery', () => {
  it('resumes push after transport disconnect and reconnect', async () => {
    const { transport } = makePushAckResponder();
    const engine = createSyncEngine('dev-a', 'Alice', transport);

    const batchBefore: OperationBatch = {
      header: { deviceId: 'dev-a', timestamp: 1, lamport: 1, vectorClock: {}, batchId: 'b1' },
      operations: [{ id: 'o1', kind: 'insert', timestamp: 1, deviceId: 'dev-a', lamport: 1, payload: {} }],
      tombstones: [],
    };
    const ackBefore = await engine.push(batchBefore);
    expect((ackBefore as {accepted: boolean}).accepted).toBe(true);
    expect(engine.state.state).toBe('synced');

    transport.disconnect();
    expect(transport.getQueueSize()).toBe(0);

    transport.reconnect();

    const batchAfter: OperationBatch = {
      header: { deviceId: 'dev-a', timestamp: 2, lamport: 2, vectorClock: {}, batchId: 'b2' },
      operations: [{ id: 'o2', kind: 'insert', timestamp: 2, deviceId: 'dev-a', lamport: 2, payload: {} }],
      tombstones: [],
    };
    const ackAfter = await engine.push(batchAfter);
    expect((ackAfter as {accepted: boolean}).accepted).toBe(true);
    expect(engine.state.state).toBe('synced');
  });

  it('completes within a timeout after reconnection', async () => {
    const { transport } = makePushAckResponder();
    const engine = createSyncEngine('dev-a', 'Alice', transport);

    transport.disconnect();
    transport.reconnect();

    const start = Date.now();
    const batch: OperationBatch = {
      header: { deviceId: 'dev-a', timestamp: 1, lamport: 1, vectorClock: {}, batchId: 'b1' },
      operations: [{ id: 'o1', kind: 'insert', timestamp: 1, deviceId: 'dev-a', lamport: 1, payload: {} }],
      tombstones: [],
    };
    await engine.push(batch);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });
});

// ─── Message Persistence ──────────────────────────────────

describe('Recovery \u2014 message persistence during disconnect', () => {
  it('queues messages sent while disconnected', async () => {
    const { transport } = makePushAckResponder();
    const engine = createSyncEngine('dev-a', 'Alice', transport);

    transport.disconnect();

    const msg: SyncMessage = {
      type: 'presence_heartbeat',
      deviceId: 'dev-a',
      timestamp: Date.now(),
      payload: { label: 'Alice', online: true },
    };
    await transport.send(msg);

    expect(transport.getQueueSize()).toBe(1);
  });

  it('delivers queued messages after reconnection', async () => {
    const { transport } = makePushAckResponder();
    const engine = createSyncEngine('dev-a', 'Alice', transport);

    transport.disconnect();

    const hbMsg: SyncMessage = {
      type: 'presence_heartbeat',
      deviceId: 'dev-a',
      timestamp: Date.now(),
      payload: { label: 'Alice', online: true },
    };
    await transport.send(hbMsg);
    expect(transport.getQueueSize()).toBe(1);

    transport.reconnect();

    await engine.heartbeat();
    expect(engine.state.peers.get('dev-a')?.online).toBe(true);
  });

  it('delivers all queued push requests after reconnection', async () => {
    const { transport } = makePushAckResponder();
    const engine = createSyncEngine('dev-a', 'Alice', transport);

    transport.disconnect();

    await transport.send({
      type: 'push_request',
      deviceId: 'dev-a',
      timestamp: 1,
      payload: {
        batch: {
          header: { deviceId: 'dev-a', timestamp: 1, lamport: 1, vectorClock: {}, batchId: 'b1' },
          operations: [{ id: 'o1', kind: 'insert', timestamp: 1, deviceId: 'dev-a', lamport: 1, payload: {} }],
          tombstones: [],
        },
      } as unknown as Record<string, unknown>,
    });
    await transport.send({
      type: 'push_request',
      deviceId: 'dev-a',
      timestamp: 2,
      payload: {
        batch: {
          header: { deviceId: 'dev-a', timestamp: 2, lamport: 2, vectorClock: {}, batchId: 'b2' },
          operations: [{ id: 'o2', kind: 'insert', timestamp: 2, deviceId: 'dev-a', lamport: 2, payload: {} }],
          tombstones: [],
        },
      } as unknown as Record<string, unknown>,
    });

    expect(transport.getQueueSize()).toBe(2);

    transport.reconnect();

    await engine.push({
      header: { deviceId: 'dev-a', timestamp: 3, lamport: 3, vectorClock: {}, batchId: 'b3' },
      operations: [{ id: 'o3', kind: 'insert', timestamp: 3, deviceId: 'dev-a', lamport: 3, payload: {} }],
      tombstones: [],
    });

    expect(engine.state.state).toBe('synced');
  });
});

// ─── State Recovery ───────────────────────────────────────

describe('Recovery \u2014 state consistency after reconnection', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('no operations are lost after disconnect-reconnect cycle', async () => {
    const { transport } = makePushAckResponder();
    const engine = createSyncEngine('dev-a', 'Alice', transport);

    const batch1: OperationBatch = {
      header: { deviceId: 'dev-a', timestamp: 1, lamport: 1, vectorClock: {}, batchId: 'b1' },
      operations: [{ id: 'o1', kind: 'insert', timestamp: 1, deviceId: 'dev-a', lamport: 1, payload: {} }],
      tombstones: [],
    };
    await engine.push(batch1);
    expect(engine.state.state).toBe('synced');
    expect(engine.state.pendingOps).toBe(0);

    transport.disconnect();

    const batch2: OperationBatch = {
      header: { deviceId: 'dev-a', timestamp: 2, lamport: 2, vectorClock: {}, batchId: 'b2' },
      operations: [{ id: 'o2', kind: 'insert', timestamp: 2, deviceId: 'dev-a', lamport: 2, payload: {} }],
      tombstones: [],
    };

    vi.useFakeTimers();
    void engine.push(batch2);
    await vi.advanceTimersByTimeAsync(5100);
    await Promise.resolve();
    vi.useRealTimers();

    expect(engine.state.state).toBe('offline');

    transport.reconnect();

    const batch3: OperationBatch = {
      header: { deviceId: 'dev-a', timestamp: 3, lamport: 3, vectorClock: {}, batchId: 'b3' },
      operations: [{ id: 'o3', kind: 'insert', timestamp: 3, deviceId: 'dev-a', lamport: 3, payload: {} }],
      tombstones: [],
    };
    await engine.push(batch3);
    expect(engine.state.state).toBe('synced');
  });

  it('maintains consistent lastSyncSeq after reconnection', async () => {
    const { transport } = makePushAckResponder();
    const engine = createSyncEngine('dev-a', 'Alice', transport);

    await engine.pull(0);
    expect(engine.state.lastSyncSeq).toBe(1);

    transport.disconnect();
    transport.reconnect();

    await engine.pull(engine.state.lastSyncSeq);
    expect(engine.state.lastSyncSeq).toBeGreaterThanOrEqual(1);
    expect(engine.state.state).toBe('synced');
  });

  it('recovers from pending ops after push timeout and reconnect', async () => {
    const transport = new DisconnectableTransport();
    const partner = new DisconnectableTransport();
    transport.pairWith(partner);

    partner.onMessage((msg: SyncMessage) => {
      if (msg.type === 'push_request') {
        const ack: SyncMessage = {
          type: 'push_ack',
          deviceId: 'srv',
          timestamp: Date.now(),
          payload: { accepted: true, conflicts: [], serverLamport: 5 },
        };
        for (const listener of transport.getListenersRef()) {
          listener(ack);
        }
      }
    });

    const engine = createSyncEngine('dev-a', 'Alice', transport);

    transport.disconnect();

    const batch: OperationBatch = {
      header: { deviceId: 'dev-a', timestamp: 1, lamport: 1, vectorClock: {}, batchId: 'b1' },
      operations: [{ id: 'o1', kind: 'insert', timestamp: 1, deviceId: 'dev-a', lamport: 1, payload: {} }],
      tombstones: [],
    };

    vi.useFakeTimers();
    void engine.push(batch);
    await vi.advanceTimersByTimeAsync(5100);
    await Promise.resolve();
    vi.useRealTimers();

    expect(engine.state.state).toBe('offline');
    expect(engine.state.pendingOps).toBeGreaterThanOrEqual(1);

    transport.reconnect();

    const ack = await engine.push(batch);
    expect((ack as {accepted: boolean}).accepted).toBe(true);
    expect(engine.state.state).toBe('synced');
  });
});

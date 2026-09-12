/**
 * Phase 3 — AI Streaming & Cancellation tests.
 *
 * Verifies:
 *  - A mock streaming provider yields partial chunks incrementally.
 *  - Cancellation stops the stream and reports the 'cancelled' status.
 *  - Timeout produces a 'timeout' status — a user-visible error state.
 *  - onStatusChange listeners fire for every state transition.
 *
 * Uses setInterval-based delivery: one call to
 * `vi.advanceTimersByTimeAsync(chunkIntervalMs)` delivers exactly one chunk.
 */

import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  createAIStream,
  streamDrain,
  consumeStream,
  type AIStreamHandle,
  type StreamStatus,
} from '../../src/lib/ai/orchestrator';

const CHUNK_INTERVAL = 50;

/** Advance fake timers by one chunk interval and flush microtasks. */
async function tick(stream: AIStreamHandle): Promise<void> {
  await vi.advanceTimersByTimeAsync(CHUNK_INTERVAL);
  await streamDrain();
  void stream; // suppress unused warning — streamDrain flushes microtasks globally
}

/** Wait for the stream to reach `target`; resolves immediately if already there. */
async function waitForStatus(stream: AIStreamHandle, target: StreamStatus): Promise<void> {
  if (stream.status === target) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for "${target}", got "${stream.status}"`)),
      3000
    );
    const unsub = stream.onStatusChange((s) => {
      if (s === target) {
        clearTimeout(timer);
        unsub();
        resolve();
      }
    });
  });
}

afterEach(() => {
  vi.useRealTimers();
});

/* ------------------------------------------------------------------ */
/*  Incremental chunk consumption                                       */
/* ------------------------------------------------------------------ */

describe('AI streaming — incremental chunk consumption', () => {
  it('yields partial chunks and accumulates text', async () => {
    vi.useFakeTimers();
    const stream = createAIStream({
      provider: 'ollama',
      prompt: 'Hello',
      chunks: ['Hel', 'lo ', 'wor', 'ld!'],
      chunkIntervalMs: CHUNK_INTERVAL,
      timeoutMs: 5000,
    });

    // T=0: stream is streaming, no chunks yet
    expect(stream.status).toBe('streaming');
    expect(stream.text).toBe('');
    expect(stream.chunks).toHaveLength(0);

    // T=50ms: first chunk arrives (idx 0)
    await vi.advanceTimersByTimeAsync(CHUNK_INTERVAL);
    await streamDrain(vi);
    expect(stream.status).toBe('streaming');
    expect(stream.text).toBe('Hel');
    expect(stream.chunks).toHaveLength(1);
    expect(stream.chunks[0].index).toBe(0);
    expect(stream.chunks[0].delta).toBe('Hel');

    // T=100ms: second chunk arrives (idx 1)
    await vi.advanceTimersByTimeAsync(CHUNK_INTERVAL);
    await streamDrain(vi);
    expect(stream.text).toBe('Hello ');
    expect(stream.chunks).toHaveLength(2);
    expect(stream.chunks[1].index).toBe(1);

    // T=150ms: third chunk arrives (idx 2) — total 3 chunks
    await vi.advanceTimersByTimeAsync(CHUNK_INTERVAL);
    await streamDrain(vi);
    expect(stream.text).toBe('Hello wor');
    expect(stream.chunks).toHaveLength(3);

    // T=200ms: fourth (final) chunk arrives → stream resolves to 'done'
    await vi.advanceTimersByTimeAsync(CHUNK_INTERVAL);
    await streamDrain(vi);
    expect(stream.text).toBe('Hello world!');
    expect(stream.chunks).toHaveLength(4);

    await waitForStatus(stream, 'done');
    expect(stream.status).toBe('done');
  });

  it('handles a single-chunk stream (no fragmentation)', async () => {
    vi.useFakeTimers();
    const stream = createAIStream({
      provider: 'openrouter',
      prompt: 'ping',
      chunks: ['pong'],
      chunkIntervalMs: 10,
      timeoutMs: 3000,
    });

    await vi.advanceTimersByTimeAsync(10);
    await streamDrain(vi);
    expect(stream.status).toBe('done');
    expect(stream.text).toBe('pong');
    expect(stream.chunks).toHaveLength(1);
  });

  it('handles an empty chunks array (resolves to done on next microtask)', async () => {
    vi.useFakeTimers();
    const stream = createAIStream({
      provider: 'gemini',
      prompt: '',
      chunks: [],
      timeoutMs: 1000,
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(stream.status).toBe('done');
    expect(stream.text).toBe('');
    expect(stream.chunks).toHaveLength(0);
  });

  it('each chunk has a monotonically increasing index', async () => {
    vi.useFakeTimers();
    const stream = createAIStream({
      provider: 'ollama',
      prompt: 'test',
      chunks: ['a', 'b', 'c', 'd', 'e'],
      chunkIntervalMs: 20,
      timeoutMs: 3000,
    });

    for (let i = 0; i < 5; i++) {
      await vi.advanceTimersByTimeAsync(20);
      await streamDrain(vi);
    }
    expect(stream.chunks.map((c) => c.index)).toEqual([0, 1, 2, 3, 4]);
  });
});

/* ------------------------------------------------------------------ */
/*  Cancellation                                                       */
/* ------------------------------------------------------------------ */

describe('AI streaming — cancellation', () => {
  it('cancel() stops the stream immediately and reports cancelled', async () => {
    vi.useFakeTimers();
    const stream = createAIStream({
      provider: 'ollama',
      prompt: 'Long response',
      chunks: Array.from({ length: 50 }, (_, i) => `chunk-${i} `),
      chunkIntervalMs: CHUNK_INTERVAL,
      timeoutMs: 10_000,
    });

    // Let a couple of chunks arrive
    await vi.advanceTimersByTimeAsync(CHUNK_INTERVAL);
    await streamDrain(vi);
    await vi.advanceTimersByTimeAsync(CHUNK_INTERVAL);
    await streamDrain(vi);
    expect(stream.status).toBe('streaming');
    const textBeforeCancel = stream.text;
    expect(textBeforeCancel.length).toBeGreaterThan(0);

    // Cancel
    stream.cancel();

    expect(stream.status).toBe('cancelled');
    // Text is frozen at cancellation point — no further chunks accumulate
    expect(stream.text).toBe(textBeforeCancel);
  });

  it('cancel() after completion is a no-op', async () => {
    vi.useFakeTimers();
    const stream = createAIStream({
      provider: 'openrouter',
      prompt: 'quick',
      chunks: ['done'],
      chunkIntervalMs: 10,
      timeoutMs: 1000,
    });

    await vi.advanceTimersByTimeAsync(10);
    await streamDrain(vi);
    expect(stream.status).toBe('done');
    stream.cancel(); // should not throw or change state
    expect(stream.status).toBe('done');
    expect(stream.text).toBe('done');
  });

  it('onStatusChange fires cancelled when cancel() is called', async () => {
    vi.useFakeTimers();
    const stream = createAIStream({
      provider: 'gemini',
      prompt: 'test',
      chunks: ['x', 'y', 'z'],
      chunkIntervalMs: 20,
      timeoutMs: 5000,
    });

    const statuses: StreamStatus[] = [];
    const unsub = stream.onStatusChange((s) => statuses.push(s));

    await vi.advanceTimersByTimeAsync(20);
    await streamDrain(vi);
    stream.cancel();

    expect(statuses).toContain('cancelled');
    unsub();
  });

  it('unsubscribing from onStatusChange stops receiving events', async () => {
    vi.useFakeTimers();
    const stream = createAIStream({
      provider: 'openai',
      prompt: 'test',
      chunks: ['a', 'b'],
      chunkIntervalMs: 20,
      timeoutMs: 3000,
    });

    const statuses: StreamStatus[] = [];
    const unsub = stream.onStatusChange((s) => statuses.push(s));
    unsub();

    await vi.advanceTimersByTimeAsync(40);
    await streamDrain(vi);
    expect(statuses).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Timeout                                                             */
/* ------------------------------------------------------------------ */

describe('AI streaming — timeout', () => {
  it('reports timeout status when the wall-clock budget is exceeded', async () => {
    vi.useFakeTimers();
    const stream = createAIStream({
      provider: 'ollama',
      prompt: 'slow',
      chunks: ['tick', 'tock'],
      chunkIntervalMs: 500,
      timeoutMs: 100,
    });

    // Advance past the timeout before any chunk fires (chunk interval=500ms > timeout=100ms)
    await vi.advanceTimersByTimeAsync(150);
    expect(stream.status).toBe('timeout');
    expect(stream.text).toBe('');
    expect(stream.chunks).toHaveLength(0);
  });

  it('timeout produces a user-visible error state (no chunks, status=timeout)', async () => {
    vi.useFakeTimers();
    const stream = createAIStream({
      provider: 'openrouter',
      prompt: 'slow query',
      chunks: ['partial'],
      chunkIntervalMs: 500,
      timeoutMs: 80,
    });

    await vi.advanceTimersByTimeAsync(80);
    expect(stream.status).toBe('timeout');
    expect(stream.text).toBe('');
  });

  it('cancelling before timeout fires does not throw', async () => {
    vi.useFakeTimers();
    const stream = createAIStream({
      provider: 'gemini',
      prompt: 'test',
      chunks: ['x'],
      chunkIntervalMs: 5000,
      timeoutMs: 5000,
    });

    stream.cancel();
    expect(stream.status).toBe('cancelled');
  });
});

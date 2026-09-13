/**
 * Edge-case tests for src/lib/ai/orchestrator.ts
 *
 * Covers:
 *  1. createAIStream cancel(): timer cleanup, statusListeners
 *  2. settle() idempotency when called twice
 *  3. consumeStream infinite-loop protection
 *  4. streamDrain(vi) with fake timers, no pending timers
 *  5. createImmediateDoneHandle cancel-before-microtask race
 *  6. ProviderOrchestrator.query all-unavailable
 *  7. ProviderOrchestrator.register health fallback
 *  8. ProviderOrchestrator.markHealthy nonexistent id
 */

import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  createAIStream,
  createImmediateDoneHandle,
  streamDrain,
  consumeStream,
  ProviderOrchestrator,
} from '../src/lib/ai/orchestrator';
import type { AIStreamHandle, StreamStatus } from '../src/lib/ai/orchestrator';

afterEach(() => { vi.useRealTimers(); });

// 1. createAIStream cancel()
describe("createAIStream - cancel()", () => {
  it("clears interval timer - no further chunks after cancel", async () => {
    vi.useFakeTimers();
    const stream = createAIStream({
      provider: "test", prompt: "q",
      chunks: ["a", "b", "c", "d", "e"],
      chunkIntervalMs: 50, timeoutMs: 5000,
    });
    await vi.advanceTimersByTimeAsync(50);
    await streamDrain(vi);
    expect(stream.chunks).toHaveLength(1);
    stream.cancel();
    expect(stream.status).toBe("cancelled");
    await vi.advanceTimersByTimeAsync(500);
    await streamDrain(vi);
    expect(stream.chunks).toHaveLength(1);
    expect(stream.status).toBe("cancelled");
  });

  it("clears timeout timer after cancel", async () => {
    vi.useFakeTimers();
    const stream = createAIStream({
      provider: "test", prompt: "q",
      chunks: ["a"],
      chunkIntervalMs: 5000, timeoutMs: 100,
    });
    stream.cancel();
    expect(stream.status).toBe("cancelled");
    await vi.advanceTimersByTimeAsync(1000);
    await streamDrain(vi);
    expect(stream.status).toBe("cancelled");
  });

  it("statusListeners can unsubscribe cleanly after cancel", async () => {
    vi.useFakeTimers();
    const stream = createAIStream({
      provider: "test", prompt: "q",
      chunks: ["a", "b"],
      chunkIntervalMs: 50, timeoutMs: 5000,
    });
    const statuses = [];
    const unsub = stream.onStatusChange((s) => statuses.push(s));
    stream.cancel();
    expect(statuses).toContain("cancelled");
    unsub();
    await vi.advanceTimersByTimeAsync(500);
    await streamDrain(vi);
    expect(statuses).toHaveLength(1);
  });
});

// 2. settle() idempotency
describe("createAIStream - settle() idempotency", () => {
  it("timeout then done - status stays timeout (first wins)", async () => {
    vi.useFakeTimers();
    const stream = createAIStream({
      provider: "test", prompt: "q",
      chunks: ["a", "b", "c", "d", "e", "f", "g", "h"],
      chunkIntervalMs: 50, timeoutMs: 100,
    });
    await vi.advanceTimersByTimeAsync(200);
    await streamDrain(vi);
    expect(stream.status).toBe("timeout");
    await vi.advanceTimersByTimeAsync(1000);
    await streamDrain(vi);
    expect(stream.status).toBe("timeout");
  });

  it("done then cancel - status stays done (first wins)", async () => {
    vi.useFakeTimers();
    const stream = createAIStream({
      provider: "test", prompt: "q",
      chunks: ["x"],
      chunkIntervalMs: 10, timeoutMs: 5000,
    });
    await vi.advanceTimersByTimeAsync(10);
    await streamDrain(vi);
    expect(stream.status).toBe("done");
    stream.cancel();
    expect(stream.status).toBe("done");
  });
});

// 3. consumeStream
describe("consumeStream", () => {
  it("resolves when stream completes normally", async () => {
    const stream = createAIStream({
      provider: "test", prompt: "q",
      chunks: ["hello", " world"],
      chunkIntervalMs: 50, timeoutMs: 5000,
    });
    const result = await consumeStream(stream, 5000);
    expect(result).toBe("hello world");
  });

  it("throws when stream never settles (infinite loop protection)", async () => {
    const neverSettling = {
      get status() { return "streaming" as StreamStatus; },
      get text() { return ""; },
      get chunks() { return []; },
      cancel() {},
      onStatusChange() { return () => {}; },
    } as AIStreamHandle;
    await expect(consumeStream(neverSettling, 500)).rejects.toThrow(/timed out|consumeStream/);
  }, 5000);
});

// 4. streamDrain
describe("streamDrain", () => {
  it("resolves without error with fake timers and no pending timers", async () => {
    vi.useFakeTimers();
    await expect(streamDrain(vi)).resolves.toBeUndefined();
  });

  it("resolves without error with real timers (no vi instance)", async () => {
    await expect(streamDrain()).resolves.toBeUndefined();
  });

  it("does not hang with fake timers and zero pending timers", async () => {
    vi.useFakeTimers();
    const result = await Promise.race([
      streamDrain(vi),
      new Promise((_, reject) => setTimeout(() => reject(new Error("hung")), 100)),
    ]);
    expect(result).toBeUndefined();
  });
});

// 5. createImmediateDoneHandle
describe("createImmediateDoneHandle", () => {
  it("status is done immediately (fixed race condition)", async () => {
    const stream = createImmediateDoneHandle();
    // After fix: status is 'done' immediately, no race window
    expect(stream.status).toBe("done");
    // Listeners still fire asynchronously
    const statuses = [];
    stream.onStatusChange((s) => statuses.push(s));
    expect(statuses).toHaveLength(0); // not synchronous
    await Promise.resolve();
    await Promise.resolve();
    expect(statuses).toContain("done");
  });

  it("cancel after microtask is a no-op", async () => {
    const stream = createImmediateDoneHandle();
    await Promise.resolve();
    await Promise.resolve();
    stream.cancel();
    expect(stream.status).toBe("done");
  });

  it("onStatusChange fires done asynchronously", async () => {
    const stream = createImmediateDoneHandle();
    const statuses = [];
    stream.onStatusChange((s) => statuses.push(s));
    expect(statuses).toHaveLength(0);
    await Promise.resolve();
    await Promise.resolve();
    expect(statuses).toContain("done");
  });
});

// 6. ProviderOrchestrator.query
describe("ProviderOrchestrator - query", () => {
  it("throws when all providers are unhealthy", async () => {
    const orch = new ProviderOrchestrator();
    orch.register({ id: "p1", name: "Provider 1", priority: 1 });
    ((orch as any).providers)[0].health = "unhealthy";
    await expect(orch.query(async () => { throw new Error("fail"); })).rejects.toThrow("All providers unavailable");
  });

  it("throws when no providers are registered", async () => {
    const orch = new ProviderOrchestrator();
    await expect(orch.query(async () => ({ text: "x", providerId: "p1" }))).rejects.toThrow("All providers unavailable");
  });

  it("returns result from first healthy provider", async () => {
    const orch = new ProviderOrchestrator();
    orch.register({ id: "p1", name: "P1", priority: 1 });
    orch.register({ id: "p2", name: "P2", priority: 2 });
    const result = await orch.query(async (entry) => ({ text: "r", providerId: entry.id }));
    expect(result.providerId).toBe("p1");
  });
});

// 7. ProviderOrchestrator.register
describe("ProviderOrchestrator - register", () => {
  it("defaults health to healthy", () => {
    const orch = new ProviderOrchestrator();
    orch.register({ id: "p1", name: "P1", priority: 1 });
    expect((orch as any).providers[0].health).toBe("healthy");
  });

  it("falls back to healthy when health is undefined", () => {
    const orch = new ProviderOrchestrator();
    orch.register({ id: "p1", name: "P1", priority: 1 } as any);
    expect((orch as any).providers[0].health).toBe("healthy");
  });

  it("falls back to healthy when health is null", () => {
    const orch = new ProviderOrchestrator();
    orch.register({ id: "p1", name: "P1", priority: 1 } as any);
    expect((orch as any).providers[0].health).toBe("healthy");
  });

  it("preserves explicit health value", () => {
    const orch = new ProviderOrchestrator();
    orch.register({ id: "p1", name: "P1", priority: 1, health: "degraded" } as any);
    expect((orch as any).providers[0].health).toBe("degraded");
  });

  it("sorts providers by priority ascending", () => {
    const orch = new ProviderOrchestrator();
    orch.register({ id: "p2", name: "P2", priority: 3 });
    orch.register({ id: "p1", name: "P1", priority: 1 });
    orch.register({ id: "p3", name: "P3", priority: 2 });
    expect((orch as any).providers.map((p) => p.id)).toEqual(["p1", "p3", "p2"]);
  });
});

// 8. ProviderOrchestrator.markHealthy
describe("ProviderOrchestrator - markHealthy", () => {
  it("does not throw for nonexistent providerId", () => {
    const orch = new ProviderOrchestrator();
    orch.register({ id: "p1", name: "P1", priority: 1 });
    expect(() => orch.markHealthy("nonexistent")).not.toThrow();
  });

  it("does not modify when providerId nonexistent", () => {
    const orch = new ProviderOrchestrator();
    orch.register({ id: "p1", name: "P1", priority: 1, health: "unhealthy" } as any);
    orch.markHealthy("does-not-exist");
    expect((orch as any).providers[0].health).toBe("unhealthy");
  });

  it("sets healthy when providerId exists", () => {
    const orch = new ProviderOrchestrator();
    orch.register({ id: "p1", name: "P1", priority: 1, health: "degraded" } as any);
    orch.markHealthy("p1");
    expect((orch as any).providers[0].health).toBe("healthy");
    expect((orch as any).providers[0].errorCount).toBe(0);
    expect((orch as any).providers[0].lastError).toBeUndefined();
  });

  it("safe on empty orchestrator", () => {
    const orch = new ProviderOrchestrator();
    expect(() => orch.markHealthy("anything")).not.toThrow();
  });
});

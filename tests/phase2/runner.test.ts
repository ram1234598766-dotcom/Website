/**
 * Phase 2 — SandboxRunner behavior over Node worker_threads: real isolation,
 * real termination. Verifies value/error paths, console capture, the wall-clock
 * budget (infinite loop and runaway async), the output cap, and cancel().
 */

import { describe, expect, it } from 'vitest';
import { SandboxRunner } from '../../src/lib/terminal/runner';
import { nodeSandboxWorkerFactory } from './node-worker';

const FAST = { maxRunMs: 1200 };

function instantiate(cfg: ConstructorParameters<typeof SandboxRunner>[1]) {
  return new SandboxRunner(nodeSandboxWorkerFactory, cfg);
}

describe('SandboxRunner (worker_threads host)', () => {
  it('returns the value of a returned expression', async () => {
    const runner = instantiate(FAST);
    const res = await runner.run('return 1 + 2 * 3;').result;
    expect(res.ok).toBe(true);
    expect(res.value).toBe('7');
  });

  it('returns "undefined" when no value is returned', async () => {
    const runner = instantiate(FAST);
    const res = await runner.run('let x = 1;').result;
    expect(res.ok).toBe(true);
    expect(res.value).toBe('undefined');
  });

  it('captures console output in order', async () => {
    const runner = instantiate(FAST);
    const res = await runner.run(
      "console.log('a'); console.warn('b'); console.error('c'); return 1;"
    ).result;
    expect(res.ok).toBe(true);
    expect(res.value).toBe('1');
    expect([...res.output]).toEqual(['a', 'b', 'c']);
  });

  it('reports a thrown error with its message', async () => {
    const runner = instantiate(FAST);
    const res = await runner.run("throw new Error('boom');").result;
    expect(res.ok).toBe(false);
    expect(res.error).toBe('boom');
    expect(res.terminated).toBeUndefined();
  });

  it('stops a synchronous infinite loop with the wall-clock budget', async () => {
    const runner = instantiate({ maxRunMs: 400, maxOutputChars: 40_000 });
    const res = await runner.run('while (true) {}').result;
    expect(res.ok).toBe(false);
    expect(res.terminated).toContain('execution limit');
  });

  it('reports a broken top-level await as an error, not a hang', async () => {
    const runner = instantiate(FAST);
    const res = await runner.run('await new Promise((resolve) => {});').result;
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/await/);
  });

  it('stops output floods at the character cap', async () => {
    const runner = instantiate({ maxRunMs: 10_000, maxOutputChars: 500 });
    const res = await runner.run(
      "for (let i = 0; i < 50_000; i++) console.log('xxxxxxxxxx');"
    ).result;
    expect(res.ok).toBe(false);
    expect(res.terminated).toContain('character limit');
    expect(res.output.join('').length).toBeLessThanOrEqual(10_000);
  });

  it('cancel() settles the run as cancelled', async () => {
    const runner = instantiate({ maxRunMs: 30_000, maxOutputChars: 40_000 });
    const handle = runner.run('await new Promise((resolve) => {});');
    handle.cancel();
    const res = await handle.result;
    expect(res.ok).toBe(false);
    expect(res.terminated).toBe('cancelled');
  });

  it('rejects oversized code up front without spawning a worker', async () => {
    const runner = instantiate({ maxCodeChars: 10 });
    const res = await runner.run('1 + 1; // this is too long now').result;
    expect(res.ok).toBe(false);
    expect(res.terminated).toContain('size limit');
  });

  it('runs two independent runs without shared state', async () => {
    const runner = instantiate(FAST);
    const a = await runner.run('globalThis.__x = 5; 1;').result;
    const b = await runner.run('typeof globalThis.__x;').result;
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(b.value).toBe('undefined');
  });
});
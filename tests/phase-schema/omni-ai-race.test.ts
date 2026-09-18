import { describe, expect, it, vi, afterEach } from 'vitest';
import { raceQuery, type RaceWinner } from '../../src/lib/ai/race-router';

afterEach(() => {
  vi.restoreAllMocks();
});

function delayedResult(value: string, ms: number): Promise<string> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}
function delayedReject(error: unknown, ms: number): Promise<string> {
  return new Promise((_, reject) => setTimeout(() => reject(error), ms));
}

// ─── 1. WebModel wins the race ─────────────────────────────────────

describe('raceQuery — WebModel wins', () => {
  it('WebModel succeeds fast, Gemini succeeds slow → WebModel wins', async () => {
    const webmodelFn = vi.fn(() => delayedResult('webmodel answer', 20)) as () => Promise<string>;
    const geminiFn = vi.fn(() => delayedResult('gemini answer', 100)) as () => Promise<string>;

    const result = await raceQuery(webmodelFn, geminiFn);

    expect(result.winner).toBe('webmodel');
    expect(result.text).toBe('webmodel answer');
    expect(webmodelFn).toHaveBeenCalledTimes(1);
    expect(geminiFn).toHaveBeenCalledTimes(1);
  });

  it('WebModel succeeds, Gemini rejects → WebModel wins silently', async () => {
    const webmodelFn = vi.fn(() => delayedResult('webmodel answer', 30)) as () => Promise<string>;
    const geminiFn = vi.fn(() => delayedReject(new Error('gemini down'), 50)) as () => Promise<string>;

    const result = await raceQuery(webmodelFn, geminiFn);

    expect(result.winner).toBe('webmodel');
    expect(result.text).toBe('webmodel answer');
  });
});

// ─── 2. Gemini wins the race ────────────────────────────────────────

describe('raceQuery — Gemini wins', () => {
  it('WebModel rejects fast, Gemini succeeds slow → Gemini wins', async () => {
    const webmodelFn = vi.fn(() => delayedReject(new Error('webmodel failed'), 20)) as () => Promise<string>;
    const geminiFn = vi.fn(() => delayedResult('gemini answer', 100)) as () => Promise<string>;

    const result = await raceQuery(webmodelFn, geminiFn);

    expect(result.winner).toBe('gemini');
    expect(result.text).toBe('gemini answer');
  });

  it('WebModel rejects slow, Gemini succeeds fast → Gemini wins', async () => {
    const webmodelFn = vi.fn(() => delayedReject(new Error('webmodel failed'), 100)) as () => Promise<string>;
    const geminiFn = vi.fn(() => delayedResult('gemini answer', 30)) as () => Promise<string>;

    const result = await raceQuery(webmodelFn, geminiFn);

    expect(result.winner).toBe('gemini');
    expect(result.text).toBe('gemini answer');
  });

  it('WebModel succeeds slow, Gemini succeeds fast → Gemini wins', async () => {
    const webmodelFn = vi.fn(() => delayedResult('webmodel answer', 100)) as () => Promise<string>;
    const geminiFn = vi.fn(() => delayedResult('gemini answer', 20)) as () => Promise<string>;

    const result = await raceQuery(webmodelFn, geminiFn);

    expect(result.winner).toBe('gemini');
    expect(result.text).toBe('gemini answer');
  });
});

// ─── 3. Both fail → AggregateError ──────────────────────────────────

describe('raceQuery — both fail', () => {
  it('throws when both reject', async () => {
    const webmodelFn = vi.fn(() => delayedReject(new Error('webmodel error'), 20)) as () => Promise<string>;
    const geminiFn = vi.fn(() => delayedReject(new Error('gemini error'), 30)) as () => Promise<string>;

    await expect(raceQuery(webmodelFn, geminiFn)).rejects.toThrow();
  });

  it('AggregateError contains both errors', async () => {
    const webErr = new Error('webmodel down');
    const gemErr = new Error('gemini down');
    const webmodelFn = vi.fn(() => delayedReject(webErr, 20)) as () => Promise<string>;
    const geminiFn = vi.fn(() => delayedReject(gemErr, 30)) as () => Promise<string>;

    try {
      await raceQuery(webmodelFn, geminiFn);
      expect.fail('should have thrown');
    } catch (err: any) {
      expect(err.name).toBe('AggregateError');
      expect(err.errors).toHaveLength(2);
    }
  });

  it('both provider functions are invoked', async () => {
    const webmodelFn = vi.fn(() => delayedReject(new Error('wm'), 20)) as () => Promise<string>;
    const geminiFn = vi.fn(() => delayedReject(new Error('gemini'), 30)) as () => Promise<string>;

    try {
      await raceQuery(webmodelFn, geminiFn);
    } catch {
      /* expected */
    }

    expect(webmodelFn).toHaveBeenCalledTimes(1);
    expect(geminiFn).toHaveBeenCalledTimes(1);
  });
});

// ─── 4. Edge cases ──────────────────────────────────────────────────

describe('raceQuery — edge cases', () => {
  it('near-simultaneous resolves: one wins deterministically', async () => {
    const webmodelFn = vi.fn(() => Promise.resolve('wm')) as () => Promise<string>;
    const geminiFn = vi.fn(() => Promise.resolve('gemini')) as () => Promise<string>;

    const result = await raceQuery(webmodelFn, geminiFn);

    expect(result.winner).toBeDefined();
    expect(['webmodel', 'gemini']).toContain(result.winner as RaceWinner);
    if (result.winner === 'webmodel') {
      expect(result.text).toBe('wm');
    } else {
      expect(result.text).toBe('gemini');
    }
  });

  it('concurrent independent races share no state', async () => {
    const webmodelFn1 = vi.fn(() => delayedResult('wm1', 20)) as () => Promise<string>;
    const geminiFn1 = vi.fn(() => delayedResult('gem1', 100)) as () => Promise<string>;
    const webmodelFn2 = vi.fn(() => delayedResult('wm2', 30)) as () => Promise<string>;
    const geminiFn2 = vi.fn(() => delayedResult('gem2', 150)) as () => Promise<string>;

    const [result1, result2] = await Promise.all([
      raceQuery(webmodelFn1, geminiFn1),
      raceQuery(webmodelFn2, geminiFn2),
    ]);

    expect(result1.winner).toBe('webmodel');
    expect(result1.text).toBe('wm1');
    expect(result2.winner).toBe('webmodel');
    expect(result2.text).toBe('wm2');
  });

  it('AggregateError when both reject with non-Error strings', async () => {
    const webmodelFn = vi.fn(() => Promise.reject('string error')) as () => Promise<string>;
    const geminiFn = vi.fn(() => Promise.reject('another string')) as () => Promise<string>;

    try {
      await raceQuery(webmodelFn, geminiFn);
      expect.fail('should have thrown');
    } catch (err: any) {
      expect(err.name).toBe('AggregateError');
      expect(err.errors).toBeDefined();
      expect(err.errors.length).toBe(2);
    }
  });
});

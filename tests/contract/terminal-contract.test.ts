import { describe, it, expect } from 'vitest';
import { buildSandboxWorkerSource } from '../../src/lib/terminal/runner';

describe('buildSandboxWorkerSource() contract', () => {
  it('returns a string containing sboxRun and postMessage', () => {
    const source = buildSandboxWorkerSource();

    expect(typeof source).toBe('string');
    expect(source.length).toBeGreaterThan(0);
    expect(source).toContain('sboxRun');
    expect(source).toContain('postMessage');
  });

  it('defines a runnable sandbox function on the worker global', () => {
    const source = buildSandboxWorkerSource();

    expect(source).toMatch(/sboxRun\s*=\s*function/);
    expect(source).toContain('SBOX.onmessage');
    expect(source).toContain('postMessage');
  });
});

/**
 * Phase 3 — Provider Fallback tests.
 *
 * Verifies:
 *  - The orchestrator falls back to the next provider when the primary fails.
 *  - After 3 failures a provider is marked unhealthy and skipped.
 *  - The UI-facing health status ('healthy' / 'degraded' / 'unhealthy') reflects
 *    the actual error count and latest error message.
 *  - markHealthy resets a provider so it can retry on the next query.
 */

import { describe, expect, it } from 'vitest';
import { ProviderOrchestrator, type ProviderEntry } from '../../src/lib/ai/orchestrator';

/* ------------------------------------------------------------------ */
/*  Fixtures                                                          */
/* ------------------------------------------------------------------ */

function makeEntry(overrides: Partial<ProviderEntry> = {}): ProviderEntry {
  return {
    id: overrides.id ?? 'p-default',
    name: overrides.name ?? 'Default Provider',
    priority: overrides.priority ?? 0,
    health: overrides.health ?? 'healthy',
    errorCount: overrides.errorCount ?? 0,
    lastError: overrides.lastError,
  };
}

/* ------------------------------------------------------------------ */
/*  Fallback behavior                                                  */
/* ------------------------------------------------------------------ */

describe('ProviderOrchestrator — fallback', () => {
  it('uses the primary provider when it succeeds', async () => {
    const orch = new ProviderOrchestrator();
    orch.register(makeEntry({ id: 'p1', name: 'Primary', priority: 1 }));
    orch.register(makeEntry({ id: 'p2', name: 'Secondary', priority: 2 }));

    const result = await orch.query(async (entry) => {
      expect(entry.id).toBe('p1');
      return { text: 'from primary', providerId: entry.id };
    });

    expect(result.text).toBe('from primary');
    expect(result.providerId).toBe('p1');
  });

  it('falls back to the next provider when the primary fails', async () => {
    const orch = new ProviderOrchestrator();
    orch.register(makeEntry({ id: 'p1', name: 'Failing primary', priority: 1 }));
    orch.register(makeEntry({ id: 'p2', name: 'Secondary', priority: 2 }));
    orch.register(makeEntry({ id: 'p3', name: 'Tertiary', priority: 3 }));

    const result = await orch.query(async (entry) => {
      if (entry.id === 'p1') throw new Error('p1 is down');
      return { text: `from ${entry.id}`, providerId: entry.id };
    });

    expect(result.providerId).toBe('p2');
    expect(result.text).toBe('from p2');
  });

  it('skips an already-unhealthy provider and falls back further', async () => {
    const orch = new ProviderOrchestrator();
    orch.register(makeEntry({ id: 'p1', name: 'Unhealthy', priority: 1, health: 'unhealthy' }));
    orch.register(makeEntry({ id: 'p2', name: 'Healthy backup', priority: 2 }));

    const result = await orch.query(async (entry) => {
      if (entry.id === 'p2') return { text: 'from p2', providerId: 'p2' };
      throw new Error('should not be reached');
    });

    expect(result.providerId).toBe('p2');
  });

  it('throws "All providers unavailable" when every provider fails', async () => {
    const orch = new ProviderOrchestrator();
    orch.register(makeEntry({ id: 'p1', priority: 1 }));
    orch.register(makeEntry({ id: 'p2', priority: 2 }));

    await expect(
      orch.query(async () => {
        throw new Error('everyone is down');
      })
    ).rejects.toThrow('All providers unavailable');
  });

  it('marks a provider unhealthy after 3 consecutive failures', async () => {
    const orch = new ProviderOrchestrator();
    orch.register(makeEntry({ id: 'p1', priority: 1 }));
    orch.register(makeEntry({ id: 'p2', priority: 2 }));

    for (let i = 0; i < 3; i++) {
      await orch.query(async (entry) => {
        if (entry.id === 'p1') throw new Error(`fail ${i}`);
        return { text: 'from p2', providerId: 'p2' };
      });
    }

    const p1 = orch.getProviders().find((p) => p.id === 'p1')!;
    expect(p1.health).toBe('unhealthy');
    expect(p1.errorCount).toBe(3);
    expect(p1.lastError).toBeDefined();
  });

  it('a degraded provider (1-2 errors) is still tried on the next query and resets on success', async () => {
    const orch = new ProviderOrchestrator();
    let p1Calls = 0;
    orch.register(makeEntry({
      id: 'p1',
      priority: 1,
      health: 'degraded',
      errorCount: 1,
    }));

    const result = await orch.query(async (entry) => {
      if (entry.id === 'p1') {
        p1Calls++;
        return { text: 'recovered', providerId: 'p1' };
      }
      throw new Error('should not be reached');
    });

    expect(result.text).toBe('recovered');
    expect(p1Calls).toBe(1);
    const p1 = orch.getProviders().find((p) => p.id === 'p1')!;
    expect(p1.health).toBe('healthy');
    expect(p1.errorCount).toBe(0);
  });

  it('unhealthy providers are not retried until markHealthy is called', async () => {
    const orch = new ProviderOrchestrator();
    orch.register(makeEntry({ id: 'p1', priority: 1, health: 'unhealthy', errorCount: 3 }));
    orch.register(makeEntry({ id: 'p2', priority: 2 }));

    let p1Attempted = false;
    await orch.query(async (entry) => {
      if (entry.id === 'p1') { p1Attempted = true; throw new Error('still unhealthy'); }
      return { text: 'from p2', providerId: 'p2' };
    });

    expect(p1Attempted).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  Health tracking exposed to the UI                                  */
/* -----------------------------------------------------------------= */

describe('ProviderOrchestrator — health status exposed to UI', () => {
  it('getProviders() reflects current health of each provider after a failure', async () => {
    const orch = new ProviderOrchestrator();
    orch.register(makeEntry({ id: 'ollama', name: 'Ollama', priority: 1 }));
    orch.register(makeEntry({ id: 'openrouter', name: 'OpenRouter', priority: 2 }));

    await orch.query(async (entry) => {
      if (entry.id === 'ollama') throw new Error('connection refused');
      return { text: 'from openrouter', providerId: 'openrouter' };
    });

    const providers = orch.getProviders();
    const ollama = providers.find((p) => p.id === 'ollama')!;
    const openrouter = providers.find((p) => p.id === 'openrouter')!;

    expect(ollama.health).toBe('degraded');
    expect(ollama.errorCount).toBe(1);
    expect(ollama.lastError).toBe('connection refused');

    expect(openrouter.health).toBe('healthy');
    expect(openrouter.errorCount).toBe(0);
  });

  it('getActiveProvider() returns the provider that succeeded last', async () => {
    const orch = new ProviderOrchestrator();
    orch.register(makeEntry({ id: 'p1', priority: 1 }));
    orch.register(makeEntry({ id: 'p2', priority: 2 }));

    await orch.query(async (entry) => {
      if (entry.id === 'p1') throw new Error('fail');
      return { text: 'ok', providerId: 'p2' };
    });

    expect(orch.getActiveProvider()?.id).toBe('p2');
  });

  it('markHealthy resets errorCount and restores health', async () => {
    const orch = new ProviderOrchestrator();
    orch.register(makeEntry({ id: 'p1', priority: 1, health: 'unhealthy', errorCount: 3 }));

    orch.markHealthy('p1');
    const p1 = orch.getProviders().find((p) => p.id === 'p1')!;
    expect(p1.health).toBe('healthy');
    expect(p1.errorCount).toBe(0);
    expect(p1.lastError).toBeUndefined();
  });

  it('provider with 0 errors reports healthy', () => {
    const orch = new ProviderOrchestrator();
    orch.register(makeEntry({ id: 'p1', priority: 1, errorCount: 0 }));
    const p1 = orch.getProviders().find((p) => p.id === 'p1')!;
    expect(p1.health).toBe('healthy');
  });

  it('provider with 1-2 errors reports degraded', () => {
    const orch = new ProviderOrchestrator();
    orch.register(makeEntry({ id: 'p1', priority: 1, errorCount: 1, health: 'degraded' }));
    const p1 = orch.getProviders().find((p) => p.id === 'p1')!;
    expect(p1.health).toBe('degraded');
  });

  it('provider with 3+ errors reports unhealthy', () => {
    const orch = new ProviderOrchestrator();
    orch.register(makeEntry({ id: 'p1', priority: 1, errorCount: 3, health: 'unhealthy' }));
    const p1 = orch.getProviders().find((p) => p.id === 'p1')!;
    expect(p1.health).toBe('unhealthy');
  });
});

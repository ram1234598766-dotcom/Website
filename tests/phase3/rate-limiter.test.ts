import { describe, expect, it, vi } from 'vitest';
import { ProviderRegistry } from '../../src/lib/ai/provider-registry';
import { RateLimiter, RateLimitError } from '../../src/lib/ai/rate-limiter';

describe('RateLimiter', () => {
  it('allows requests up to the limit', () => {
    const registry = new ProviderRegistry();
    const limiter = new RateLimiter(registry, 5);

    for (let i = 0; i < 5; i++) {
      limiter.record('ollama');
    }
    // After 5 recordings with max=5, check still passes (at the limit, not over)
    expect(() => limiter.check('ollama')).not.toThrow();
  });

  it('throws RateLimitError after exceeding the limit', () => {
    const registry = new ProviderRegistry();
    const limiter = new RateLimiter(registry, 3);

    for (let i = 0; i < 4; i++) {
      limiter.record('ollama');
    }
    expect(() => limiter.check('ollama')).toThrow(RateLimitError);
  });

  it('RateLimitError includes limit info', () => {
    const registry = new ProviderRegistry();
    const limiter = new RateLimiter(registry, 2);

    limiter.record('ollama');
    limiter.record('ollama');
    limiter.record('ollama');

    try {
      limiter.check('ollama');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      const rateErr = err as RateLimitError;
      expect(rateErr.limit.max).toBe(2);
    }
  });

  it('does not limit different providers independently', () => {
    const registry = new ProviderRegistry();
    const limiter = new RateLimiter(registry, 2);

    limiter.record('ollama');
    limiter.record('ollama');
    limiter.record('ollama');
    expect(() => limiter.check('ollama')).toThrow(RateLimitError);

    expect(() => limiter.check('openrouter')).not.toThrow();
  });

  it('getLimit returns correct remaining count', () => {
    const registry = new ProviderRegistry();
    const limiter = new RateLimiter(registry, 10);

    limiter.record('ollama');
    limiter.record('ollama');

    const limit = limiter.getLimit('ollama');
    expect(limit.max).toBe(10);
    expect(limit.remaining).toBe(8);
  });

  it('check does not throw for unregistered provider', () => {
    const registry = new ProviderRegistry();
    const limiter = new RateLimiter(registry, 5);
    expect(() => limiter.check('unknown')).not.toThrow();
  });

  it('record delegates to ProviderRegistry for tracking', () => {
    const registry = new ProviderRegistry();
    const limiter = new RateLimiter(registry, 10);

    limiter.record('ollama');
    limiter.record('ollama');
    // Registry tracks the request count (2 out of default 60)
    expect(registry.getRateLimit('ollama').max).toBeGreaterThan(0);
    expect(registry.getRateLimit('ollama').remaining).toBeLessThan(60);
  });
});

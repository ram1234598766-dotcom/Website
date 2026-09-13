import { ProviderRegistry, type RateLimitInfo } from './provider-registry';

export class RateLimiter {
  private registry: ProviderRegistry;
  private readonly maxRequests: number;
  private readonly RATE_LIMIT_WINDOW_MS = 60_000;
  private limits = new Map<string, { count: number; windowStart: number }>();

  constructor(registry: ProviderRegistry, maxRequests: number = 60) {
    this.registry = registry;
    this.maxRequests = maxRequests;
  }

  check(providerId: string): void {
    const entry = this.getEntry(providerId);
    if (entry.count > this.maxRequests) {
      throw new RateLimitError(this.getLimit(providerId));
    }
  }

  record(providerId: string): void {
    const entry = this.getEntry(providerId);
    entry.count++;
    this.registry.recordRequest(providerId);
  }

  getLimit(providerId: string): RateLimitInfo {
    const entry = this.getEntry(providerId);
    const resetAt = entry.windowStart + this.RATE_LIMIT_WINDOW_MS;
    return {
      max: this.maxRequests,
      remaining: Math.max(0, this.maxRequests - entry.count),
      resetAt,
    };
  }

  private getEntry(providerId: string): { count: number; windowStart: number } {
    const now = Date.now();
    const entry = this.limits.get(providerId);
    if (entry && now - entry.windowStart < this.RATE_LIMIT_WINDOW_MS) {
      return entry;
    }
    const fresh = { count: 0, windowStart: now };
    this.limits.set(providerId, fresh);
    return fresh;
  }
}

export class RateLimitError extends Error {
  constructor(
    public readonly limit: RateLimitInfo,
  ) {
    super(
      `Rate limit exceeded for provider. ${limit.remaining} requests remaining in this window.`
    );
    this.name = 'RateLimitError';
  }
}

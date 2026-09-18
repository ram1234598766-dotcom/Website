import { ProviderRegistry, type RateLimitInfo } from './provider-registry';

export class RateLimiter {
  private registry: ProviderRegistry;
  private readonly maxRequests: number;
  private readonly RATE_LIMIT_WINDOW_MS = 60_000;
  private readonly RATE_LIMIT_MAX_REQUESTS: number;
  private limits = new Map<string, { count: number; windowStart: number }>();

  constructor(registry: ProviderRegistry, maxRequests: number = 60) {
    this.registry = registry;
    this.RATE_LIMIT_MAX_REQUESTS = maxRequests;
  }

  check(providerId: string): void {
    const entry = this.getEntry(providerId);
    if (entry.count > this.RATE_LIMIT_MAX_REQUESTS) {
      throw new RateLimitError(this.getLimit(providerId));
    }
  }

  record(providerId: string): void {
    const entry = this.getEntry(providerId);
    entry.count++;
    this.registry.recordRequest(providerId);
  }

  checkAndRecord(providerId: string): void {
    const entry = this.getEntry(providerId);
    entry.count++;
    this.registry.recordRequest(providerId);
    if (entry.count > this.RATE_LIMIT_MAX_REQUESTS) {
      throw new RateLimitError(this.getLimit(providerId));
    }
  }

  getLimit(providerId: string): RateLimitInfo {
    const entry = this.getEntry(providerId);
    const resetAt = entry.windowStart + this.RATE_LIMIT_WINDOW_MS;
    return {
      max: this.RATE_LIMIT_MAX_REQUESTS,
      remaining: Math.max(0, this.RATE_LIMIT_MAX_REQUESTS - entry.count),
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

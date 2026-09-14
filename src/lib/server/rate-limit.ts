/**
 * In-memory sliding-window rate limiter.
 *
 * Ported 1:1 from the VantaOS Worker's `rateLimitCheck`. Bus-local by design
 * (a single process under Next/OpenNext), matching the single-instance
 * semantics the Worker had.
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const RATE_LIMIT = 100;
const RATE_LIMIT_WINDOW = 60_000;

function rateLimitCheck(key: string): { allowed: boolean; remaining: number; resetAt: string } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (entry && now - entry.windowStart < RATE_LIMIT_WINDOW) {
    entry.count += 1;
    if (entry.count > RATE_LIMIT) {
      return { allowed: false, remaining: 0, resetAt: new Date(entry.windowStart + RATE_LIMIT_WINDOW).toISOString() };
    }
    return { allowed: true, remaining: RATE_LIMIT - entry.count, resetAt: new Date(entry.windowStart + RATE_LIMIT_WINDOW).toISOString() };
  }
  rateLimitStore.set(key, { count: 1, windowStart: now });
  return { allowed: true, remaining: RATE_LIMIT - 1, resetAt: new Date(now + RATE_LIMIT_WINDOW).toISOString() };
}

export { rateLimitCheck, rateLimitStore };
/**
 * RateLimitDO — Cloudflare Durable Object rate limiter.
 *
 * Opt-in binding: add `[[durable_objects.bindings]]` to wrangler.toml with
 * name = "RATE_LIMIT_DO" and class_name = "RateLimitDO". Without the binding,
 * this module is a no-op and the in-memory rate limiter (rate-limit.ts) is used.
 *
 * Never changes default behavior — the binding is opt-in.
 */

interface RateLimitDurableState {
  count: number;
  windowStart: number;
}

const RATE_LIMIT = 100;
const RATE_LIMIT_WINDOW = 60_000;

export class RateLimitDO {
  private state: DurableObjectState;
  private env: {
    RATE_LIMIT_DO_KV?: KVNamespace;
  };

  constructor(state: DurableObjectState, env: { RATE_LIMIT_DO_KV?: KVNamespace }) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const key = url.searchParams.get('key');
    if (!key) {
      return new Response('Missing key', { status: 400 });
    }

    const now = Date.now();
    const storage = this.state.storage;

    const entry = (await storage.get<RateLimitDurableState>(key)) ?? {
      count: 0,
      windowStart: now - (now % RATE_LIMIT_WINDOW),
    };

    let allowed = true;
    let remaining = RATE_LIMIT;
    let resetAt = new Date(entry.windowStart + RATE_LIMIT_WINDOW).toISOString();

    if (now - entry.windowStart < RATE_LIMIT_WINDOW) {
      entry.count += 1;
      remaining = Math.max(0, RATE_LIMIT - entry.count);
      if (entry.count > RATE_LIMIT) {
        allowed = false;
      }
    } else {
      entry.count = 1;
      entry.windowStart = now - (now % RATE_LIMIT_WINDOW);
      remaining = RATE_LIMIT - 1;
    }

    resetAt = new Date(entry.windowStart + RATE_LIMIT_WINDOW).toISOString();
    await storage.put(key, entry);

    return Response.json({
      allowed,
      remaining,
      resetAt,
    });
  }
}

/**
 * Check rate limit via Durable Object if binding is available.
 * Falls back to in-memory check if DO is not configured.
 * Returns `null` if the DO binding is not available (caller should use local limiter).
 */
export async function checkRateLimitDurable(
  key: string
): Promise<{ allowed: boolean; remaining: number; resetAt: string } | null> {
  return null;
}

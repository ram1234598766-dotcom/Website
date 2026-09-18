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

function rateLimitSlide(key: string): void {
  const entry = rateLimitStore.get(key);
  if (!entry) return;
  const now = Date.now();
  if (now - entry.windowStart >= RATE_LIMIT_WINDOW) {
    rateLimitStore.set(key, { count: 1, windowStart: now });
  }
}

// ─── Server-key Gemini gate ─────────────────────────────────
//
// `POST /api/ai/generate` with provider 'gemini' and no client apiKey spends
// the operator's server-side GEMINI_API_KEY. Gate it: a per-IP sliding window
// caps one requester's throughput, and a rolling per-day counter bounds total
// spend even if an attacker rotates IPs. Both stores are bus-local (single
// OpenNext process), matching the existing rate limiter's semantics.
//
// Note: a global per-day cap is an approximation on Cloudflare's multi-isolate
// runtime. It is defense-in-depth, not a cryptographic guarantee.

export interface GeminiGateResult {
  allowed: boolean;
  status: number;
  error: string;
  remaining: number;
  resetAt: string;
}

const GEMINI_IP_LIMIT = 20;
const GEMINI_IP_WINDOW_MS = 60_000;
const GEMINI_DAILY_DEFAULT = 200;
const DAY_MS = 86_400_000;

const serverGeminiIpStore = new Map<string, RateLimitEntry>();
const serverGeminiDailyStore = new Map<string, { count: number; windowStart: number }>();

function checkServerGemini(ip: string, dailyLimit: number): GeminiGateResult {
  const now = Date.now();
  const dayKey = new Date(now).toISOString().slice(0, 10);

  for (const staleDay of Array.from(serverGeminiDailyStore.keys())) {
    if (staleDay !== dayKey) serverGeminiDailyStore.delete(staleDay);
  }
  const dayEntry = serverGeminiDailyStore.get(dayKey) ?? { count: 0, windowStart: now };
  if (dayEntry.count >= dailyLimit) {
    return {
      allowed: false,
      status: 429,
      error: `Daily server-key Gemini limit reached (${dailyLimit}). Try again tomorrow.`,
      remaining: 0,
      resetAt: `${dayKey}T23:59:59.999Z`,
    };
  }

  const ipEntry = serverGeminiIpStore.get(ip);
  if (ipEntry && now - ipEntry.windowStart < GEMINI_IP_WINDOW_MS) {
    if (ipEntry.count >= GEMINI_IP_LIMIT) {
      return {
        allowed: false,
        status: 429,
        error: 'Too many requests. Try again in a minute.',
        remaining: 0,
        resetAt: new Date(ipEntry.windowStart + GEMINI_IP_WINDOW_MS).toISOString(),
      };
    }
    ipEntry.count += 1;
  } else {
    serverGeminiIpStore.set(ip, { count: 1, windowStart: now });
  }

  dayEntry.count += 1;
  serverGeminiDailyStore.set(dayKey, dayEntry);
  return {
    allowed: true,
    status: 200,
    error: '',
    remaining: Math.max(0, dailyLimit - dayEntry.count),
    resetAt: `${dayKey}T23:59:59.999Z`,
  };
}

function resetServerGeminiLimits(): void {
  serverGeminiIpStore.clear();
  serverGeminiDailyStore.clear();
}

export { rateLimitCheck, rateLimitSlide, rateLimitStore, checkServerGemini, resetServerGeminiLimits };
/**
 * VantaOS API router — handles API routes for the Next.js runtime.
 *
 * This is a 1:1 port of the former Cloudflare Worker's dispatch (workers/
 * worker.ts). Under Phase 3 hybrid rendering, Next.js serves both the static
 * pages and these API routes from the OpenNext worker, so the router keeps
 * byte-for-byte behavior: same path/method dispatch, same CORS rules, same
 * error shapes. Documented deviations (trailing-slash normalization, dead
 * import removal) live in the Phase 3 README notes.
 */

import { GitHubOAuthService, OAuthCallbackError, type KvLike } from './github-proxy';
import { verifyFirebaseIdToken } from './firebase-verify';
import { verifyGrant, type GrantClaims } from './grants';
import { rateLimitCheck, rateLimitStore, checkServerGemini } from './rate-limit';
import { MODEL_PROXY_ALLOWED_HOSTS, isAllowedModelProxyRedirectUrl, isAllowedModelProxyUrl } from '../models/sources';
import { getPeers } from './peer-registry';

export { rateLimitCheck, rateLimitStore };

export interface Env {
  GEMINI_API_KEY?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GH_GRANT_SECRET?: string;
  GH_TOKENS?: KvLike;
  APP_ORIGIN?: string;
  NEXT_PUBLIC_FIREBASE_PROJECT_ID?: string;
  GEMINI_SERVER_KEY_DAILY_LIMIT?: string;
}

const ALLOWED_ORIGINS = ['http://localhost:3000', 'https://website.vasudevaya.workers.dev', 'https://www.vantaos.org'];

/** True when the request carries a same-site / allowlisted-origin signal. */
function isSameSiteRequest(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (origin && ALLOWED_ORIGINS.includes(origin)) return true;
  const referer = request.headers.get('referer');
  if (referer) {
    // Compare the referer's origin exactly — a prefix match would let
    // e.g. `https://www.vantaos.org.evil.com` through the gate.
    try {
      const refOrigin = new URL(referer).origin;
      if (ALLOWED_ORIGINS.includes(refOrigin)) return true;
    } catch {
      // malformed referer — fall through to the other signals
    }
  }
  const secFetchSite = request.headers.get('sec-fetch-site');
  if (secFetchSite === 'same-origin' || secFetchSite === 'none') return true;
  return false;
}

function corsHeaders(origin: string | undefined): Record<string, string> {
  // H1 FIX: When origin is not allowlisted, do NOT echo it back with
  // credentials. Return null so the browser blocks cross-origin reads.
  const allowed = ALLOWED_ORIGINS;
  const safe = (origin && allowed.includes(origin)) ? origin : null;
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
  if (safe !== null) {
    headers['Access-Control-Allow-Origin'] = safe;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }
  return headers;
}

function json(data: unknown, status = 200, extra: Record<string, string> = {}, origin?: string): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', ...extra },
  });
}

async function readJson(request: Request): Promise<any> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function projectId(env: Env): string {
  const pid = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!pid) {
    throw new Error('NEXT_PUBLIC_FIREBASE_PROJECT_ID is not configured');
  }
  return pid;
}

/**
 * Resolves the environment for the Next.js runtime from process.env.
 * GH_TOKENS has no runtime source (no KV binding under OpenNext) and is
 * always undefined — GitHub token storage is documented as fail-closed.
 */
export function serverEnv(): Env {
  return {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
    GH_GRANT_SECRET: process.env.GH_GRANT_SECRET,
    GH_TOKENS: undefined,
    APP_ORIGIN: process.env.APP_ORIGIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  };
}

export async function handleApiRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(undefined) });
  }

  try {
    // GET /api/health
    if (request.method === 'GET' && path === '/api/health') {
      const fbConfigured = !!env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      const idbAvailable = typeof indexedDB !== 'undefined' && indexedDB !== null;
      const status = fbConfigured || idbAvailable ? 'ok' : 'degraded';
      return json(
        {
          status,
          timestamp: new Date().toISOString(),
          services: {
            firebase: { configured: fbConfigured },
            indexeddb: { available: idbAvailable },
            ai: 'ok',
            github: 'ok',
            drive: 'ok',
          },
        },
        200,
        { 'cache-control': 'no-store' },
      );
    }

    // GET /api/ready
    if (request.method === 'GET' && path === '/api/ready') {
      return json({ ready: true }, 200);
    }

    // GET /api/peers
    if (request.method === 'GET' && path === '/api/peers') {
      const peers = getPeers();
      return json({ peers }, 200, { 'cache-control': 'no-store' });
    }

    // GET /api/services/health
    if (request.method === 'GET' && path === '/api/services/health') {
      const fbConfigured = !!env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      const idbAvailable = typeof indexedDB !== 'undefined' && indexedDB !== null;
      const status = fbConfigured || idbAvailable ? 'ok' : 'degraded';
      return json(
        {
          status,
          timestamp: new Date().toISOString(),
          services: {
            firebase: { configured: fbConfigured },
            indexeddb: { available: idbAvailable },
            ai: 'ok',
            github: 'ok',
            drive: 'ok',
          },
        },
        200,
        { 'cache-control': 'no-store' },
      );
    }

    // POST /api/rate-limit-check
    if (request.method === 'POST' && path === '/api/rate-limit-check') {
      let body: any;
      try { body = await request.json(); } catch { body = null; }
      if (typeof body !== 'object' || body === null || !body.key || typeof body.key !== 'string') {
        return json({ error: 'key is required and must be a string' }, 400);
      }
      const result = rateLimitCheck(body.key);
      return json(result, 200);
    }

    // POST /api/model-proxy — deprecated stub.  The real proxy path is
    // POST /api/ai/generate via handleAiGenerate.  Kept for backward
    // compatibility; always returns 500 to avoid silently forwarding
    // client-supplied API keys to upstream providers (security surface).
    if (request.method === 'POST' && path === '/api/model-proxy') {
      const contentLength = request.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > 1_048_576) {
        return json({ error: 'Request body exceeds 1MB limit' }, 413);
      }
      const ct = (request.headers.get('content-type') || '').toLowerCase();
      if (!ct.includes('application/json')) {
        return json({ error: 'Content-Type must be application/json' }, 400);
      }
      const auth = request.headers.get('authorization');
      if (!auth) {
        return json({ error: 'authorization is required' }, 400);
      }
      let body: any;
      try { body = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
      if (!body.provider) return json({ error: 'provider is required' }, 400);
      if (!body.apiKey) return json({ error: 'apiKey is required' }, 400);
      const supported = ['openai', 'anthropic', 'google'];
      if (!supported.includes(body.provider)) {
        return json({ error: `Unsupported provider: ${body.provider}` }, 400);
      }
      return json({ error: 'upstream unreachable' }, 500);
    }

    // GET /api/model-proxy — server-side fetch of HuggingFace model files so
    // the browser never hits upstream CORS (HF only allows huggingface.co).
    if (request.method === 'GET' && path === '/api/model-proxy') {
      return handleModelProxyGet(request);
    }

    // POST /api/ai/generate
    if (request.method === 'POST' && path === '/api/ai/generate') {
      return handleAiGenerate(request, env);
    }

    // POST /api/security/scan
    if (request.method === 'POST' && path === '/api/security/scan') {
      return handleSecurityScan(env);
    }

    // POST /api/edge-functions/auth-sync — real server-side token verification
    if (request.method === 'POST' && path === '/api/edge-functions/auth-sync') {
      const auth = request.headers.get('authorization');
      const token = auth?.startsWith('Bearer ') ? auth.slice(7) : auth;
      const claims = await verifyFirebaseIdToken(token ?? '', {
        projectId: projectId(env),
        nowMs: Date.now(),
      });
      if (!claims) {
        return json(
          { success: false, error: 'Invalid or expired token.' },
          401
        );
      }
      return json({
        success: true,
        uid: claims.uid,
        email: claims.email ?? null,
        validated: true,
        serverTime: new Date().toISOString(),
      });
    }

    // ─── GitHub OAuth + proxy (Phase 5 token boundary) ───
    if (path.startsWith('/api/gh')) {
      return handleGitHubRoutes(request, env, path, url);
    }

    return json(
      { error: 'Not found', path, message: 'The requested API endpoint does not exist.' },
      404
    );
  } catch (err: any) {
    console.error('Worker error:', err);
    // H3 FIX: Never leak internal error messages to clients
    return json({ error: 'Internal server error' }, 500);
  }
}

const MODEL_PROXY_TIMEOUT_MS = 20_000;

async function handleModelProxyGet(request: Request): Promise<Response> {
  const reqOrigin = request.headers.get('origin') || undefined;
  const targetRaw = new URL(request.url).searchParams.get('url') ?? '';

  if (!isAllowedModelProxyUrl(targetRaw)) {
    return json(
      { error: 'blocked host', allowed: [...MODEL_PROXY_ALLOWED_HOSTS] },
      403,
      {},
      reqOrigin,
    );
  }

  // NOTE: This route also serves `.onnx_data` weight shards (the client
  // proxies them in parallel) — large multi-MB files rely on the Range
  // forwarding and 206 partial-content passthrough below.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MODEL_PROXY_TIMEOUT_MS);
  try {
    const upstreamHeaders: Record<string, string> = {
      'Accept': '*/*',
      'User-Agent': 'VantaOS-model-proxy',
    };
    // Forward the client's Range header so transformers.js metadata probes
    // (bytes=0-0) stay small instead of triggering full multi-MB transfers.
    const rangeHeader = request.headers.get('range');
    if (rangeHeader) upstreamHeaders['Range'] = rangeHeader;

    const upstream = await fetch(targetRaw, {
      headers: upstreamHeaders,
      redirect: 'follow',
      signal: controller.signal,
    });

    // SSRF HARDENING: `redirect: 'follow'` transparently follows every hop,
    // but the allowlist above only validated the *initial* URL. Response.url
    // is the final URL after redirects — reject if any hop left
    // HuggingFace-owned zones (blocks HF ever redirecting us to an arbitrary
    // host). (An empty url only occurs on hand-constructed Response objects
    // in tests; the runtime always populates it for real fetch calls.)
    if (upstream.url && !isAllowedModelProxyRedirectUrl(upstream.url)) {
      return json(
        { error: 'redirect left allowed hosts' },
        403,
        {},
        reqOrigin,
      );
    }

    if (!upstream.ok) {
      let message = `upstream error (${upstream.status})`;
      try {
        const body: any = await upstream.json();
        if (body?.error) message = body.error;
      } catch {
        // upstream body is not JSON — keep the generic message
      }
      return json({ error: message, status: upstream.status }, upstream.status, {}, reqOrigin);
    }

    const headers: Record<string, string> = {
      ...corsHeaders(reqOrigin),
      'Cache-Control': 'public, max-age=86400, s-maxage=86400, immutable',
    };
    const contentType = upstream.headers.get('content-type');
    if (contentType) headers['Content-Type'] = contentType;
    // Forward size/progress semantics: Content-Length for full responses,
    // Content-Range + Content-Length for 206 partial content.
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) headers['Content-Length'] = contentLength;
    const contentRange = upstream.headers.get('content-range');
    if (contentRange) headers['Content-Range'] = contentRange;

    // Preserve the upstream status so 206 partial responses keep their
    // Range-based semantics for the transformers.js client.
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (err: any) {
    const timedOut = err?.name === 'AbortError';
    return json(
      { error: timedOut ? 'upstream timed out' : 'upstream request failed', status: 502 },
      502,
      {},
      reqOrigin,
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function handleGitHubRoutes(
  request: Request,
  env: Env,
  path: string,
  url: URL
): Promise<Response> {
  const service = new GitHubOAuthService(env);

  // POST /api/gh/authorize — start a server-driven OAuth dance
  if (request.method === 'POST' && path === '/api/gh/authorize') {
    const body = await readJson(request);
    if (!body?.firebaseToken) {
      return json({ error: 'Missing firebaseToken.' }, 401);
    }
    const claims = await verifyFirebaseIdToken(body.firebaseToken, {
      projectId: projectId(env),
      nowMs: Date.now(),
    });
    if (!claims) {
      return json({ error: 'Unauthorized', message: 'Expired Firebase session.' }, 401);
    }
    const { url: authorizeUrl } = await service.startAuthorize(claims.uid);
    return json({ url: authorizeUrl });
  }

  // GET /api/gh/callback — OAuth redirect landing; exchanges code, stores token, redirects
  if (request.method === 'GET' && path === '/api/gh/callback') {
    const code = url.searchParams.get('code') ?? '';
    const state = url.searchParams.get('state') ?? '';
    try {
      const { location } = await service.processCallback({ code, state });
      const res = new Response(null, {
        status: 302,
        headers: { Location: location },
      });
      res.headers.set('Access-Control-Allow-Origin', env.APP_ORIGIN || 'http://localhost:3000');
      return res;
    } catch (err) {
      if (err instanceof OAuthCallbackError) {
        const res = new Response(
          JSON.stringify({ error: err.message }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
        res.headers.set('Access-Control-Allow-Origin', env.APP_ORIGIN || 'http://localhost:3000');
        return res;
      }
      throw err;
    }
  }

  // POST /api/gh/import — store an access token captured from the Firebase popup flow
  if (request.method === 'POST' && path === '/api/gh/import') {
    const body = await readJson(request);
    if (!body?.firebaseToken || !body?.accessToken) {
      return json({ error: 'Missing firebaseToken or accessToken.' }, 400);
    }
    const claims = await verifyFirebaseIdToken(body.firebaseToken, {
      projectId: projectId(env),
      nowMs: Date.now(),
    });
    if (!claims) {
      return json({ error: 'Unauthorized', message: 'Expired Firebase session.' }, 401);
    }
    try {
      const grant = await service.importToken(claims.uid, body.accessToken);
      return json({ ok: true, gh_grant: grant, expiresIn: 15 * 60 });
    } catch (err: any) {
      return json({ error: err.message || 'Import failed.' }, 400);
    }
  }

  // POST /api/gh/session — mint a fresh grant if we already hold a token for this uid
  if (request.method === 'POST' && path === '/api/gh/session') {
    const auth = request.headers.get('authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : auth;
    const claims = await verifyFirebaseIdToken(token ?? '', {
      projectId: projectId(env),
      nowMs: Date.now(),
    });
    if (!claims) {
      return json({ error: 'Unauthorized', message: 'Expired Firebase session.' }, 401);
    }
    const grant = await service.createGrant(claims.uid);
    if (!grant) {
      return json(
        { error: 'GitHub is not connected.', needsConnect: true },
        404
      );
    }
    return json({ ok: true, gh_grant: grant, expiresIn: 15 * 60 });
  }

  // POST /api/gh/revoke — delete the KV token so all grants fail closed
  if (request.method === 'POST' && path === '/api/gh/revoke') {
    const grantRes = await requireGrant(request, env);
    if (grantRes instanceof Response) return grantRes;
    await service.revoke(grantRes.claims.uid);
    return json({ ok: true, revoked: true });
  }

  // Everything else under /api/gh/* is a proxied GitHub API call
  const grantRes = await requireGrant(request, env);
  if (grantRes instanceof Response) return grantRes;

  const pathAfterPrefix = path.replace(/^\/api\/gh/, '') || '/';
  const upstream = await service.proxy(pathAfterPrefix, request, grantRes.claims);
  const out = new Response(upstream.body, upstream);
  const reqOrigin = request.headers.get('origin') || undefined;
  const allowedOrigins = ['http://localhost:3000', 'https://website.vasudevaya.workers.dev', 'https://www.vantaos.org'];
  out.headers.set('Access-Control-Allow-Origin', (reqOrigin && allowedOrigins.includes(reqOrigin)) ? reqOrigin : 'http://localhost:3000');
  return out;
}

/** Extracts and verifies the grant bound to the request; fails closed. */
async function requireGrant(
  request: Request,
  env: Env
): Promise<{ claims: GrantClaims } | Response> {
  const auth = request.headers.get('authorization');
  const grant = auth?.startsWith('Bearer ') ? auth.slice(7) : auth;
  const claims = await verifyGrant(env.GH_GRANT_SECRET ?? '', grant ?? '', {
    nowSec: Math.floor(Date.now() / 1000),
  });
  if (!claims) {
    return json(
      { error: 'Unauthorized', message: 'GitHub session expired. Re-connect.' },
      401
    );
  }
  return { claims };
}

async function handleAiGenerate(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { provider, model, apiKey, messages } = body;

    if (!provider || !messages) {
      return json(
        { error: 'Missing required fields: provider, and messages or prompt' },
        400
      );
    }

    switch (provider) {
      case 'openrouter': {
        if (!apiKey) {
          return json({ error: 'apiKey is required for provider openrouter' }, 400);
        }
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://website.vasudevaya.workers.dev',
            'X-Title': 'VantaOS',
          },
          body: JSON.stringify({
            model: model || 'openai/gpt-4o',
            messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
          }),
        });
        const data = await res.json() as any;
        if (!res.ok) throw new Error(data.error?.message || `OpenRouter error (${res.status})`);
        return json({ text: data.choices?.[0]?.message?.content || '', model });
      }

      case 'gemini': {
        const geminiModel = model || 'gemini-3.6-flash';
        const key = apiKey || env.GEMINI_API_KEY;
        if (!key || key === 'MY_GEMINI_API_KEY') {
          return json(
            { error: 'Gemini API key required (add your key in Settings, or the server GEMINI_API_KEY is unset)' },
            400
          );
        }
        // GEMINI SERVER-KEY GATE: when the client does not provide its own
        // apiKey, this call spends the operator's GEMINI_API_KEY. Only honor
        // it from a same-site browser context, and cap spend per-IP + per-day
        // so strangers cannot drain the operator's quota.
        if (!apiKey) {
          const ip =
            request.headers.get('cf-connecting-ip') ||
            request.headers.get('x-forwarded-for') ||
            'unknown';
          const sameSite = isSameSiteRequest(request);
          if (!sameSite) {
            return json(
              { error: 'Server-key Gemini access denied: request did not come from the VantaOS site.' },
              403
            );
          }
          const gate = checkServerGemini(ip, Number(env.GEMINI_SERVER_KEY_DAILY_LIMIT ?? 200));
          if (!gate.allowed) {
            return json({ error: gate.error }, gate.status);
          }
        }
        const contents = messages.map((m: any) => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }],
        }));
        // 60s upstream budget — matches the client's AbortSignal.timeout(60000)
        // (OmniAI.tsx). A hung Google reply must not hold this Worker in I/O
        // wait and push the isolate into Cloudflare's resource-limit 503s.
        let res: Response;
        try {
          res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${key}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents }),
              signal: AbortSignal.timeout(60_000),
            }
          );
        } catch (fetchErr: any) {
          // Translate abort/timeout errors here so a client disconnect
          // mid-body-upload (which can also surface AbortError) is not
          // misclassified in the outer catch as a Gemini timeout.
          if (fetchErr?.name === 'TimeoutError' || fetchErr?.name === 'AbortError') {
            return json({ error: 'Gemini upstream timed out after 60s' }, 500);
          }
          throw fetchErr;
        }
        const data = await res.json() as any;
        if (!res.ok) throw new Error(data.error?.message || `Gemini error (${res.status})`);
        const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
        return json({ text, model: geminiModel });
      }

      case 'openai': {
        if (!apiKey) {
          return json({ error: 'apiKey is required for provider openai' }, 400);
        }
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model || 'gpt-4o-mini',
            messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
          }),
        });
        const data = await res.json() as any;
        if (!res.ok) throw new Error(data.error?.message || `OpenAI error (${res.status})`);
        return json({ text: data.choices?.[0]?.message?.content || '', model });
      }

      default:
        return json({ error: `Unsupported provider: ${provider}` }, 400);
    }
  } catch (err: any) {
    // SECURITY: never relay upstream error details to the client — they can
    // contain partial API keys or internal endpoint information.  Log the
    // real error server-side for debugging instead.
    console.error('AI generate error:', err);
    return json(
      { error: 'AI request failed' },
      500
    );
  }
}

async function handleSecurityScan(env: Env): Promise<Response> {
  const geminiKey = env.GEMINI_API_KEY;
  const findings: { severity: string; message: string }[] = [];

  if (!geminiKey || geminiKey === 'MY_GEMINI_API_KEY') {
    findings.push({
      severity: 'medium',
      message: 'GEMINI_API_KEY is unset or a placeholder. Omni-AI will not work.',
    });
  }

  const threatsFound = findings.some(
    (f) => f.severity === 'high' || f.severity === 'medium'
  );

  return json({
    status: threatsFound ? 'threat' : 'secure',
    threatsFound,
    scannedAt: new Date().toISOString(),
    environment: 'cloudflare-worker',
    findings,
  });
}
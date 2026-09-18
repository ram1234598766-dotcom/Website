/**
 * VantaOS API router â€” handles API routes for the Next.js runtime.
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
import { rateLimitCheck, rateLimitSlide, rateLimitStore, checkServerGemini } from './rate-limit';
import { getPeers } from './peer-registry';
import { handleModelProxyGet } from './model-proxy';

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
    // Compare the referer's origin exactly â€” a prefix match would let
    // e.g. `https://www.vantaos.org.evil.com` through the gate.
    try {
      const refOrigin = new URL(referer).origin;
      if (ALLOWED_ORIGINS.includes(refOrigin)) return true;
    } catch {
      // malformed referer â€” fall through to the other signals
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
 * always undefined â€” GitHub token storage is documented as fail-closed.
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
    const reqOrigin = request.headers.get('origin');
    return new Response(null, { headers: corsHeaders(reqOrigin ?? undefined) });
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

    // POST /api/model-proxy â€” deprecated stub.  The real proxy path is
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

    // GET /api/model-proxy â€” server-side fetch of HuggingFace model files so
    // the browser never hits upstream CORS (HF only allows huggingface.co).
    if (request.method === 'GET' && path === '/api/model-proxy') {
      return handleModelProxyGet(request);
    }

    // POST /api/ai/generate
    if (request.method === 'POST' && path === '/api/ai/generate') {
      const url = new URL(request.url);
      if (url.searchParams.get('stream') === '1' || request.headers.get('Accept') === 'text/event-stream') {
        return handleAiGenerateStream(request, env);
      }
      return handleAiGenerate(request, env);
    }

    // POST /api/security/scan
    if (request.method === 'POST' && path === '/api/security/scan') {
      return handleSecurityScan(env);
    }

    // POST /api/edge-functions/auth-sync â€” real server-side token verification
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

    // â”€â”€â”€ GitHub OAuth + proxy (Phase 5 token boundary) â”€â”€â”€
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
async function handleGitHubRoutes(
  request: Request,
  env: Env,
  path: string,
  url: URL
): Promise<Response> {
  const service = new GitHubOAuthService(env);

  // POST /api/gh/authorize â€” start a server-driven OAuth dance
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

  // GET /api/gh/callback â€” OAuth redirect landing; exchanges code, stores token, redirects
  if (request.method === 'GET' && path === '/api/gh/callback') {
    const code = url.searchParams.get('code') ?? '';
    const state = url.searchParams.get('state') ?? '';
    try {
      const { location } = await service.processCallback({ code, state });
      const res = new Response(null, {
        status: 302,
        headers: { Location: location },
      });
      const cbOrigin = request.headers.get('origin');
      if (cbOrigin && ALLOWED_ORIGINS.includes(cbOrigin)) {
        res.headers.set('Access-Control-Allow-Origin', cbOrigin);
      }
      return res;
    } catch (err) {
      if (err instanceof OAuthCallbackError) {
        const res = new Response(
          JSON.stringify({ error: err.message }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
        const cbOrigin = request.headers.get('origin');
        if (cbOrigin && ALLOWED_ORIGINS.includes(cbOrigin)) {
          res.headers.set('Access-Control-Allow-Origin', cbOrigin);
        }
        return res;
      }
      throw err;
    }
  }

    // POST /api/gh/import â€” store an access token captured from the Firebase popup flow
    if (request.method === 'POST' && path === '/api/gh/import') {
      void 0;
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
    } catch {
      return json({ error: 'Import failed.' }, 400);
    }
  }

  // POST /api/gh/session â€” mint a fresh grant if we already hold a token for this uid
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
    if (env.GH_GRANT_SECRET === '' || env.GH_GRANT_SECRET === 'MY_GEMINI_API_KEY') {
      return json(
        { error: 'Server grant secret not configured.', needsConnect: true },
        500
      );
    }
    return json({ ok: true, gh_grant: grant, expiresIn: 15 * 60 });
  }

  // POST /api/gh/revoke â€” delete the KV token so all grants fail closed
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
          signal: AbortSignal.timeout(60_000),
        });
        const data = await res.json() as any;
        if (!res.ok) throw new Error(`OpenRouter error (${res.status})`);
        return json({ text: data.choices?.[0]?.message?.content || '', model });
      }

      case 'gemini': {
        const geminiModel = model || 'gemini-3.6-flash';
        if (!/^[a-z0-9.\-_]{3,64}$/.test(geminiModel)) {
          return json({ error: 'Invalid model name' }, 400);
        }
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
        // 60s upstream budget â€” matches the client's AbortSignal.timeout(60000)
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
          if (fetchErr?.name === 'TimeoutError' || fetchErr?.name === 'AbortError') {
            return json({ error: 'Gemini upstream timed out after 60s' }, 500);
          }
          throw fetchErr;
        }
        const data = await res.json() as any;
        if (!res.ok) throw new Error(`Gemini error (${res.status})`);
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
          signal: AbortSignal.timeout(60_000),
        });
        const data = await res.json() as any;
        if (!res.ok) throw new Error(`OpenAI error (${res.status})`);
        return json({ text: data.choices?.[0]?.message?.content || '', model });
      }

      default:
        return json({ error: `Unsupported provider: ${provider}` }, 400);
    }
  } catch (err: any) {
    // SECURITY: never relay upstream error details to the client â€” they can
    // contain partial API keys or internal endpoint information.  Log the
    // real error server-side for debugging instead.
    console.error('AI generate error:', err);
    return json(
      { error: 'AI request failed' },
      500
    );
  }
}

async function handleAiGenerateStream(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json().catch(() => null) as any;
    const { provider, model, apiKey, messages } = body ?? {};

    if (!provider || !messages) {
      return json({ error: 'Missing required fields: provider, and messages or prompt' }, 400);
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          const chunks = await collectStreamChunks(provider, model, apiKey, messages, env, request);
          for (const chunk of chunks) {
            controller.enqueue(encoder.encode(chunk));
          }
        } catch (err: any) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(err?.message || 'upstream error') })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err: any) {
    return json({ error: 'AI request failed' }, 500);
  }
}

async function readBodyText(res: any): Promise<string> {
  if (typeof res.text === 'function') {
    return res.text();
  }
  if (res.body instanceof ReadableStream) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let result = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value);
    }
    return result;
  }
  if (typeof res.json === 'function') {
    const json = await res.json();
    return JSON.stringify(json);
  }
  return '';
}

async function collectStreamChunks(
  provider: string, model: string, apiKey: string, messages: any[], env: Env, request: Request,
): Promise<string[]> {
  switch (provider) {
    case 'openrouter': {
      if (!apiKey) return [`data: ${JSON.stringify({ error: 'apiKey is required' })}\n\n`];
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://website.vasudevaya.workers.dev',
          'X-Title': 'VantaOS',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          model: model || 'openai/gpt-4o',
          messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
          stream: true,
        }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) return [`data: ${JSON.stringify({ error: `OpenRouter error (${res.status})` })}\n\n`];
      return extractSseContent((await readBodyText(res)).trim());
    }

    case 'gemini': {
      const geminiModel = model || 'gemini-3.6-flash';
      if (!/^[a-z0-9.\-_]{3,64}$/.test(geminiModel)) {
        return [`data: ${JSON.stringify({ error: 'Invalid model name' })}\n\n`];
      }
      const key = apiKey || env.GEMINI_API_KEY;
      if (!key || key === 'MY_GEMINI_API_KEY') {
        return [`data: ${JSON.stringify({ error: 'Gemini API key required' })}\n\n`];
      }
      if (!apiKey) {
        const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
        if (!isSameSiteRequest(request)) {
          return [`data: ${JSON.stringify({ error: 'Server-key Gemini access denied' })}\n\n`];
        }
        const gate = checkServerGemini(ip, Number(env.GEMINI_SERVER_KEY_DAILY_LIMIT ?? 200));
        if (!gate.allowed) {
          return [`data: ${JSON.stringify({ error: gate.error })}\n\n`];
        }
      }
      const contents = messages.map((m: any) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] }));
      let res: Response;
      try {
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${key}&stream=true`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents }),
            signal: AbortSignal.timeout(60_000),
          }
        );
      } catch (fetchErr: any) {
        if (fetchErr?.name === 'TimeoutError' || fetchErr?.name === 'AbortError') {
          return [`data: ${JSON.stringify({ error: 'Gemini upstream timed out after 60s' })}\n\n`];
        }
        throw fetchErr;
      }
      if (!res.ok) return [`data: ${JSON.stringify({ error: `Gemini error (${res.status})` })}\n\n`];
      return extractSseContent((await readBodyText(res)).trim());
    }

    case 'openai': {
      if (!apiKey) return [`data: ${JSON.stringify({ error: 'apiKey is required' })}\n\n`];
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          model: model || 'gpt-4o-mini',
          messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
          stream: true,
        }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) return [`data: ${JSON.stringify({ error: `OpenAI error (${res.status})` })}\n\n`];
      return extractSseContent((await readBodyText(res)).trim());
    }

    default:
      return [`data: ${JSON.stringify({ error: `Unsupported provider: ${provider}` })}\n\n`];
  }
}

function extractSseContent(raw: string): string[] {
  const chunks: string[] = [];
  const events = raw.split(/\n\n/);
  for (const event of events) {
    if (!event.trim()) continue;
    const dataLine = event.split('\n').find((l) => l.startsWith('data:'));
    if (!dataLine) continue;
    const data = dataLine.slice(5).trimStart();
    if (data === '[DONE]') {
      chunks.push(`data: ${JSON.stringify({ done: true })}\n\n`);
      continue;
    }
    try {
      const parsed = JSON.parse(data);
      const content = parsed?.choices?.[0]?.delta?.content
        ?? parsed?.choices?.[0]?.message?.content
        ?? parsed?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('');
      if (content !== undefined && content !== '') {
        chunks.push(`data: ${JSON.stringify({ content })}\n\n`);
      }
    } catch {
      /* skip non-JSON */
    }
  }
  if (chunks.length === 0 && raw.length > 0) {
    chunks.push(`data: ${JSON.stringify({ done: true })}\n\n`);
  }
  return chunks;
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

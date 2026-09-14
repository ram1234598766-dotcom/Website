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
import { rateLimitCheck, rateLimitStore } from './rate-limit';
import { MODEL_PROXY_ALLOWED_HOSTS, isAllowedModelProxyUrl } from '../models/sources';

export { rateLimitCheck, rateLimitStore };

export interface Env {
  GEMINI_API_KEY?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GH_GRANT_SECRET?: string;
  GH_TOKENS?: KvLike;
  APP_ORIGIN?: string;
  NEXT_PUBLIC_FIREBASE_PROJECT_ID?: string;
}

function corsHeaders(origin: string | undefined): Record<string, string> {
  // H1 FIX: When origin is not allowlisted, do NOT echo it back with
  // credentials. Return null so the browser blocks cross-origin reads.
  const allowed = ['http://localhost:3000', 'https://website.vasudevaya.workers.dev', 'https://www.vantaos.org'];
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

    // POST /api/model-proxy
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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MODEL_PROXY_TIMEOUT_MS);
  try {
    const upstream = await fetch(targetRaw, {
      headers: {
        'Accept': '*/*',
        'User-Agent': 'VantaOS-model-proxy',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

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

    return new Response(upstream.body, { status: 200, headers });
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
        const geminiModel = model || 'gemini-2.5-flash';
        const key = apiKey || env.GEMINI_API_KEY;
        if (!key || key === 'MY_GEMINI_API_KEY') {
          return json(
            { error: 'Gemini API key required (add your key in Settings, or the server GEMINI_API_KEY is unset)' },
            400
          );
        }
        const contents = messages.map((m: any) => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }],
        }));
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${key}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents }),
          }
        );
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
    return json(
      { error: err.message || 'AI request failed' },
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
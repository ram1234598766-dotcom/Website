/**
 * VantaOS Worker — handles API routes alongside static assets (from out/)
 *
 * This Worker runs when using `npx wrangler deploy`. The [assets] config in
 * wrangler.toml serves the static export (out/) automatically. This Worker
 * only intercepts requests to /api/* paths and handles SPA fallback.
 */

import { GitHubOAuthService, OAuthCallbackError, type KvLike } from './github-proxy';
import { verifyFirebaseIdToken } from './firebase-verify';
import { verifyGrant, type GrantClaims } from './grants';

export interface Env {
  GEMINI_API_KEY?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GH_GRANT_SECRET?: string;
  GH_TOKENS?: KvLike;
  APP_ORIGIN?: string;
  NEXT_PUBLIC_FIREBASE_PROJECT_ID?: string;
}

const FALLBACK_PROJECT_ID = 'website-6e8b1';

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json', ...extra },
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
  return env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || FALLBACK_PROJECT_ID;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    try {
      // GET /api/health
      if (request.method === 'GET' && path === '/api/health') {
        return json(
          {
            ok: true,
            uptimeSeconds: 0,
            environment: 'cloudflare-worker',
            version: '2.0.0',
            timestamp: new Date().toISOString(),
          },
          200
        );
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
      return json({ error: err.message || 'Internal error' }, 500);
    }
  },
};

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
      res.headers.set('Access-Control-Allow-Origin', env.APP_ORIGIN || '*');
      return res;
    } catch (err) {
      if (err instanceof OAuthCallbackError) {
        const res = new Response(
          JSON.stringify({ error: err.message }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
        res.headers.set('Access-Control-Allow-Origin', env.APP_ORIGIN || '*');
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
  out.headers.set('Access-Control-Allow-Origin', '*');
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

    if (!provider || !apiKey) {
      return json(
        { error: 'Missing required fields: provider, apiKey, and messages or prompt' },
        400
      );
    }

    switch (provider) {
      case 'openrouter': {
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
        const contents = messages.map((m: any) => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }],
        }));
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
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
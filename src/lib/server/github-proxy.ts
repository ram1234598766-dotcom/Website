/**
 * Server-side GitHub OAuth + proxy for VantaOS.
 *
 * Closes the Phase 5 token boundary: the browser never holds a GitHub access
 * token. The Worker runs the OAuth dance, stores the access token in KV keyed
 * by Firebase uid, and issues the browser a short-lived, HMAC-signed grant.
 * Every GitHub API call is proxied through the Worker, which re-derives the
 * actor from the verified Firebase uid, performs server-side repository write
 * checks (fresh-parent push protection), and maps GitHub failures to
 * actionable guidance.
 */

import { base64UrlToBytes, bytesToBase64Url, hmacSha256, timingSafeEqual } from './crypto';
import { signGrant, verifyGrant, type GrantClaims } from './grants';

const GH_API = 'https://api.github.com';
const GH_LOGIN = 'https://github.com/login/oauth';

export interface KvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface GitHubEnvLike {
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GH_GRANT_SECRET?: string;
  APP_ORIGIN?: string;
  GH_TOKENS?: KvLike;
  NEXT_PUBLIC_FIREBASE_PROJECT_ID?: string;
}

export interface GitHubOAuthDeps {
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
  nowSec?: () => number;
}

const DEFAULT_SCOPE = 'user:email repo';
const KV_TTL_SECONDS = 15 * 60;

export function kvKeyForUid(uid: string): string {
  return `gh:${uid}`;
}

// ─── OAuth state (binds the callback to the Firebase uid that started it) ───

function stateBody(uid: string, nonce: string): string {
  return `1.${uid}.${nonce}`;
}

export async function makeOAuthState(
  secret: string,
  uid: string,
  deps: GitHubOAuthDeps
): Promise<string> {
  const nonce = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(16)));
  const body = stateBody(uid, nonce);
  const sig = await hmacSha256(secret, body);
  return `${body}.${bytesToBase64Url(sig)}`;
}

export async function verifyOAuthState(
  secret: string,
  state: string,
  deps: GitHubOAuthDeps
): Promise<string | null> {
  const parts = state.split('.');
  if (parts.length !== 4) return null;
  const [version, uid, nonce, sigB64] = parts;
  if (version !== '1' || !uid || !nonce || !sigB64) return null;
  const expected = await hmacSha256(secret, stateBody(uid, nonce));
  let actual: Uint8Array;
  try {
    actual = base64UrlToBytes(sigB64);
  } catch {
    return null;
  }
  if (!timingSafeEqual(expected, actual)) return null;
  return uid;
}

// ─── Access-token exchange ───────────────────────────────────────────────────

export async function exchangeCodeForToken(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
  fetchImpl: (url: string, init?: RequestInit) => Promise<Response>
): Promise<string> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetchImpl(`${GH_LOGIN}/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });
  const data = (await res.json()) as {
    access_token?: string;
    error_description?: string;
    error?: string;
  };
  if (!res.ok || !data.access_token) {
    const detail = data.error_description || data.error || `status ${res.status}`;
    throw new Error(`GitHub token exchange failed: ${detail}`);
  }
  return data.access_token;
}

export function buildAuthorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
  scope?: string;
}): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    scope: opts.scope ?? DEFAULT_SCOPE,
    state: opts.state,
    // Explicitly request an access token (not a code-only grant) for the
    // classic OAuth App flow used by `gh` and our proxy.
    response_type: 'code',
  });
  return `${GH_LOGIN}/authorize?${params.toString()}`;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class GitHubOAuthService {
  constructor(
    private readonly env: GitHubEnvLike,
    private readonly deps: GitHubOAuthDeps = {}
  ) {}

  private get clientId(): string {
    return this.env.GITHUB_CLIENT_ID ?? '';
  }

  private get clientSecret(): string {
    return this.env.GITHUB_CLIENT_SECRET ?? '';
  }

  private get grantSecret(): string {
    return this.env.GH_GRANT_SECRET ?? '';
  }

  private get appOrigin(): string {
    return this.env.APP_ORIGIN?.replace(/\/$/, '') || 'http://localhost:3000';
  }

  private get kv(): KvLike | undefined {
    return this.env.GH_TOKENS;
  }

  private get fetchImpl(): (url: string, init?: RequestInit) => Promise<Response> {
    return this.deps.fetchImpl ?? fetch;
  }

  private redirectUri(): string {
    return `${this.appOrigin}/api/gh/callback`;
  }

  /** Step 1: mint a signed state and the GitHub authorize URL for a uid. */
  async startAuthorize(uid: string): Promise<{ url: string }> {
    if (!this.clientId) {
      throw new Error('GitHub OAuth is not configured on this deployment.');
    }
    const state = await makeOAuthState(this.grantSecret, uid, this.deps);
    return {
      url: buildAuthorizeUrl({
        clientId: this.clientId,
        redirectUri: this.redirectUri(),
        state,
      }),
    };
  }

  /** Step 2: exchange `code` for a token, store it, and return the grant. */
  async processCallback({ code, state }: { code: string; state: string }): Promise<{
    location: string;
  }> {
    const uid = await verifyOAuthState(this.grantSecret, state, this.deps);
    if (!uid) {
      throw new OAuthCallbackError('OAuth state did not verify — sign-in rejected.');
    }
    if (!this.clientSecret) {
      throw new OAuthCallbackError('GitHub OAuth is not configured on this deployment.');
    }
    const accessToken = await exchangeCodeForToken(
      this.clientId,
      this.clientSecret,
      code,
      this.redirectUri(),
      this.fetchImpl
    );
    if (!this.kv) {
      throw new OAuthCallbackError('GitHub token storage is not configured.');
    }
    await this.kv.put(kvKeyForUid(uid), accessToken, {
      expirationTtl: 60 * 24 * 60 * 60, // 60 days, GitHub token lifetime bound
    });
    const grant = await signGrant(this.grantSecret, uid, {
      nowSec: this.deps.nowSec?.(),
    });
    return { location: `${this.appOrigin}/#gh_grant=${encodeURIComponent(grant)}` };
  }

  /** Mint a fresh grant when KV already holds a token for the uid. */
  async createGrant(uid: string): Promise<string | null> {
    if (!this.kv) return null;
    const token = await this.kv.get(kvKeyForUid(uid));
    if (!token) return null;
    return signGrant(this.grantSecret, uid, {
      nowSec: this.deps.nowSec?.(),
    });
  }

  /** Store an access token obtained via the Firebase popup flow. */
  async importToken(uid: string, accessToken: string): Promise<string> {
    if (!this.kv) throw new Error('GitHub token storage is not configured.');
    if (accessToken.length < 16) {
      throw new Error('Refusing to import a token that looks invalid.');
    }
    await this.kv.put(kvKeyForUid(uid), accessToken, {
      expirationTtl: 60 * 24 * 60 * 60,
    });
    return signGrant(this.grantSecret, uid, {
      nowSec: this.deps.nowSec?.(),
    });
  }

  /** Revoke: drop the KV entry so every existing grant fails closed. */
  async revoke(uid: string): Promise<void> {
    if (this.kv) await this.kv.delete(kvKeyForUid(uid));
  }

  // ─── Proxy ─────────────────────────────────────────────────────────────────

  /**
   * Proxies a request to api.github.com as the stored access token, after
   * server-side checks: the actor is the grant-bound uid (never a
   * browser-supplied identity), and ref updates get a fresh-parent check.
   */
  async proxy(
    pathAfterPrefix: string,
    request: Request,
    claims: GrantClaims
  ): Promise<Response> {
    if (!this.kv) return json({ error: 'GitHub storage not configured.' }, 503);
    const accessToken = await this.kv.get(kvKeyForUid(claims.uid));
    if (!accessToken) {
      return json(
        { error: 'GitHub is not connected. Re-connect your account.', needsConnect: true },
        401
      );
    }

    const isRefUpdate =
      request.method === 'PATCH' &&
      /^\/repos\/[^/]+\/[^/]+\/git\/refs\/heads\/[^/]+/.test(pathAfterPrefix);

    let body: BodyInit | null = null;
    if (isRefUpdate) {
      // Read the body once, apply the fresh-parent check, then forward the
      // same bytes upstream.
      const raw = await request.text();
      body = raw;
      const conflict = await this.checkFreshParent(
        pathAfterPrefix,
        raw,
        accessToken
      );
      if (conflict) return conflict;
    } else if (request.method !== 'GET' && request.method !== 'HEAD') {
      body = request.body;
    }

    const target = new URL(
      pathAfterPrefix,
      pathAfterPrefix.startsWith('/') ? GH_API : `${GH_API}/`
    );
    if (target.origin !== GH_API) {
      return json({ error: 'Invalid GitHub path.' }, 400);
    }

    const headers = new Headers(request.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);
    headers.set('Accept', 'application/vnd.github.v3+json');
    headers.set('X-GitHub-Api-Version', '2022-11-28');
    headers.delete('Host');

    const upstream = await this.fetchImpl(target.href, {
      method: request.method,
      headers,
      body,
    });

    if (upstream.status === 422) {
      const upstreamBody = await this.readJsonSafe(upstream);
      const mapped = mapUnprocessableEntity(upstreamBody, pathAfterPrefix);
      if (mapped) return mapped;
    }
    if (
      upstream.status === 403 &&
      upstream.headers.get('X-RateLimit-Remaining') === '0'
    ) {
      const reset = upstream.headers.get('X-RateLimit-Reset');
      const when = reset
        ? new Date(parseInt(reset, 10) * 1000).toISOString()
        : 'later';
      return json(
        {
          error: `GitHub API rate limit exceeded — retry after ${when}.`,
          code: 'rate_limited',
        },
        429
      );
    }

    const passthrough = new Response(upstream.body, upstream);
    passthrough.headers.set('X-Vantaos-Proxy', '1');
    return passthrough;
  }

  /** Server-side fresh-parent protection for ref updates. */
  private async checkFreshParent(
    pathAfterPrefix: string,
    rawBody: string,
    accessToken: string
  ): Promise<Response | null> {
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return null;
    }
    const expectedParent: string | undefined = payload?.expected_parent;
    if (!expectedParent) return null; // no expectation — rely on GitHub's fast-forward check

    const branch = pathAfterPrefix.match(
      /^\/repos\/[^/]+\/[^/]+\/git\/refs\/heads\/[^/]+$/
    );
    if (!branch) return null;
    const refUrl = `${GH_API}${branch[0]}`;
    const current = await this.fetchImpl(refUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!current.ok) return null;

    const currentSha = (await this.readJsonSafe(current))?.object?.sha as
      | string
      | undefined;
    if (currentSha && currentSha !== expectedParent) {
      return json(
        {
          error: 'This branch moved since you started editing.',
          code: 'stale_base',
          expectedParent,
          currentSha,
          message:
            'Fetch the latest changes, rebase or merge, then push again. ' +
            'Your local edits are safe — nothing was committed to the remote.',
        },
        409
      );
    }
    return null;
  }

  private async readJsonSafe(res: Response): Promise<any> {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }
}

/** Raised when the OAuth callback cannot be attributed to a real uid. */
export class OAuthCallbackError extends Error {}

/**
 * Maps GitHub's 422 on fast-forward/protected-branch failures to a readable
 * 409 with recovery guidance, so clients surface "pull first" instead of a
 * raw GitHub error.
 */
export function mapUnprocessableEntity(
  body: any,
  pathAfterPrefix: string
): Response | null {
  const msg = String(body?.message ?? '');
  if (msg.toLowerCase().includes('not a fast forward') || msg.toLowerCase().includes('non-fast-forward')) {
    return json(
      {
        error: 'Someone else pushed to this branch since you started.',
        code: 'push_conflict',
        message:
          'Fetch the latest changes, rebase or merge, then push again. ' +
          'Your local edits are safe — nothing was committed to the remote.',
      },
      409
    );
  }
  if (msg.toLowerCase().includes('branch protection rule')) {
    return json(
      {
        error: 'This branch is protected and rejects direct pushes.',
        code: 'protected_branch',
        message:
          'Create a pull request instead, or push to a non-protected branch.',
      },
      409
    );
  }
  return null;
}

const CORS_ALLOWED_ORIGINS = ['http://localhost:3000', 'https://website.vasudevaya.workers.dev', 'https://www.vantaos.org'];
function corsHeaders(origin: string | undefined): Record<string, string> {
  const safe = (origin && CORS_ALLOWED_ORIGINS.includes(origin)) ? origin : 'http://localhost:3000';
  return {
    'Access-Control-Allow-Origin': safe,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
  };
}
function json(body: unknown, status = 200, origin?: string): Response {
  const res = new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
  return res;
}
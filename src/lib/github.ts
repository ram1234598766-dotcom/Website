/**
 * Client-side GitHub integration for VantaOS (Phase 5 token boundary).
 *
 * The browser never holds a GitHub access token. It holds only a short-lived
 * HMAC-signed *grant* issued by the Worker after a real OAuth / Firebase
 * exchange. Every GitHub API call goes through the same-origin Worker proxy
 * (`/api/gh/*`), which derives the actor from the verified Firebase uid and
 * stores/uses the real token server-side.
 *
 * This module is deliberately importable in Node tests: no `firebase` import
 * and no `localStorage` access at module scope. The Firebase token getter is
 * injected by `client.ts` via `setFirebaseTokenGetter`.
 */

export class GitHubError extends Error {
  constructor(
    public message: string,
    public status?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

export function isGitHubGrantError(err: unknown): err is GitHubError {
  return err instanceof GitHubError;
}

/* ── Grant holder (memory only — explicit by design) ─────────────────────── */

let grant: string | null = null;
let firebaseTokenGetter: (() => Promise<string | null>) | null = null;

type GrantListener = (grant: string | null) => void;
const grantListeners = new Set<GrantListener>();

export function setFirebaseTokenGetter(
  getter: (() => Promise<string | null>) | null
): void {
  firebaseTokenGetter = getter;
}

/** Test seam: clears module-level state. Not part of the public API. */
export function __resetGitHubStateForTests(): void {
  grant = null;
  firebaseTokenGetter = null;
  grantListeners.clear();
}

export function hasGitHubGrant(): boolean {
  return grant !== null;
}

export function onGitHubGrantChange(listener: GrantListener): () => void {
  grantListeners.add(listener);
  return () => grantListeners.delete(listener);
}

function setGrant(value: string | null): void {
  grant = value;
  grantListeners.forEach((l) => {
    try {
      l(value);
    } catch {
      // listener errors must not break the flow
    }
  });
}

/**
 * Extracts a grant delivered via `/#gh_grant=…` (the worker's OAuth callback
 * landing), stores it in memory, and immediately strips it from the URL so it
 * never leaks through history/referrer. Call once after module load.
 */
export function captureGitHubGrantFromUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const m = /(?:^|[#&])gh_grant=([^&]+)/.exec(window.location.hash);
  if (!m?.[1]) return false;
  try {
    setGrant(decodeURIComponent(m[1]));
  } catch {
    return false;
  }
  try {
    window.history.replaceState(
      null,
      '',
      window.location.pathname + window.location.search
    );
  } catch {
    // non-critical: the grant was already captured
  }
  return true;
}

/* ── Server routes (same-origin Worker) ──────────────────────────────────── */

function apiBase(): string {
  // `GITHUB_API_ORIGIN` lets tests/advanced setups point at a Worker in dev.
  if (typeof process !== 'undefined' && (process as any).env?.GITHUB_API_ORIGIN) {
    return (process as any).env.GITHUB_API_ORIGIN;
  }
  return '';
}

async function postJson(path: string, body: unknown, bearer?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  const res = await fetch(`${apiBase()}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON response
  }
  if (!res.ok) {
    throw new GitHubError(
      data?.error || data?.message || `Request to ${path} failed (${res.status}).`,
      res.status,
      data?.code
    );
  }
  return data;
}

/** Starts the server-driven OAuth dance; the worker redirects back with a grant. */
export async function connectGitHubWithFirebase(firebaseToken: string): Promise<string> {
  const data = await postJson('/api/gh/authorize', { firebaseToken });
  if (!data?.url) {
    throw new GitHubError(
      'GitHub OAuth is not configured on this deployment.',
      503,
      'oauth_not_configured'
    );
  }
  if (typeof window !== 'undefined') {
    window.location.href = data.url;
  }
  return data.url;
}

/**
 * Stores an access token captured from the Firebase popup flow, server-side.
 * Called by `client.ts` after `signInWithOAuth('github')`.
 */
export async function importGitHubAccessToken(
  firebaseToken: string,
  accessToken: string
): Promise<void> {
  const data = await postJson('/api/gh/import', { firebaseToken, accessToken });
  if (data?.gh_grant) setGrant(data.gh_grant);
}

/** Mints a fresh grant when the server already holds a token for this uid. */
export async function refreshGitHubGrant(): Promise<boolean> {
  if (!firebaseTokenGetter) return false;
  let firebaseToken: string | null = null;
  try {
    firebaseToken = await firebaseTokenGetter();
  } catch {
    return false;
  }
  if (!firebaseToken) return false;
  const data = await postJson('/api/gh/session', {}, firebaseToken);
  if (data?.gh_grant) {
    setGrant(data.gh_grant);
    return true;
  }
  if (data?.needsConnect) setGrant(null);
  return false;
}

/** Revokes server-side: the KV entry is deleted so every grant fails closed. */
export async function revokeGitHub(): Promise<void> {
  try {
    if (grant) await postJson('/api/gh/revoke', {}, grant);
  } finally {
    setGrant(null);
  }
}

/* ── Proxied GitHub API ───────────────────────────────────────────────────── */

async function ensureGrant(): Promise<string> {
  if (grant) return grant;
  if (firebaseTokenGetter) {
    const ok = await refreshGitHubGrant();
    if (ok && grant) return grant;
  }
  throw new GitHubError(
    'GitHub is not connected. Connect GitHub to sync your code.',
    401,
    'needs_connect'
  );
}

export async function fetchGitHub(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const token = await ensureGrant();
  const res = await fetch(`${apiBase()}/api/gh${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (res.status === 401) {
    setGrant(null);
    try {
      const data = await res.json();
      throw new GitHubError(
        data?.message || 'GitHub session expired. Re-connect.',
        401,
        'needs_connect'
      );
    } catch (err) {
      if (err instanceof GitHubError) throw err;
      throw new GitHubError('GitHub session expired. Re-connect.', 401);
    }
  }

  if (!res.ok) {
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      // fall through to generic error
    }
    const msg = data?.error || data?.message || `GitHub API Error (${res.status})`;
    const code: string | undefined = data?.code;
    const status = res.status === 429 && !code ? 'rate_limited' : (code ?? undefined);
    if (status === 'rate_limited' || res.status === 429) {
      throw new GitHubError(
        data?.error || 'GitHub API rate limit exceeded. Try again later.',
        429,
        'rate_limited'
      );
    }
    throw new GitHubError(msg, res.status, code);
  }

  if (res.status === 204 || res.status === 202) return null;
  const contentType = res.headers.get('content-type') || '';
  return contentType.includes('json') ? res.json() : res.text();
}

/* ── High-level GitHub operations (unchanged surface) ────────────────────── */

export async function getUserRepos() {
  return fetchGitHub('/user/repos?sort=updated&per_page=100');
}

export async function getRepoTree(owner: string, repo: string, branch: string) {
  return fetchGitHub(`/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);
}

export async function getFileContent(owner: string, repo: string, path: string) {
  const data = await fetchGitHub(`/repos/${owner}/${repo}/contents/${path}`);
  if (data.content && data.encoding === 'base64') {
    return decodeURIComponent(escape(atob(data.content)));
  }
  return '';
}

export async function getDefaultBranch(owner: string, repo: string) {
  const data = await fetchGitHub(`/repos/${owner}/${repo}`);
  return data.default_branch;
}

export async function getLatestCommit(owner: string, repo: string, branch: string) {
  const data = await fetchGitHub(`/repos/${owner}/${repo}/git/ref/heads/${branch}`);
  return data.object.sha;
}

export async function getCommitTree(owner: string, repo: string, commitSha: string) {
  const data = await fetchGitHub(`/repos/${owner}/${repo}/git/commits/${commitSha}`);
  return data.tree.sha;
}

export async function createBlob(owner: string, repo: string, content: string) {
  const data = await fetchGitHub(`/repos/${owner}/${repo}/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({
      content: btoa(unescape(encodeURIComponent(content))),
      encoding: 'base64',
    }),
  });
  return data.sha;
}

export async function createTree(owner: string, repo: string, baseTreeSha: string, tree: any[]) {
  const data = await fetchGitHub(`/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseTreeSha, tree }),
  });
  return data.sha;
}

export async function createCommit(owner: string, repo: string, message: string, treeSha: string, parentSha: string) {
  const data = await fetchGitHub(`/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message, tree: treeSha, parents: [parentSha] }),
  });
  return data.sha;
}

/**
 * Pushes a ref update. `expectedParent` enables the worker's server-side
 * fresh-parent check (stale base → 409) in addition to GitHub's own
 * fast-forward check (non-fast-forward → 409).
 */
export async function updateRef(
  owner: string,
  repo: string,
  branch: string,
  commitSha: string,
  expectedParent?: string
) {
  return fetchGitHub(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    body: JSON.stringify({
      sha: commitSha,
      force: false,
      ...(expectedParent ? { expected_parent: expectedParent } : {}),
    }),
  });
}
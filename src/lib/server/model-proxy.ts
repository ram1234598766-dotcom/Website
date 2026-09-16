/**
 * VantaOS server-side model proxy handler — GET /api/model-proxy.
 *
 * Pure Workerd API only (fetch/Request/Response/AbortController) — no Next.js
 * or Node.js imports. This lets the Cloudflare custom worker (worker.ts) run
 * the proxy at the native workerd layer, where returning `upstream.body`
 * streams the response zero-copy (CPU-exempt). The same handler is used by the
 * Next.js route (app/api/model-proxy/route.ts) so browser CORS + SSRF behavior
 * stays byte-for-byte identical between the two entry points.
 */

import { MODEL_PROXY_ALLOWED_HOSTS, isAllowedModelProxyRedirectUrl, isAllowedModelProxyUrl } from '../models/sources';

export const MODEL_PROXY_TIMEOUT_MS = 20_000;

const ALLOWED_ORIGINS = ['http://localhost:3000', 'https://website.vasudevaya.workers.dev', 'https://www.vantaos.org'];

function corsHeaders(origin: string | undefined): Record<string, string> {
  const safe = (origin && ALLOWED_ORIGINS.includes(origin)) ? origin : null;
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

/**
 * GET /api/model-proxy — server-side fetch of HuggingFace model files so the
 * browser never hits upstream CORS (HF only allows huggingface.co). Supports
 * Range forwarding for `.onnx_data` weight shards (>500MB) and 206 passthrough
 * with CPU-exempt body streaming.
 */
export async function handleModelProxyGet(request: Request): Promise<Response> {
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
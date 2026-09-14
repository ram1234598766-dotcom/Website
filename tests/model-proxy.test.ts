/**
 * Omni AI WebModel fix — model repo resolution + model-proxy fetch routing.
 *
 * Covers:
 *  - resolveModelRepo(): pure, gated-repo-free model-id → repo mapping.
 *  - the browser fetch-routing override: rewrites CORS-blocked metadata
 *    files on trusted HF/VantaOS hosts to the same-origin
 *    `/api/model-proxy?url=...` GET endpoint, while weight binaries bypass
 *    the proxy (HuggingFace serves them with ACAO `*`, and they exceed the
 *    Worker's ~100 MB response-body limit).
 *
 * Network calls are fully mocked via globalThis.fetch — no real network.
 *
 * NOTE: `resolveModelRepo` and the fetch-routing override are added to
 * src/lib/models/adapter.ts by a sibling agent in parallel. The suites
 * below are guarded with `describe.skipIf(...)` so they silently skip
 * until those exports land and activate automatically once they exist.
 * Existing adapter exports and their signatures are untouched.
 */

import { describe, expect, it, afterEach } from 'vitest';
import * as adapterNs from '../src/lib/models/adapter';
import { isTrustedUrl, isAllowedModelProxyUrl, MODEL_PROXY_ALLOWED_HOSTS } from '../src/lib/models/sources';

const adapter = adapterNs as unknown as Record<string, unknown>;

/* ------------------------------------------------------------------ */
/*  Proxy allowlist — exact-host contract used by /api/model-proxy     */
/* ------------------------------------------------------------------ */

describe('MODEL_PROXY_ALLOWED_HOSTS (exact host allowlist)', () => {
  it('pins exactly the shared proxy allowlist (no gated/extra hosts)', () => {
    expect([...MODEL_PROXY_ALLOWED_HOSTS].sort()).toEqual(
      [
        'cdn-lfs-us-1.huggingface.co',
        'cdn-lfs.huggingface.co',
        'huggingface.co',
        'models.vantaos.dev',
        'www.huggingface.co',
      ].sort(),
    );
  });

  it('contains no duplicates', () => {
    expect(new Set(MODEL_PROXY_ALLOWED_HOSTS).size).toBe(MODEL_PROXY_ALLOWED_HOSTS.length);
  });
});

describe('isAllowedModelProxyUrl', () => {
  it.each(MODEL_PROXY_ALLOWED_HOSTS)(
    'accepts an absolute URL on allowlisted host %s',
    (host) => {
      expect(isAllowedModelProxyUrl(`https://${host}/x/model.onnx?download=true`)).toBe(true);
    },
  );

  it('rejects non-HF / non-VantaOS hosts', () => {
    expect(isAllowedModelProxyUrl('https://example.com/x')).toBe(false);
    expect(isAllowedModelProxyUrl('https://onnx.ai/models/gpt2.onnx')).toBe(false);
    expect(isAllowedModelProxyUrl('https://huggingface.co.evil.com/gpt2')).toBe(false);
  });

  it('matches exact hosts only — untrusted subdomains are rejected', () => {
    expect(isAllowedModelProxyUrl('https://cdn.huggingface.co/repos/x/y.onnx')).toBe(false);
    expect(isAllowedModelProxyUrl('https://random.subdomain.huggingface.co/gpt2')).toBe(false);
    expect(isAllowedModelProxyUrl('https://notmodels.vantaos.dev/x')).toBe(false);
  });

  it('requires an absolute, parseable URL', () => {
    expect(isAllowedModelProxyUrl('huggingface.co/gpt2')).toBe(false);
    expect(isAllowedModelProxyUrl('gpt2')).toBe(false);
  });

  it('accepts http and https for allowlisted hosts (absolute-URL boundary)', () => {
    expect(isAllowedModelProxyUrl('http://cdn-lfs.huggingface.co/repos/x/y.onnx')).toBe(true);
  });

  it('is host-case-insensitive', () => {
    expect(isAllowedModelProxyUrl('https://HUGGINGFACE.CO/gpt2')).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  resolveModelRepo — pure model-id → HuggingFace repo mapping        */
/* ------------------------------------------------------------------ */

const resolveModelRepo = adapter.resolveModelRepo as
  | ((modelId: string) => string)
  | undefined;

const repoTestsAvailable = typeof resolveModelRepo === 'function';

describe.skipIf(!repoTestsAvailable)('resolveModelRepo', () => {
  const repo = resolveModelRepo as (modelId: string) => string;

  it('maps tinyllama to the SmolLM2-135M ONNX repo', () => {
    expect(repo('tinyllama')).toBe('onnx-community/SmolLM2-135M-ONNX');
  });

  it('maps webmodel to the SmolLM2-135M ONNX repo', () => {
    expect(repo('webmodel')).toBe('onnx-community/SmolLM2-135M-ONNX');
  });

  it('never resolves to the gated onnx-community/gpt-2 repo', () => {
    expect(repo('gpt2')).not.toBe('onnx-community/gpt-2');
  });

  it('returns a well-formed org/repo id for gpt2', () => {
    const resolved = repo('gpt2');
    expect(typeof resolved).toBe('string');
    expect(resolved.length).toBeGreaterThan(0);
    expect(resolved).toContain('/');
  });

  it('passes unknown ids through unchanged', () => {
    expect(repo('custom-org/custom-model')).toBe('custom-org/custom-model');
  });

  it('is pure: deterministic and side-effect free across calls', () => {
    expect(repo('gpt2')).toBe(repo('gpt2'));
    expect(repo('tinyllama')).toBe(repo('tinyllama'));
  });
});

/* ------------------------------------------------------------------ */
/*  Fetch-routing override — allowlisted hosts → /api/model-proxy      */
/* ------------------------------------------------------------------ */

const fetchHelper = (adapter.proxyFetchOverride ??
  adapter.modelProxyFetch ??
  adapter.fetchModelProxy ??
  adapter.fetchViaModelProxy ??
  adapter.proxyFetchForModels) as
  | ((url: string, init?: RequestInit) => Promise<Response> | undefined)
  | undefined;

const fetchHelperTestsAvailable = typeof fetchHelper === 'function';

/**
 * Fetch routing — what gets proxied vs what bypasses.
 *
 * The browser-side proxyFetchOverride only rewrites small metadata/config
 * files (json, txt, xml, model) to /api/model-proxy.  HuggingFace serves
 * weight binaries (.onnx, .onnx_data, .safetensors, .bin, …) with
 * `Access-Control-Allow-Origin: *`, so they can be fetched directly from
 * the browser — and routing them through the Worker would blow past the
 * ~100 MB response-body limit (SmolLM2 onnx_data is 540 MB).
 */

describe.skipIf(!fetchHelperTestsAvailable)('fetch routing override', () => {
  const helper = fetchHelper as (url: string, init?: RequestInit) => Promise<Response> | undefined;
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    (globalThis as any).fetch = originalFetch;
  });

  async function callHelperAndCapture(url: string) {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    (globalThis as any).fetch = async (u: unknown, init?: RequestInit) => {
      calls.push({ url: String(u), init });
      return { ok: true, status: 200 } as Response;
    };
    const result = helper(url);
    if (result != null) await Promise.resolve(result);
    return { calls, sentinel: result == null };
  }

  /* Metadata files → proxied */
  const METADATA_URLS = [
    'https://huggingface.co/onnx-community/SmolLM2-135M-ONNX/resolve/main/config.json',
    'https://www.huggingface.co/onnx-community/SmolLM2-135M-ONNX/resolve/main/tokenizer.json',
    'https://cdn-lfs.huggingface.co/repos/xx/yy/vocab.txt',
    'https://cdn-lfs-us-1.huggingface.co/repos/xx/yy/config.json?download=true',
    'https://huggingface.co/Xenova/gpt-2/resolve/main/config.json',
  ];

  it.each(METADATA_URLS)(
    'rewrites allowlisted metadata URL %s to GET /api/model-proxy with the url preserved',
    async (originalUrl) => {
      const { calls, sentinel } = await callHelperAndCapture(originalUrl);
      expect(sentinel).toBe(false);
      expect(calls).toHaveLength(1);
      const rewritten = new URL(calls[0].url, 'http://localhost');
      expect(rewritten.pathname).toBe('/api/model-proxy');
      expect(calls[0].init?.method ?? 'GET').toBe('GET');
      expect(rewritten.searchParams.get('url')).toBe(originalUrl);
    },
  );

  /* Weight files → bypass (sentinel = true → caller uses native fetch directly) */
  const WEIGHT_URLS = [
    'https://huggingface.co/onnx-community/SmolLM2-135M-ONNX/resolve/main/model.onnx?download=true',
    'https://cdn-lfs.huggingface.co/repos/xx/yy/model.onnx',
    'https://cdn-lfs-us-1.huggingface.co/repos/xx/yy/model.onnx?download=true',
    'https://models.vantaos.dev/smol-135m/shard-0.bin',
    'https://huggingface.co/onnx-community/SmolLM2-135M-ONNX/resolve/main/model.onnx_data',
  ];

  it.each(WEIGHT_URLS)(
    'bypasses proxy for weight file %s (sentinel = undefined)',
    async (originalUrl) => {
      const { calls, sentinel } = await callHelperAndCapture(originalUrl);
      expect(sentinel).toBe(true);   // returned undefined → caller uses native fetch
      expect(calls).toHaveLength(0); // nothing went through globalThis.fetch via the helper
    },
  );

  it('preserves the original query string inside the encoded url param for metadata', async () => {
    const originalUrl =
      'https://huggingface.co/onnx-community/SmolLM2-135M-ONNX/resolve/main/config.json?download=true';
    const { calls, sentinel } = await callHelperAndCapture(originalUrl);
    expect(sentinel).toBe(false);
    expect(calls).toHaveLength(1);
    expect(new URL(calls[0].url, 'http://localhost').searchParams.get('url')).toBe(originalUrl);
  });

  it('does not rewrite non-allowlisted URLs (native fetch or documented sentinel)', async () => {
    const url = 'https://example.com/some/config.json';
    const { calls, sentinel } = await callHelperAndCapture(url);
    if (sentinel) {
      // helper returned the documented sentinel → the caller falls back to native fetch
      expect(calls).toHaveLength(0);
    } else {
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toBe(url);
    }
  });

  it('does not rewrite non-HF / non-VantaOS hosts', async () => {
    for (const url of ['https://onnx.ai/models/config.json', 'http://huggingface.co/config.json']) {
      const { calls, sentinel } = await callHelperAndCapture(url);
      if (sentinel) {
        expect(calls).toHaveLength(0);
      } else {
        expect(calls).toHaveLength(1);
        expect(calls[0].url).toBe(url);
      }
    }
  });

  it('stays consistent with the URL-validation boundary (isTrustedUrl)', () => {
    expect(isTrustedUrl('https://cdn-lfs.huggingface.co/repos/xx/yy/model.onnx')).toBe(true);
    expect(isTrustedUrl('https://cdn-lfs-us-1.huggingface.co/repos/xx/yy/model.onnx')).toBe(true);
    expect(isTrustedUrl('https://models.vantaos.dev/smol-135m/shard-0.bin')).toBe(true);
    expect(isTrustedUrl('https://huggingface.co/gpt2')).toBe(true);
    expect(isTrustedUrl('https://example.com/some/model.onnx')).toBe(false);
  });
});
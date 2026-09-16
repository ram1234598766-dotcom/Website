/**
 * VantaOS WebModel — trusted model source registry.
 *
 * Defines trusted sources from which models may be downloaded.
 * All shard URLs in a manifest must originate from a verified
 * trusted source before any download is initiated.
 */

import type { ModelManifest, ModelShard } from './manifest';

export interface ModelSource {
  name: string;
  baseURL: string;
  verified: boolean;
  allowedModels: string[];
}

const TRUSTED_SOURCES: ModelSource[] = [
  {
    name: 'HuggingFace',
    baseURL: 'https://huggingface.co',
    verified: true,
    allowedModels: [],
  },
  {
    name: 'VantaOS Official',
    baseURL: 'https://models.vantaos.dev',
    verified: true,
    allowedModels: [],
  },
];

function getBaseHostname(source: ModelSource): string {
  try {
    return new URL(source.baseURL).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/** Returns only verified (trusted) sources. */
export function getTrustedSources(): ModelSource[] {
  return TRUSTED_SOURCES.filter((s) => s.verified);
}

/**
 * Additional hostnames the server-side model proxy may fetch that are not
 * captured by the trusted-source base URLs.
 *
 * NOTE: HuggingFace CDN hosts (`cdn-lfs*.huggingface.co`,
 * `*.aws.cdn.hf.co`, etc.) are deliberately NOT listed here. Those hosts are
 * only ever reached as *redirect targets* (HF's `resolve/` endpoints 302 to
 * them for weight blobs), never as direct fetch targets — that churn-prone
 * set is validated by isAllowedModelProxyRedirectUrl at redirect time
 * instead, so CDN renames don't break the allowlist pin.
 */
const PROXY_EXTRA_HOSTS: readonly string[] = [
  'www.huggingface.co',
];

/**
 * Exact hostname allowlist for the server-side model proxy
 * (GET /api/model-proxy). Merges the verified trusted-source base
 * hostnames (huggingface.co, models.vantaos.dev) with PROXY_EXTRA_HOSTS.
 *
 * Matching is exact — deliberately narrower than isTrustedUrl's subdomain
 * wildcard — so an arbitrary subdomain of a trusted apex is never treated
 * as proxiable.
 */
export const MODEL_PROXY_ALLOWED_HOSTS: readonly string[] = [
  ...new Set([
    ...getTrustedSources().map((s) => getBaseHostname(s)),
    ...PROXY_EXTRA_HOSTS,
  ]),
];

/**
 * Checks whether an absolute http(s) URL may be fetched by the server-side
 * model proxy. The host is matched exactly against MODEL_PROXY_ALLOWED_HOSTS
 * after URL parsing — never by string prefix.
 */
export function isAllowedModelProxyUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }
  return MODEL_PROXY_ALLOWED_HOSTS.includes(parsed.hostname.toLowerCase());
}

/**
 * Checks whether a URL is an acceptable *post-redirect* target for the
 * server-side model proxy.
 *
 * The direct-fetch allowlist (MODEL_PROXY_ALLOWED_HOSTS) is exact and tight,
 * but HuggingFace's `resolve/` endpoints legitimately 302 weight-blob
 * downloads (`.onnx`, `.onnx_data`, LFS payloads) to a churn-prone set of
 * CDN subdomains (`cdn-lfs*.huggingface.co`, `*.aws.cdn.hf.co`,
 * `xet-bridge-use-1.aws.cdn.hf.co`, ...). Pinning those exact hosts next to
 * the apex would break whenever HF rotates CDN infrastructure.
 *
 * So the redirect check is a *suffix* rule over HuggingFace-owned zones
 * only: any host under `.huggingface.co` or `.hf.co` (HF's short domain from
 * which every CDN host descends) is accepted, and anything else — including
 * arbitrary third-party hosts the attacker might point a repo's resolve URL
 * at — is rejected. This blocks SSRF/open-redirect while tolerating HF CDN
 * churn. If a future redirect target lands outside these zones, validation
 * fails loudly rather than silently exfiltrating.
 */
export function isAllowedModelProxyRedirectUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }
  const hostname = parsed.hostname.toLowerCase();
  return (
    MODEL_PROXY_ALLOWED_HOSTS.includes(hostname) ||
    hostname.endsWith('.huggingface.co') ||
    hostname === 'huggingface.co' ||
    hostname.endsWith('.hf.co') ||
    hostname === 'hf.co'
  );
}

/**
 * Checks whether a URL belongs to a verified trusted source.
 *
 * Compares the URL's hostname against the hostname of each
 * verified source's baseURL. Requires HTTPS protocol.
 * Supports URL parsing with paths, query strings, and fragments.
 */
export function isTrustedUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;

  const hostname = parsed.hostname.toLowerCase();

  return getTrustedSources().some((source) => {
    const baseHostname = getBaseHostname(source);
    return (
      hostname === baseHostname || hostname.endsWith('.' + baseHostname)
    );
  });
}

/**
 * Verifies that a model manifest's shard URLs all originate from
 * a verified trusted source.
 *
 * @param manifest - The manifest to verify
 * @returns true when all shard URLs are from trusted sources
 * @throws Error when any shard URL is untrusted, with details
 *         about which shards failed verification
 */
export function verifyModelSource(manifest: ModelManifest): boolean {
  const untrusted: { index: number; url: string }[] = [];

  for (let i = 0; i < manifest.shards.length; i++) {
    const shard: ModelShard = manifest.shards[i];
    if (!isTrustedUrl(shard.url)) {
      untrusted.push({ index: i, url: shard.url });
    }
  }

  if (untrusted.length > 0) {
    const detail = untrusted
      .map((u) => `shard ${u.index}: ${u.url}`)
      .join('; ');
    throw new Error(
      `Untrusted model source for ${manifest.id}: ${detail}. ` +
        `Models must come from verified trusted sources: ${getTrustedSources()
          .map((s) => s.name)
          .join(', ')}.`,
    );
  }

  return true;
}

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

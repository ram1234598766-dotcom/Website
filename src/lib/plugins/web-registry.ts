import type { PluginManifest } from './manifest';
import { isValidManifest } from './manifest';

export interface GitHubPluginSource {
  owner: string;
  repo: string;
  path: string;
  branch?: string;
}

export interface NpmPluginSource {
  packageName: string;
}

function isGitHubRawUrl(url: string): boolean {
  return /^https:\/\/raw\.githubusercontent\.com\//.test(url);
}

function isNpmRegistryUrl(url: string): boolean {
  return /^https:\/\/registry\.npmjs\.org\//.test(url);
}

function parseGitHubRawUrl(url: string): GitHubPluginSource | null {
  const match = url.match(
    /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/(.+)$/
  );
  if (!match) return null;
  const [, owner, repo, rest] = match;
  const parts = rest.split('/');
  const branch = parts[0];
  const path = parts.slice(1).join('/');
  return { owner, repo, path, branch: branch || 'main' };
}

function parseNpmRegistryUrl(url: string): string | null {
  const match = url.match(/^https:\/\/registry\.npmjs\.org\/([^/]+)\/latest$/);
  if (!match) return null;
  return match[1];
}

async function fetchAndValidate(url: string): Promise<PluginManifest> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Failed to fetch manifest: ${res.status}`);
    }
    let raw: unknown;
    try {
      raw = await res.json();
    } catch {
      throw new Error('Manifest response was not valid JSON');
    }
    if (!isValidManifest(raw)) {
      throw new Error('Invalid plugin manifest');
    }
    return raw;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(`Fetching manifest timed out after 30s`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchGitHubManifest(
  source: GitHubPluginSource
): Promise<PluginManifest> {
  const branch = source.branch || 'main';
  const url = `https://raw.githubusercontent.com/${source.owner}/${source.repo}/${branch}/${source.path}`;
  return fetchAndValidate(url);
}

export async function fetchNpmManifest(
  source: NpmPluginSource
): Promise<PluginManifest> {
  const url = `https://registry.npmjs.org/${source.packageName}/latest`;
  return fetchAndValidate(url);
}

export async function fetchWebManifest(url: string): Promise<PluginManifest> {
  if (isGitHubRawUrl(url)) {
    const parsed = parseGitHubRawUrl(url);
    if (parsed) return fetchGitHubManifest(parsed);
  }
  if (isNpmRegistryUrl(url)) {
    const pkgName = parseNpmRegistryUrl(url);
    if (pkgName) return fetchNpmManifest({ packageName: pkgName });
  }
  return fetchAndValidate(url);
}

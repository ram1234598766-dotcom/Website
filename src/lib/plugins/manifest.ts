/**
 * VantaOS Plugin — Manifest schema and validation.
 */

export type PluginCapability =
  | 'workspace:read'
  | 'workspace:write'
  | 'ai:call'
  | 'network:request'
  | 'terminal:execute';

export type PluginEntryPoint = {
  kind: 'inline';
  script: string;
} | {
  kind: 'url';
  url: string;
};

export type SignatureAlgorithm = 'hmac-sha256' | 'ed25519';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  capabilities: readonly PluginCapability[];
  entryPoint: PluginEntryPoint;
  signatureAlgorithm: SignatureAlgorithm;
  signature: string;
}

const ALLOWED_CAPABILITIES: readonly PluginCapability[] = [
  'workspace:read',
  'workspace:write',
  'ai:call',
  'network:request',
  'terminal:execute',
];

export function isValidManifest(raw: unknown): raw is PluginManifest {
  if (typeof raw !== 'object' || raw === null) return false;
  const m = raw as Record<string, unknown>;

  if (typeof m.id !== 'string' || m.id.length === 0) return false;
  if (typeof m.name !== 'string' || m.name.length === 0) return false;
  if (typeof m.version !== 'string' || m.version.length === 0) return false;
  if (typeof m.description !== 'string') return false;
  if (typeof m.author !== 'string' || m.author.length === 0) return false;
  if (!Array.isArray(m.capabilities)) return false;
  for (const c of m.capabilities) {
    if (!ALLOWED_CAPABILITIES.includes(c as PluginCapability)) return false;
  }
  if (typeof m.signatureAlgorithm !== 'string') return false;
  if (m.signatureAlgorithm !== 'hmac-sha256' && m.signatureAlgorithm !== 'ed25519') return false;
  if (typeof m.signature !== 'string' || m.signature.length === 0) return false;

  if (typeof m.entryPoint !== 'object' || m.entryPoint === null) return false;
  const ep = m.entryPoint as Record<string, unknown>;
  if (typeof ep.kind !== 'string') return false;
  if (ep.kind === 'inline') {
    if (typeof ep.script !== 'string') return false;
  } else if (ep.kind === 'url') {
    if (typeof ep.url !== 'string' || ep.url.length === 0) return false;
  } else {
    return false;
  }

  return true;
}

export function manifestToSign(manifest: PluginManifest): string {
  const payload = {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    author: manifest.author,
    capabilities: manifest.capabilities,
    entryPoint: manifest.entryPoint,
  };
  return JSON.stringify(payload);
}

export function getCapabilities(): readonly PluginCapability[] {
  return ALLOWED_CAPABILITIES;
}

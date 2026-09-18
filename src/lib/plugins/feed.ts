import type { PluginManifest } from './manifest';

export interface FeedPluginMeta {
  name: string;
  description: string;
  version: string;
  capabilities: PluginManifest['capabilities'];
  iconUrl: string;
  rating: number;
  downloadsCount: number;
}

export const FEED_PLUGINS: FeedPluginMeta[] = [
  {
    name: 'Prettier',
    description: 'Auto-formatter for JavaScript, HTML, CSS, and JSON',
    version: '3.6.0',
    capabilities: ['workspace:write'],
    iconUrl: 'https://cdn.jsdelivr.net/gh/prettier/prettier@main/assets/icon.svg',
    rating: 4.9,
    downloadsCount: 28400000,
  },
  {
    name: 'ESLint',
    description: 'JavaScript linter with customizable rule sets',
    version: '9.0.0',
    capabilities: ['workspace:read', 'workspace:write'],
    iconUrl: 'https://cdn.jsdelivr.net/gh/eslint/eslint@main/logo.png',
    rating: 4.8,
    downloadsCount: 19200000,
  },
  {
    name: 'Tailwind Intellisense',
    description: 'Autocomplete for Tailwind CSS utility classes',
    version: '1.0.0',
    capabilities: ['workspace:read', 'workspace:write'],
    iconUrl: 'https://cdn.jsdelivr.net/gh/tailwindlabs/tailwindcss@main/icons/tailwind.png',
    rating: 4.7,
    downloadsCount: 8600000,
  },
  {
    name: 'GitLens',
    description: 'Git power in the IDE — blame, history, diffs, and more',
    version: '2.0.0',
    capabilities: ['workspace:read'],
    iconUrl: 'https://cdn.jsdelivr.net/gh/gitlens/gitlens@main/assets/gitlens-icon.png',
    rating: 4.8,
    downloadsCount: 12100000,
  },
  {
    name: 'Path Intellisense',
    description: 'Autocomplete for file paths in import statements',
    version: '1.0.0',
    capabilities: ['workspace:read'],
    iconUrl: 'https://cdn.jsdelivr.net/gh/microsoft/vscode-path-intellisense@main/icon.svg',
    rating: 4.6,
    downloadsCount: 5300000,
  },
  {
    name: 'Error Lens',
    description: 'Inline error and warning annotations in the editor',
    version: '1.0.0',
    capabilities: ['workspace:read'],
    iconUrl: 'https://cdn.jsdelivr.net/gh/username/errrorlens@main/icon.png',
    rating: 4.5,
    downloadsCount: 3100000,
  },
  {
    name: 'Docker',
    description: 'Manage Docker containers, images, and compose files',
    version: '1.2.0',
    capabilities: ['workspace:read', 'workspace:write', 'terminal:execute'],
    iconUrl: 'https://cdn.jsdelivr.net/gh/docker/docker@main/icon.svg',
    rating: 4.7,
    downloadsCount: 7400000,
  },
  {
    name: 'REST Client',
    description: 'Send HTTP requests and view responses inline',
    version: '2.1.0',
    capabilities: ['network:request', 'workspace:read'],
    iconUrl: 'https://cdn.jsdelivr.net/gh/Huachao/vscode-restclient@main/icon.png',
    rating: 4.6,
    downloadsCount: 6800000,
  },
];

function feedMetaToManifest(meta: FeedPluginMeta, id: string): PluginManifest {
  return {
    id,
    name: meta.name,
    version: meta.version,
    description: meta.description,
    author: 'Community',
    capabilities: meta.capabilities,
    entryPoint: { kind: 'inline', script: meta.name.toLowerCase().replace(/\s+/g, '-') },
    signatureAlgorithm: 'hmac-sha256',
    signature: `community-${id}-sig`,
  };
}

export function feedToManifests(): PluginManifest[] {
  return FEED_PLUGINS.map((meta, i) =>
    feedMetaToManifest(meta, FEED_PLUGINS[i].name.toLowerCase().replace(/\s+/g, '-'))
  );
}

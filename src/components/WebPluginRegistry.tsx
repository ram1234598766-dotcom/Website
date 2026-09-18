import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Puzzle,
  Search,
  Download,
  X,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Globe,
  Github,
  Package,
  Shield,
  Zap,
  Star,
} from 'lucide-react';
import {
  isValidManifest,
  type PluginManifest,
} from '../lib/plugins/manifest';
import { createRegistry, type PluginRecord, type Registry } from '../lib/plugins/registry';

const WEB_REGISTRIES = [
  {
    id: 'github',
    name: 'GitHub',
    icon: <Github size={16} />,
    color: '#24292e',
  },
  {
    id: 'npm',
    name: 'npm',
    icon: <Package size={16} />,
    color: '#cb3837',
  },
  {
    id: 'community',
    name: 'Community',
    icon: <Globe size={16} />,
    color: '#4a90d9',
  },
];

const COMMUNITY_PLUGINS: PluginManifest[] = [
  {
    id: 'prettier',
    name: 'Prettier',
    version: '3.6.0',
    description: 'Auto-formatter for JS, HTML, CSS',
    author: 'Prettier',
    capabilities: ['workspace:write'],
    entryPoint: { kind: 'inline', script: 'prettier' },
    signatureAlgorithm: 'hmac-sha256',
    signature: 'community-prettier-sig',
  },
  {
    id: 'eslint',
    name: 'ESLint',
    version: '9.0.0',
    description: 'JavaScript linter with rule customization',
    author: 'ESLint Team',
    capabilities: ['workspace:read'],
    entryPoint: { kind: 'inline', script: 'eslint' },
    signatureAlgorithm: 'hmac-sha256',
    signature: 'community-eslint-sig',
  },
  {
    id: 'tailwind-intellisense',
    name: 'Tailwind Intellisense',
    version: '1.0.0',
    description: 'Autocomplete for Tailwind CSS classes',
    author: 'Community',
    capabilities: ['workspace:read', 'workspace:write'],
    entryPoint: { kind: 'inline', script: 'tailwind' },
    signatureAlgorithm: 'hmac-sha256',
    signature: 'community-tailwind-sig',
  },
  {
    id: 'gitlens',
    name: 'GitLens',
    version: '2.0.0',
    description: 'Git power in the IDE — blame, history, diffs',
    author: 'GitLens',
    capabilities: ['workspace:read'],
    entryPoint: { kind: 'inline', script: 'gitlens' },
    signatureAlgorithm: 'hmac-sha256',
    signature: 'community-gitlens-sig',
  },
  {
    id: 'path-intellisense',
    name: 'Path Intellisense',
    version: '1.0.0',
    description: 'Autocomplete for file paths',
    author: 'Community',
    capabilities: ['workspace:read'],
    entryPoint: { kind: 'inline', script: 'path-intellisense' },
    signatureAlgorithm: 'hmac-sha256',
    signature: 'community-path-sig',
  },
  {
    id: 'errorlens',
    name: 'Error Lens',
    version: '1.0.0',
    description: 'Inline error and warning annotations',
    author: 'ErrorLens',
    capabilities: ['workspace:read'],
    entryPoint: { kind: 'inline', script: 'errorlens' },
    signatureAlgorithm: 'hmac-sha256',
    signature: 'community-error-sig',
  },
];

export default function WebPluginRegistry({
  onClose,
  registry: registryProp,
  onInstall,
}: {
  onClose: () => void;
  registry?: Registry;
  onInstall?: (manifest: PluginManifest) => void;
}) {
  const [internalRegistry] = useState(() => createRegistry());
  const registry = registryProp ?? internalRegistry;
  const [installed, setInstalled] = useState<PluginRecord[]>([]);
  const [search, setSearch] = useState('');
  const [filterSource, setFilterSource] = useState<string | 'all'>('all');
  const [installing, setInstalling] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setInstalled([...registry.list()]);
  }, [registry]);

  const filtered = COMMUNITY_PLUGINS.filter((p) => {
    const matchesSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase());
    const matchesSource = filterSource === 'all' || p.id.includes(filterSource);
    return matchesSearch && matchesSource;
  });

  const isInstalled = (id: string) => installed.some((i) => i.manifest.id === id);

  const handleInstall = async (manifest: PluginManifest) => {
    setInstalling(manifest.id);
    setError('');
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      registry.install(manifest);
      setInstalled([...registry.list()]);
      onInstall?.(manifest);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setInstalling(null);
    }
  };

  const getIcon = (sourceId: string) => {
    const found = WEB_REGISTRIES.find((r) => r.id === sourceId);
    return found?.icon || <Globe size={14} />;
  };

  return (
    <div
      style={{
        background: '#252526',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      <div
        style={{
          padding: '12px',
          borderBottom: '1px solid #333',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Puzzle size={16} color="#fff" />
        <strong style={{ color: '#fff', fontSize: 14 }}>Extensions</strong>
        <span style={{ color: '#888', fontSize: 12, marginLeft: 4 }}>
          {installed.length} installed
        </span>
        <button
          onClick={onClose}
          style={{
            marginLeft: 'auto',
            background: 'transparent',
            border: 'none',
            color: '#888',
            cursor: 'pointer',
          }}
        >
          <X size={16} />
        </button>
      </div>

      <div style={{ padding: '8px 12px', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#888',
            }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search extensions in marketplace..."
            style={{
              width: '100%',
              background: '#1e1e1e',
              border: '1px solid #333',
              color: '#fff',
              padding: '6px 10px 6px 32px',
              borderRadius: 4,
              fontSize: 12,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilterSource('all')}
            style={{
              padding: '3px 10px',
              background: filterSource === 'all' ? '#007acc' : '#3c3c3c',
              color: filterSource === 'all' ? '#fff' : '#ccc',
              border: 'none',
              borderRadius: 3,
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            All
          </button>
          {WEB_REGISTRIES.map((r) => (
            <button
              key={r.id}
              onClick={() => setFilterSource(r.id)}
              style={{
                padding: '3px 10px',
                background: filterSource === r.id ? r.color : '#3c3c3c',
                color: filterSource === r.id ? '#fff' : '#ccc',
                border: 'none',
                borderRadius: 3,
                cursor: 'pointer',
                fontSize: 11,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {getIcon(r.id)}
              {r.name}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '8px 12px',
            background: '#5c1a1a',
            color: '#f44336',
            fontSize: 12,
            flexShrink: 0,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto', padding: '4px 8px' }}>
        {filtered.map((plugin) => {
          const installedPlugin = installed.find((i) => i.manifest.id === plugin.id);
          const installed_ = !!installedPlugin;
          return (
            <div
              key={plugin.id}
              style={{
                padding: '12px',
                marginBottom: 4,
                background: '#1e1e1e',
                borderRadius: 4,
                border: installed_ ? '1px solid #1b5e20' : '1px solid #333',
              }}
            >
              <div style={{ display: 'flex', gap: 8 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    background: '#2d2d2d',
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Puzzle size={18} color="#4ec9b0" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <strong style={{ color: '#fff', fontSize: 13 }}>
                      {plugin.name}
                    </strong>
                    <span style={{ color: '#888', fontSize: 11 }}>
                      v{plugin.version}
                    </span>
                  </div>
                  <div style={{ color: '#aaa', fontSize: 12, marginTop: 2 }}>
                    {plugin.description}
                  </div>
                  <div style={{ color: '#666', fontSize: 11, marginTop: 4 }}>
                    by {plugin.author}
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                    {plugin.capabilities.map((cap) => (
                      <span
                        key={cap}
                        style={{
                          background: '#2d2d2d',
                          color: '#4ec9b0',
                          padding: '1px 6px',
                          borderRadius: 3,
                          fontSize: 10,
                        }}
                      >
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, color: '#888' }}>
                    <Star size={11} />
                    <span style={{ fontSize: 11 }}>
                      {(Math.random() * 5).toFixed(1)}
                    </span>
                  </div>
                  {installed_ ? (
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <span style={{ color: '#4caf50', fontSize: 11, display: 'flex', alignItems: 'center', gap: 2 }}>
                        <CheckCircle2 size={12} />
                        Installed
                      </span>
                      <button
                        onClick={() => {
                          registry.remove(plugin.id);
                          setInstalled([...registry.list()]);
                        }}
                        style={{
                          background: '#3c3c3c',
                          border: 'none',
                          color: '#ccc',
                          padding: '3px 8px',
                          borderRadius: 3,
                          cursor: 'pointer',
                          fontSize: 11,
                        }}
                      >
                        Uninstall
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleInstall(plugin)}
                      disabled={installing === plugin.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 12px',
                        background: installing === plugin.id ? '#333' : '#007acc',
                        color: installing === plugin.id ? '#666' : '#fff',
                        border: 'none',
                        borderRadius: 3,
                        cursor: installing === plugin.id ? 'default' : 'pointer',
                        fontSize: 11,
                      }}
                    >
                      {installing === plugin.id ? (
                        <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                      ) : (
                        <Download size={12} />
                      )}
                      Install
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ color: '#666', padding: 16, textAlign: 'center' }}>
            No extensions found
          </div>
        )}
      </div>
    </div>
  );
}

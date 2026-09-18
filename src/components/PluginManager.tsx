import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Puzzle,
  Plus,
  X,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  RefreshCw,
  Trash2,
  Power,
  PowerOff,
  Shield,
  ExternalLink,
  Store,
} from 'lucide-react';
import * as plugins from '../lib/plugins';
import WebPluginRegistry from './WebPluginRegistry';

interface Props {
  onClose: () => void;
  defaultTab?: 'installed' | 'marketplace';
}

export default function PluginManager({ onClose, defaultTab }: Props) {
  const [activeTab, setActiveTab] = useState<'installed' | 'marketplace'>(
    defaultTab ?? 'installed'
  );
  const [registry] = useState(() => plugins.createRegistry());
  const [installed, setInstalled] = useState<plugins.PluginRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showInstall, setShowInstall] = useState(false);
  const [manifestUrl, setManifestUrl] = useState('');
  const [manifestText, setManifestText] = useState('');
  const [installMode, setInstallMode] = useState<'url' | 'paste'>('url');
  const [publicKey, setPublicKey] = useState('');

  const refresh = () => {
    setInstalled([...registry.list()]);
  };

  useEffect(() => {
    refresh();
  }, [registry]);

  const handleInstall = async () => {
    setError('');
    setLoading(true);
    try {
      let manifest: plugins.PluginManifest;
      if (installMode === 'url') {
        if (!manifestUrl) throw new Error('Enter a manifest URL');
        const res = await fetch(manifestUrl);
        if (!res.ok) throw new Error(`Failed to fetch manifest: ${res.status}`);
        const raw = await res.json();
        if (!plugins.isValidManifest(raw)) throw new Error('Invalid plugin manifest');
        manifest = raw;
      } else {
        if (!manifestText) throw new Error('Paste a manifest JSON');
        const raw = JSON.parse(manifestText);
        if (!plugins.isValidManifest(raw)) throw new Error('Invalid plugin manifest');
        manifest = raw;
      }
      const verified = await plugins.verifyManifestSignature(manifest, publicKey || undefined);
      if (!verified) throw new Error('Signature verification failed');
      registry.install(manifest);
      refresh();
      setShowInstall(false);
      setManifestUrl('');
      setManifestText('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (id: string, record: plugins.PluginRecord) => {
    if (record.enabled) registry.disable(id);
    else registry.enable(id);
    refresh();
  };

  const handleRemove = (id: string) => {
    registry.remove(id);
    refresh();
  };

  const capabilityLabel = (c: string) => {
    switch (c) {
      case 'workspace:read': return 'Read workspace files';
      case 'workspace:write': return 'Write workspace files';
      case 'ai:call': return 'Call AI models';
      case 'network:request': return 'Make network requests';
      case 'terminal:execute': return 'Execute terminal commands';
      default: return c;
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between border-b border-slate-800 pb-6 mt-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full mb-1 shadow-[0_0_15px_rgba(99,102,241,0.1)]">
            <Puzzle className="w-3 h-3 text-indigo-400" />
            <span className="text-[10px] uppercase tracking-widest font-bold text-indigo-400">Plugin Ecosystem</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white">Plugin Manager</h2>
          <p className="text-slate-400 max-w-2xl text-base">
            Install, enable, and manage signed extensions. Plugins run sandboxed and can only access declared capabilities.
          </p>
        </div>
        <button
          onClick={() => setShowInstall(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Install Plugin
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="flex gap-2 border-b border-slate-800 pb-0">
        <button
          onClick={() => setActiveTab('installed')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            activeTab === 'installed'
              ? 'bg-slate-800 text-white border-b-2 border-indigo-500'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Puzzle className="w-4 h-4" />
          Installed
          <span className="ml-1 text-xs bg-slate-700 px-1.5 py-0.5 rounded-full">
            {installed.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('marketplace')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            activeTab === 'marketplace'
              ? 'bg-slate-800 text-white border-b-2 border-indigo-500'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Store className="w-4 h-4" />
          Marketplace
        </button>
      </div>

      <div className="grid gap-4 pt-6">
        <AnimatePresence mode="wait">
          {activeTab === 'installed' && (
            <motion.div
              key="installed"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {installed.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <Puzzle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No plugins installed yet.</p>
                </div>
              )}
              {installed.map((record) => (
                <motion.div
                  key={record.manifest.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-[#0a0d12] border border-slate-800 p-5 rounded-2xl flex flex-col gap-4 shadow-lg"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-950/50 rounded-xl border border-indigo-900/50">
                        <Puzzle className="w-5 h-5 text-indigo-400" />
                      </div>
                      <div>
                        <div className="font-bold text-white">{record.manifest.name}</div>
                        <div className="text-xs text-slate-400 font-mono">v{record.manifest.version} · {record.manifest.id}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggle(record.manifest.id, record)}
                        className={`p-2 rounded-lg border transition-colors ${
                          record.enabled
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                        }`}
                        title={record.enabled ? 'Disable' : 'Enable'}
                      >
                        {record.enabled ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleRemove(record.manifest.id)}
                        className="p-2 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-slate-400">{record.manifest.description}</p>

                  <div className="flex flex-wrap gap-2">
                    {record.manifest.capabilities.map((c) => (
                      <span
                        key={c}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-slate-800 border border-slate-700 rounded-md text-xs text-slate-300"
                      >
                        <Shield className="w-3 h-3 text-slate-500" />
                        {capabilityLabel(c)}
                      </span>
                    ))}
                  </div>

                  <div className="text-xs text-slate-500">
                    By {record.manifest.author} · Installed {new Date(record.installedAt).toLocaleDateString()}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
          {activeTab === 'marketplace' && (
            <motion.div
              key="marketplace"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <WebPluginRegistry
                onClose={() => setActiveTab('installed')}
                registry={registry}
                onInstall={() => refresh()}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showInstall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowInstall(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0a0d12] border border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">Install Plugin</h3>
                <button onClick={() => setShowInstall(false)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setInstallMode('url')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    installMode === 'url'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  From URL
                </button>
                <button
                  onClick={() => setInstallMode('paste')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    installMode === 'paste'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Paste Manifest
                </button>
              </div>

              {installMode === 'url' ? (
                <div className="space-y-3">
                  <input
                    type="url"
                    value={manifestUrl}
                    onChange={(e) => setManifestUrl(e.target.value)}
                    placeholder="https://example.com/plugin-manifest.json"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              ) : (
                <textarea
                  value={manifestText}
                  onChange={(e) => setManifestText(e.target.value)}
                  placeholder='{"id":"demo","name":"Demo","version":"1.0.0","description":"...","author":"...","capabilities":["workspace:read"],"entryPoint":{"kind":"inline","script":"..."},"signatureAlgorithm":"hmac-sha256","signature":"..."}'
                  rows={8}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
              )}

              <div className="mt-4 space-y-2">
                <label className="text-xs text-slate-400 block">Public key (for signature verification, optional for HMAC demo)</label>
                <input
                  type="text"
                  value={publicKey}
                  onChange={(e) => setPublicKey(e.target.value)}
                  placeholder="base64url-encoded public key"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowInstall(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInstall}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Install
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

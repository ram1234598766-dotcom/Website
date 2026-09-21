'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Activity, Cpu, HardDrive, MemoryStick, Globe, Zap,
  Shield, Bot, GitBranch, Users, Clock, Server, Bell,
  ArrowUpRight, ArrowDownRight, Minus, ChevronRight,
} from 'lucide-react';

interface StatusData {
  status: string;
  version: string;
  nodeVersion: string;
  environment: string;
  timestamp: string;
  uptimeSeconds: number;
  mode: string;
  memory: { rss: number; heapTotal: number; heapUsed: number; external: number };
  services: Record<string, string>;
  routes: Array<{ path: string; method: string; status: string }>;
  tips: string[];
  serviceHealth: Record<string, { status: string; configured: boolean }>;
}

interface PeerInfo {
  id: string;
  address: string;
  protocol: string;
  connectedAt: string;
}

interface ModelManifest {
  id: string;
  version: string;
  publisher: string;
  totalBytes: number;
  runtimeRequirements: { webgpu: boolean; wasm: boolean; minMemoryMB: number; minStorageMB: number };
  license: { name: string };
}

interface ModelsResponse {
  models: ModelManifest[];
}

function formatUptime(s: number): string {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatBytes(b: number): string {
  if (b >= 1024 * 1024 * 1024) return `${(b / (1024 * 1024 * 1024)).toFixed(1)} GiB`;
  if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MiB`;
  if (b >= 1024) return `${(b / 1024).toFixed(1)} KiB`;
  return `${b} B`;
}

const statusColors: Record<string, string> = {
  healthy: '#22c55e',
  degraded: '#eab308',
  unhealthy: '#ef4444',
  ok: '#22c55e',
  available: '#22c55e',
  connected: '#22c55e',
  configured: '#22c55e',
  browser: '#22c55e',
  cloud: '#22c55e',
  disabled: '#64748b',
  offline: '#ef4444',
};

export default function DashboardPage() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [models, setModels] = useState<ModelManifest[]>([]);
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [sRes, mRes, pRes] = await Promise.all([
        fetch('/api/status'),
        fetch('/api/models'),
        fetch('/api/peers'),
      ]);
      if (!sRes.ok) throw new Error(`status ${sRes.status}`);
      const sData: StatusData = await sRes.json();
      setStatus(sData);
      if (mRes.ok) {
        const mData: ModelsResponse = await mRes.json();
        setModels(mData.models);
      }
      if (pRes.ok) {
        const pData = await pRes.json();
        setPeers(pData.peers || []);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);

    try {
      const ws = new WebSocket('wss://website.vasudevaya.workers.dev/api/status/stream');
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.status) setStatus(data);
        } catch { /* ignore */ }
      };
      wsRef.current = ws;
    } catch { /* WS not available */ }

    return () => {
      clearInterval(interval);
      wsRef.current?.close();
    };
  }, [fetchData]);

  if (error && !status) {
    return (
      <div className="max-w-6xl mx-auto p-8">
        <h1 className="text-2xl font-bold text-white mb-4">Dashboard</h1>
        <p className="text-red-400">Error loading: {error}</p>
        <button onClick={fetchData} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded">Retry</button>
      </div>
    );
  }

  const svcEntries = status ? Object.entries(status.services) : [];
  const healthEntries = status && status.serviceHealth ? Object.entries(status.serviceHealth) : [];
  const mem = status?.memory;
  const heapPct = mem ? Math.round((mem.heapUsed / mem.heapTotal) * 100) : 0;
  const rssPct = mem ? Math.round((mem.rss / (1024 * 1024 * 1024)) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            {status ? `v${status.version} · ${status.mode === 'connected' ? '🔗 Connected' : '💻 Demo'} · ${status.environment}` : 'Loading...'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-500 text-sm font-mono">{status ? formatUptime(status.uptimeSeconds) : '—'}</span>
          <button onClick={fetchData} aria-label="Refresh" className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg">
            <Activity className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Status Banner */}
      {status && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-xl border p-4 flex items-center gap-3"
          style={{ borderColor: (status.status === 'healthy' || status.status === 'ok') ? 'rgba(34,197,94,0.3)' : 'rgba(234,179,8,0.3)', background: (status.status === 'healthy' || status.status === 'ok') ? 'rgba(34,197,94,0.05)' : 'rgba(234,179,8,0.05)' }}
        >
          <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: statusColors[status.status] || '#94a3b8' }} />
          <span className="text-white font-medium">
            {status.status === 'healthy' || status.status === 'ok' ? 'All Systems Operational' : 'Degraded — Some services need attention'}
          </span>
          <span className="text-slate-500 text-sm ml-auto">{new Date(status.timestamp).toLocaleString()}</span>
        </motion.div>
      )}

      {/* Resource Cards */}
      {mem && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'CPU Cores', value: navigator.hardwareConcurrency || '—', icon: Cpu, color: '#6366f1' },
            { label: 'Memory (Heap)', value: `${formatBytes(mem.heapUsed)} / ${formatBytes(mem.heapTotal)} (${heapPct}%)`, icon: MemoryStick, color: '#8b5cf6' },
            { label: 'RSS Memory', value: `${formatBytes(mem.rss)} (${rssPct}%)`, icon: HardDrive, color: '#a855f7' },
            { label: 'Uptime', value: formatUptime(status.uptimeSeconds), icon: Clock, color: '#06b6d4' },
          ].map((card) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-xl border border-white/10 bg-white/5 p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <card.icon className="w-4 h-4" style={{ color: card.color }} />
                <span className="text-xs text-slate-400 uppercase tracking-wider">{card.label}</span>
              </div>
              <div className="text-white text-sm font-medium">{card.value}</div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Services Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {svcEntries.map(([name, state]) => (
          <motion.div
            key={name}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-white/10 bg-white/5 p-3 flex items-center gap-3"
          >
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: statusColors[state] || '#94a3b8' }} />
            <span className="text-slate-300 text-sm capitalize">{name}</span>
            <span className="ml-auto text-xs text-slate-500 capitalize">{state}</span>
          </motion.div>
        ))}
      </div>

      {/* Service Health + Models */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Service Health Detail */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-400" /> Service Health
          </h2>
          <div className="space-y-3">
            {healthEntries.map(([name, info]) => (
              <div key={name} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <span className="text-sm text-slate-300 capitalize">{name}</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: statusColors[info.status] || '#94a3b8' }} />
                  <span className="text-xs text-slate-400">{info.status}</span>
                  <span className="text-xs text-slate-600">({info.configured ? '✓' : '✗'})</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Models */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-400" /> WebModels ({models.length})
          </h2>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {models.slice(0, 8).map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/3 hover:bg-white/5">
                <div>
                  <div className="text-sm text-slate-300 font-medium">{m.id}</div>
                  <div className="text-xs text-slate-500">{m.publisher} · {m.version} · {formatBytes(m.totalBytes)}</div>
                </div>
                <span className="text-xs text-slate-500">{m.license.name}</span>
              </div>
            ))}
            {models.length === 0 && <p className="text-slate-500 text-sm">No models loaded</p>}
          </div>
        </div>
      </div>

      {/* Peers + Routes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Peers */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" /> Sync Peers ({peers.length})
          </h2>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {peers.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/3 hover:bg-white/5">
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-sm text-slate-300">{p.address}</span>
                </div>
                <span className="text-xs text-emerald-400">● Online</span>
              </div>
            ))}
            {peers.length === 0 && <p className="text-slate-500 text-sm">No peers connected</p>}
          </div>
        </div>

        {/* API Routes */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Server className="w-5 h-5 text-indigo-400" /> API Routes
          </h2>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {(status?.routes || []).map((r) => (
              <div key={r.path} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-white/5">
                <span className="text-xs font-mono text-slate-400">{r.method} {r.path}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${r.status === 'ok' ? 'bg-green-900/30 text-green-400' : r.status === 'degraded' ? 'bg-yellow-900/30 text-yellow-400' : 'bg-red-900/30 text-red-400'}`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tips */}
      {status?.tips && status.tips.length > 0 && (
        <div className="mt-6 rounded-xl border border-yellow-900/30 bg-yellow-900/5 p-4">
          <h2 className="text-sm font-semibold text-yellow-400 mb-2 flex items-center gap-2">
            <Zap className="w-4 h-4" /> Quick Tips
          </h2>
          <ul className="space-y-1">
            {status.tips.map((tip, i) => (
              <li key={i} className="text-sm text-slate-400">{tip}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

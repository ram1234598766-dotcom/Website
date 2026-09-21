'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity, Server, Wifi, Globe, Zap, RefreshCw, Clock,
} from 'lucide-react';
import { useToast } from '../../src/lib/useToast';
import {
  subscribePresence, isFirestoreAvailable, type PresencePeer,
} from '../../src/lib/firestore';
import { onFireAuthStateChanged, type FirebaseUser } from '../../src/lib/firebase';

interface ProviderHealth {
  status?: string;
  configured?: boolean;
}

interface StatusPayload {
  status: string;
  version: string;
  environment: string;
  uptimeSeconds: number;
  mode: string;
  services: Record<string, string>;
  serviceHealth?: {
    firebase?: ProviderHealth;
    gemini?: ProviderHealth;
    github?: ProviderHealth;
    database?: ProviderHealth;
  };
}

interface TopologyNode {
  id: string;
  x: number;
  y: number;
  label: string;
  type: 'self' | 'peer' | 'service';
  status: 'online' | 'offline' | 'degraded';
}

interface TopologyEdge {
  from: string;
  to: string;
}

interface NetworkStatus {
  nodeId: string;
  hostname: string;
  totalPeers: number;
  connectedPeers: number;
  latency: number | null;
  uptime: number;
  healthyServices: number;
  totalServices: number;
}

function formatUptime(s: number): string {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function healthMap(s: string | undefined): 'online' | 'offline' | 'degraded' {
  switch (s) {
    case 'healthy':
    case 'available':
    case 'configured':
    case 'connected':
    case 'ok':
    case 'online':
      return 'online';
    case 'unhealthy':
    case 'disabled':
    case 'offline':
      return 'offline';
    default:
      return 'degraded';
  }
}

function buildTopology(
  peers: PresencePeer[],
  status: StatusPayload | null,
): { nodes: TopologyNode[]; edges: TopologyEdge[] } {
  const self: TopologyNode = {
    id: 'self', x: 300, y: 250, label: 'This Node', type: 'self', status: 'online',
  };
  const nodes: TopologyNode[] = [self];
  const edges: TopologyEdge[] = [];

  peers.forEach((p, i) => {
    const angle = (i / Math.max(peers.length, 1)) * Math.PI * 2 - Math.PI / 2;
    const radius = 160;
    nodes.push({
      id: p.deviceId,
      x: 300 + Math.cos(angle) * radius,
      y: 250 + Math.sin(angle) * radius,
      label: p.label || p.email || p.address,
      type: 'peer',
      status: p.online ? 'online' : 'offline',
    });
    edges.push({ from: 'self', to: p.deviceId });
  });

  const svc = status?.serviceHealth ?? {};
  const services: { id: string; label: string; status: string; x: number; y: number }[] = [
    { id: 'svc-firebase', label: 'Firebase', status: svc.firebase?.status, x: 120, y: 80 },
    { id: 'svc-gemini', label: 'Gemini', status: svc.gemini?.status, x: 480, y: 80 },
    { id: 'svc-github', label: 'GitHub', status: svc.github?.status, x: 120, y: 420 },
    { id: 'svc-database', label: 'Database', status: svc.database?.status, x: 480, y: 420 },
  ];
  services.forEach((s) => {
    nodes.push({
      id: s.id, x: s.x, y: s.y, label: s.label, type: 'service',
      status: healthMap(s.status),
    });
    edges.push({ from: 'self', to: s.id });
  });

  return { nodes, edges };
}

export default function NetworkPeersPage() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const configured = isFirestoreAvailable();
  const [peers, setPeers] = useState<PresencePeer[]>([]);
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const { show } = useToast();

  useEffect(() => {
    if (!configured) return;
    return onFireAuthStateChanged((u) => setUser(u));
  }, [configured]);

  useEffect(() => {
    if (!user) {
      setPeers([]);
      return;
    }
    return subscribePresence(user.uid, (list) => {
      setPeers(list);
      setError(null);
    });
  }, [user]);

  const fetchStatus = useCallback(async () => {
    try {
      const start = performance.now();
      const res = await fetch('/api/status');
      const rtt = Math.round(performance.now() - start);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as StatusPayload;
      setStatus(data);
      setLatency(rtt);
      setError(null);
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reach /api/status');
      return null;
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);

    try {
      const ws = new WebSocket('wss://website.vasudevaya.workers.dev/api/status/stream');
      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => setWsConnected(false);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.status?.uptimeSeconds != null) {
            setStatus((prev) => prev ? { ...prev, uptimeSeconds: data.status.uptimeSeconds } : prev);
          }
        } catch { /* ignore */ }
      };
      wsRef.current = ws;
    } catch { /* WS not available */ }

    return () => {
      clearInterval(interval);
      wsRef.current?.close();
    };
  }, [fetchStatus]);

  const netStatus: NetworkStatus | null = useMemo(() => {
    if (!status) return null;
    const healthyServices = Object.values(status.serviceHealth ?? {}).filter((h) => healthMap(h?.status) === 'online').length;
    const totalServices = Object.keys(status.serviceHealth ?? {}).length;
    return {
      nodeId: `node-${status.version ?? 'unknown'}`,
      hostname: status.environment ?? 'unknown',
      totalPeers: peers.length,
      connectedPeers: peers.filter((p) => p.online).length,
      latency,
      uptime: status.uptimeSeconds ?? 0,
      healthyServices,
      totalServices,
    };
  }, [status, peers, latency]);

  const { nodes, edges } = useMemo(() => buildTopology(peers, status), [peers, status]);

  const statusColor = (s: string) => {
    switch (s) {
      case 'online':
      case 'healthy':
      case 'connected':
      case 'ok':
        return '#22c55e';
      case 'degraded':
        return '#eab308';
      case 'offline':
      case 'unhealthy':
      case 'disabled':
        return '#ef4444';
      default:
        return '#94a3b8';
    }
  };

  const handlePeerClick = (p: PresencePeer) => {
    show(
      `${p.label || p.email || p.address} — ${p.online ? 'online' : 'offline'} — last seen ${new Date(p.lastSeen).toLocaleString()}`,
      'info', 4000,
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Network & Peers</h1>
          <p className="text-slate-400 text-sm mt-1">
            Presence peers, measured latency, and service health
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <div
              className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}
            />
            <span className="text-slate-400">{wsConnected ? 'WS Live' : 'Polling'}</span>
          </div>
          <button onClick={() => fetchStatus()} aria-label="Refresh status" className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {(status?.mode === 'demo' || !configured) && (
        <div role="status" className="mb-4 rounded-lg bg-amber-900/20 border border-amber-800/40 p-4 text-amber-200 text-sm">
          Supported services are reporting partial health because some integrations are not configured. Peers require a signed-in Firebase account.
        </div>
      )}
      {configured && !user && (
        <div role="status" className="mb-4 rounded-lg bg-indigo-900/20 border border-indigo-800/40 p-4 text-indigo-200 text-sm">
          Sign in to broadcast presence and view live peers.
        </div>
      )}

      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-red-900/30 border border-red-800/50 p-4 text-red-300">
          Error: {error}
        </div>
      )}

      {netStatus && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Active Peers', value: `${netStatus.connectedPeers}/${netStatus.totalPeers}`, icon: Users, color: '#6366f1' },
            { label: 'Latency', value: netStatus.latency != null ? `${netStatus.latency}ms` : '—', icon: Activity, color: '#22c55e' },
            { label: 'Services', value: `${netStatus.healthyServices}/${netStatus.totalServices}`, icon: Zap, color: '#f59e0b' },
            { label: 'Uptime', value: formatUptime(netStatus.uptime), icon: Clock, color: '#06b6d4' },
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

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Server className="w-5 h-5 text-indigo-400" /> Network Topology
        </h2>
        <div className="w-full overflow-x-auto">
          <svg
            viewBox="0 0 600 500"
            className="w-full"
            style={{ minWidth: 400 }}
            role="img"
            aria-label="Network topology diagram showing connections between this node, peers, and services"
          >
            <title>Network Topology</title>
            <desc>Diagram showing this node at center, connected to live peers and services. Click a peer node for details.</desc>
            {edges.map((edge) => {
              const from = nodes.find((n) => n.id === edge.from);
              const to = nodes.find((n) => n.id === edge.to);
              if (!from || !to) return null;
              return (
                <g key={`${edge.from}-${edge.to}`}>
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke="#334155"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                </g>
              );
            })}

            {nodes.map((node) => (
              <g
                key={node.id}
                className="cursor-pointer"
                onClick={() => {
                  if (node.type === 'peer') {
                    const peer = peers.find((p) => p.deviceId === node.id);
                    if (peer) handlePeerClick(peer);
                  }
                }}
                role={node.type === 'peer' ? 'button' : undefined}
                tabIndex={node.type === 'peer' ? 0 : undefined}
                onKeyDown={(e) => {
                  if (node.type === 'peer' && (e.key === 'Enter' || e.key === ' ')) {
                    const peer = peers.find((p) => p.deviceId === node.id);
                    if (peer) handlePeerClick(peer);
                  }
                }}
              >
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.type === 'self' ? 24 : 18}
                  fill={node.type === 'self' ? '#1e1b4b' : node.type === 'service' ? '#0f172a' : '#1e293b'}
                  stroke={statusColor(node.status)}
                  strokeWidth={node.type === 'self' ? 3 : 2}
                />
                {node.type === 'self' && (
                  <text x={node.x} y={node.y + 5} textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">
                    ◉
                  </text>
                )}
                {node.type === 'service' && (
                  <text x={node.x} y={node.y + 5} textAnchor="middle" fill={statusColor(node.status)} fontSize="12">
                    ◉
                  </text>
                )}
                <text
                  x={node.x}
                  y={node.y + (node.type === 'self' ? 40 : 32)}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="11"
                >
                  {node.label}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: '#22c55e' }} />
            <span>Healthy</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: '#eab308' }} />
            <span>Degraded</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: '#ef4444' }} />
            <span>Offline</span>
          </div>
          <span className="ml-auto">Click a peer for details</span>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Wifi className="w-5 h-5 text-indigo-400" /> Peers ({peers.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="table">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-white/10">
                <th className="text-left pb-2 font-medium" scope="col">Peer</th>
                <th className="text-left pb-2 font-medium" scope="col">Protocol</th>
                <th className="text-left pb-2 font-medium" scope="col">Status</th>
                <th className="text-left pb-2 font-medium" scope="col">Last seen</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {peers.map((p) => (
                  <motion.tr
                    key={p.deviceId}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border-b border-white/5 hover:bg-white/5 cursor-pointer"
                    onClick={() => handlePeerClick(p)}
                    role="row"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handlePeerClick(p);
                    }}
                  >
                    <td className="py-2 font-mono text-slate-300" role="cell">
                      <div className="flex items-center gap-1">
                        <Globe className="w-3 h-3 text-emerald-400" />
                        {p.label || p.email || p.address}
                      </div>
                    </td>
                    <td className="py-2 text-slate-400" role="cell">
                      <span className="px-2 py-0.5 rounded bg-white/5 text-xs">{p.protocol || 'vantaos-rt'}</span>
                    </td>
                    <td className="py-2" role="cell">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full" style={{ background: p.online ? '#22c55e' : '#ef4444' }} />
                        <span className={`text-xs ${p.online ? 'text-emerald-400' : 'text-red-400'}`}>
                          {p.online ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 text-slate-500 text-xs" role="cell">
                      {new Date(p.lastSeen).toLocaleString()}
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
              {peers.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">No peers online right now</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Local import to avoid circular deps — inline Users icon usage
function Users({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
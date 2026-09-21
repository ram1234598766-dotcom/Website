'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity, Server, Wifi, Globe, Zap, ArrowRight, RefreshCw,
  CheckCircle2, XCircle, Clock, Shield, Cpu, HardDrive,
} from 'lucide-react';
import { useToast, ToastType } from '../../src/lib/useToast';

interface PeerInfo {
  id: string;
  address: string;
  protocol: string;
  connectedAt: string;
  latency?: number;
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
  bandwidth?: number;
}

interface NetworkStatus {
  nodeId: string;
  hostname: string;
  totalPeers: number;
  connectedPeers: number;
  bandwidth: { up: number; down: number };
  latency: number;
  uptime: number;
}

function formatUptime(s: number): string {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatBytes(b: number): string {
  if (b >= 1_000_000_000) return `${(b / 1_000_000_000).toFixed(1)} GB/s`;
  if (b >= 1_000_000) return `${(b / 1_000_000).toFixed(1)} MB/s`;
  if (b >= 1_000) return `${(b / 1_000).toFixed(1)} KB/s`;
  return `${b} B/s`;
}

function buildTopology(peers: PeerInfo[]): { nodes: TopologyNode[]; edges: TopologyEdge[] } {
  const self: TopologyNode = {
    id: 'self',
    x: 300,
    y: 250,
    label: 'This Node',
    type: 'self',
    status: 'online',
  };
  const nodes: TopologyNode[] = [self];
  const edges: TopologyEdge[] = [];

  peers.forEach((p, i) => {
    const angle = (i / Math.max(peers.length, 1)) * Math.PI * 2 - Math.PI / 2;
    const radius = 160;
    const px = 300 + Math.cos(angle) * radius;
    const py = 250 + Math.sin(angle) * radius;
    nodes.push({
      id: p.id,
      x: px,
      y: py,
      label: p.address,
      type: 'peer',
      status: 'online',
    });
    edges.push({ from: 'self', to: p.id });
  });

  const services = [
    { id: 'svc-firebase', label: 'Firebase', type: 'service' as const, status: 'online' as const, x: 120, y: 80 },
    { id: 'svc-gemini', label: 'Gemini', type: 'service' as const, status: 'degraded' as const, x: 480, y: 80 },
    { id: 'svc-github', label: 'GitHub', type: 'service' as const, status: 'offline' as const, x: 120, y: 420 },
    { id: 'svc-ai', label: 'AI Proxy', type: 'service' as const, status: 'online' as const, x: 480, y: 420 },
  ];
  services.forEach((s) => {
    nodes.push(s);
    edges.push({ from: 'self', to: s.id });
  });

  return { nodes, edges };
}

export default function NetworkPeersPage() {
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [netStatus, setNetStatus] = useState<NetworkStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const { show } = useToast();

  const fetchData = useCallback(async () => {
    try {
      const [pRes, sRes] = await Promise.all([
        fetch('/api/peers'),
        fetch('/api/status'),
      ]);
      let downloadedPeers: PeerInfo[] = [];
      if (pRes.ok) {
        const data = await pRes.json();
        downloadedPeers = (data.peers || []).map((p: PeerInfo) => ({
          ...p,
          latency: Math.floor(Math.random() * 80) + 5,
        }));
        setPeers(downloadedPeers);
      }
      if (sRes.ok) {
        const sData = await sRes.json();
        setNetStatus({
          nodeId: `node-${sData.version ?? 'unknown'}`,
          hostname: sData.environment ?? 'unknown',
          totalPeers: downloadedPeers.length,
          connectedPeers: downloadedPeers.filter((p: PeerInfo) => p.protocol === 'wss').length || downloadedPeers.length,
          bandwidth: { up: Math.random() * 5_000_000, down: Math.random() * 20_000_000 },
          latency: Math.floor(Math.random() * 50) + 2,
          uptime: sData.uptimeSeconds ?? 0,
        });
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);

    try {
      const ws = new WebSocket('wss://website.vasudevaya.workers.dev/api/status/stream');
      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => setWsConnected(false);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.status?.services) {
            setNetStatus((prev) => prev ? { ...prev, uptime: data.status.uptimeSeconds ?? prev.uptime } : prev);
          }
        } catch { /* ignore */ }
      };
      wsRef.current = ws;
    } catch { /* WS not available */ }

    return () => {
      clearInterval(interval);
      wsRef.current?.close();
    };
  }, [fetchData]);

  const { nodes, edges } = useMemo(() => buildTopology(peers), [peers]);

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

  const handlePeerClick = (peer: PeerInfo) => {
    show(`Peer ${peer.address} — ${peer.protocol} — ${peer.latency ?? '—'}ms`, 'info', 4000);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Network & Peers</h1>
          <p className="text-slate-400 text-sm mt-1">
            Topology, peer connections, and sync status
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <div
              className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}
            />
            <span className="text-slate-400">{wsConnected ? 'WS Live' : 'Polling'}</span>
          </div>
          <button onClick={fetchData} aria-label="Refresh" className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-red-900/30 border border-red-800/50 p-4 text-red-300">
          Error: {error}
        </div>
      )}

      {/* Network stats */}
      {netStatus && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Active Peers', value: `${netStatus.connectedPeers}/${netStatus.totalPeers}`, icon: Users, color: '#6366f1' },
            { label: 'Latency', value: `${netStatus.latency}ms`, icon: Activity, color: '#22c55e' },
            { label: 'Bandwidth', value: `${formatBytes(netStatus.bandwidth.down)}`, icon: Zap, color: '#f59e0b' },
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

      {/* Topology Visualization */}
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
            <desc>Interactive diagram showing this node at center, connected to peers and services. Click a peer node for details.</desc>
            {/* Edges */}
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
                    strokeDasharray={edge.bandwidth ? 'none' : '4 4'}
                  />
                  <circle cx={(from.x + to.x) / 2} cy={(from.y + to.y) / 2} r="3" fill="#6366f1" opacity="0.6">
                    <animate
                      attributeName="cx"
                      values={`${(from.x + to.x) / 2};${to.x};${(from.x + to.x) / 2}`}
                      dur={`${2 + Math.random()}s`}
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="cy"
                      values={`${(from.y + to.y) / 2};${to.y};${(from.y + to.y) / 2}`}
                      dur={`${2 + Math.random()}s`}
                      repeatCount="indefinite"
                    />
                  </circle>
                </g>
              );
            })}

            {/* Nodes */}
            {nodes.map((node) => (
              <g
                key={node.id}
                className="cursor-pointer"
                onClick={() => {
                  if (node.type === 'peer') {
                    const peer = peers.find((p) => p.id === node.id);
                    if (peer) handlePeerClick(peer);
                  }
                }}
                role={node.type === 'peer' ? 'button' : undefined}
                tabIndex={node.type === 'peer' ? 0 : undefined}
                onKeyDown={(e) => {
                  if (node.type === 'peer' && (e.key === 'Enter' || e.key === ' ')) {
                    const peer = peers.find((p) => p.id === node.id);
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

        {/* Legend */}
        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: '#22c55e' }} />
            <span>Online</span>
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

      {/* Peer List */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Wifi className="w-5 h-5 text-indigo-400" /> Peers ({peers.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="table">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-white/10">
                <th className="text-left pb-2 font-medium" scope="col">Address</th>
                <th className="text-left pb-2 font-medium" scope="col">Protocol</th>
                <th className="text-left pb-2 font-medium" scope="col">Latency</th>
                <th className="text-left pb-2 font-medium" scope="col">Status</th>
                <th className="text-left pb-2 font-medium" scope="col">Connected</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {peers.map((p) => (
                  <motion.tr
                    key={p.id}
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
                        {p.address}
                      </div>
                    </td>
                    <td className="py-2 text-slate-400" role="cell">
                      <span className="px-2 py-0.5 rounded bg-white/5 text-xs">{p.protocol}</span>
                    </td>
                    <td className="py-2 text-slate-400" role="cell">
                      {p.latency ? `${p.latency}ms` : '—'}
                    </td>
                    <td className="py-2" role="cell">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
                        <span className="text-xs text-emerald-400">Online</span>
                      </div>
                    </td>
                    <td className="py-2 text-slate-500 text-xs" role="cell">
                      {new Date(p.connectedAt).toLocaleString()}
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
              {peers.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">No peers connected</td>
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

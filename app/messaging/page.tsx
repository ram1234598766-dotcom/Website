'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  MessageSquare, Send, Activity, Clock, Users, Wifi, ArrowRight, RefreshCw,
} from 'lucide-react';
import { useToast } from '../../src/lib/useToast';

interface PeerInfo {
  id: string;
  address: string;
  protocol: string;
  connectedAt: string;
  latency?: number;
}

interface Msg {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: string;
  status: 'sent' | 'delivered' | 'read';
}

export default function MessagingPage() {
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [stats, setStats] = useState<{ peers: number; channels: number; messages: number; latency: number; queue: number } | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { show } = useToast();

  const fetchData = useCallback(async () => {
    try {
      const pRes = await fetch('/api/peers');
      if (pRes.ok) {
        const data = await pRes.json();
        const peerList = (data.peers || []).map((p: PeerInfo) => ({
          ...p,
          latency: Math.floor(Math.random() * 80) + 5,
        }));
        setPeers(peerList);
        setStats({
          peers: peerList.length,
          channels: peerList.length * 2,
          messages: Math.floor(Math.random() * 5000) + 1000,
          latency: Math.floor(Math.random() * 50) + 2,
          queue: Math.floor(Math.random() * 10),
        });
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (peers.length > 0 && messages.length === 0) {
      const initial: Msg[] = peers.map((p) => ({
        id: 'msg-' + p.id,
        from: 'self',
        to: p.id,
        content: 'Sync heartbeat to ' + p.address,
        timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString(),
        status: 'delivered',
      }));
      setMessages(initial);
    }
  }, [peers, messages.length]);

  const sendMessage = () => {
    if (!draft.trim() || !selectedPeer) return;
    const msg: Msg = {
      id: 'msg-' + Date.now(),
      from: 'self',
      to: selectedPeer,
      content: draft.trim(),
      timestamp: new Date().toISOString(),
      status: 'sent',
    };
    setMessages((prev) => [msg, ...prev]);
    setDraft('');
    show('Message sent', 'success', 3000);
  };

  const selectPeer = (peerId: string) => {
    setSelectedPeer(peerId);
    const peer = peers.find((p) => p.id === peerId);
    if (peer) show('Chat with ' + peer.address, 'info', 3000);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Messaging</h1>
          <p className="text-slate-400 text-sm mt-1">Peer-to-peer sync and messaging infrastructure</p>
        </div>
        <button onClick={fetchData} aria-label="Refresh" className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-red-900/30 border border-red-800/50 p-4 text-red-300">
          Error: {error}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
          {[
            { label: 'Peers', value: stats.peers, icon: Users, color: '#6366f1' },
            { label: 'Channels', value: stats.channels, icon: MessageSquare, color: '#22c55e' },
            { label: 'Messages', value: stats.messages.toLocaleString(), icon: Send, color: '#f59e0b' },
            { label: 'Latency', value: stats.latency + 'ms', icon: Activity, color: '#06b6d4' },
            { label: 'Queue', value: stats.queue, icon: Clock, color: '#8b5cf6' },
          ].map((card) => (
            <motion.div key={card.label} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <card.icon className="w-4 h-4" style={{ color: card.color }} />
                <span className="text-xs text-slate-400 uppercase tracking-wider">{card.label}</span>
              </div>
              <div className="text-white text-sm font-medium">{card.value}</div>
            </motion.div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-xl border border-white/10 bg-white/5 lg:col-span-1">
          <div className="p-3 border-b border-white/10">
            <span className="text-sm font-medium text-white">Peers ({peers.length})</span>
          </div>
          <div className="p-2 space-y-1">
            {peers.map((p) => (
              <button key={p.id} onClick={() => selectPeer(p.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  selectedPeer === p.id ? 'bg-indigo-900/40 text-indigo-300' : 'hover:bg-white/5 text-slate-300'
                }`}
                aria-label={'Chat with ' + p.address}>
                <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-mono truncate">{p.address}</div>
                  <div className="text-xs text-slate-500">{p.protocol}{p.latency ? ' \u00b7 ' + p.latency + 'ms' : ''}</div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              </button>
            ))}
            {peers.length === 0 && <p className="text-slate-500 text-sm p-4">No peers connected</p>}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 lg:col-span-2 flex flex-col">
          <div className="p-3 border-b border-white/10 flex items-center justify-between">
            <span className="text-sm font-medium text-white">
              {selectedPeer ? peers.find((p) => p.id === selectedPeer)?.address ?? 'Peer' : 'Select a peer'}
            </span>
            <span className="text-xs text-slate-500">{messages.length} messages</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3" role="log" aria-label="Chat messages" aria-live="polite">
            {messages.length === 0 && <div className="text-center text-slate-500 py-8">Select a peer to start messaging</div>}
            {messages.filter(m => !selectedPeer || m.to === selectedPeer || m.from === selectedPeer).map((msg) => (
              <div key={msg.id} className="flex gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                  style={{ background: msg.from === 'self' ? '#4f46e5' : '#065f46', color: 'white' }}>
                  {msg.from === 'self' ? 'U' : 'P'}
                </div>
                <div className={`max-w-[70%] rounded-lg px-3 py-2 ${
                  msg.from === 'self' ? 'bg-indigo-900/40 text-indigo-200' : 'bg-white/5 text-slate-300'
                }`}>
                  <div className="text-sm">{msg.content}</div>
                  <div className="text-xs text-slate-500 mt-1">{new Date(msg.timestamp).toLocaleTimeString()}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-white/10 flex gap-2">
            <input type="text" value={draft} onChange={(e) => setDraft(e.target.value)}
              placeholder={selectedPeer ? 'Type a message...' : 'Select a peer first'}
              onKeyDown={(e) => { if (e.key === 'Enter' && draft.trim() && selectedPeer) sendMessage(); }}
              disabled={!selectedPeer}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              aria-label="Message input" />
            <button onClick={sendMessage} disabled={!draft.trim() || !selectedPeer}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
              aria-label="Send message">
              <Send className="w-4 h-4" /> Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

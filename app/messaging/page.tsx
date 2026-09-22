'use client';

import { useEffect, useState } from 'react';
import {
  MessageSquare, Send, Users, Activity, Shield, ArrowRight,
} from 'lucide-react';
import { useToast } from '../../src/lib/useToast';
import {
  subscribePresence,
  publishPresence,
  subscribeDirectInbox,
  sendDirectMessage,
  isFirestoreAvailable,
  type PresencePeer,
  type DirectMessage,
} from '../../src/lib/firestore';
import { onFireAuthStateChanged, type FirebaseUser } from '../../src/lib/firebase';

type Inbox = Record<string, DirectMessage[]>;

export default function MessagingPage() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const configured = isFirestoreAvailable();
  const [peers, setPeers] = useState<PresencePeer[]>([]);
  const [inbox, setInbox] = useState<Inbox>({});
  const [draft, setDraft] = useState('');
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { show } = useToast();

  useEffect(() => {
    if (!configured) return;
    return onFireAuthStateChanged((u) => setUser(u));
  }, [configured]);

  useEffect(() => {
    if (!user) {
      setPeers([]);
      setInbox({});
      return;
    }
    const presenceStopRef: { current: (() => void) | undefined } = { current: undefined };
    publishPresence({
      label: user.email || user.uid,
      address: typeof window !== 'undefined' ? window.location.hostname || 'local' : 'local',
      protocol: 'vantaos-rt',
    }).then((presence) => {
      presenceStopRef.current = presence.stop;
    });
    const unsubPeers = subscribePresence(user.uid, (list) => {
      setPeers(list);
      setError(null);
    });
    const unsubInbox = subscribeDirectInbox(user.uid, (box) => {
      setInbox(box);
      setError(null);
    });
    return () => {
      presenceStopRef.current?.();
      unsubPeers();
      unsubInbox();
    };
  }, [user]);

  const peerByUid = (uid: string): PresencePeer | undefined =>
    peers.find((p) => p.uid === uid);

  const distinctUserCount = new Set(peers.map((p) => p.uid)).size;
  const onlineCount = peers.filter((p) => p.online).length;
  const totalMessages = Object.values(inbox).reduce((n, list) => n + list.length, 0);

  const sendMessage = async () => {
    if (!user || !selectedPeer) return;
    const content = draft.trim();
    if (!content) return;
    setError(null);
    const res = await sendDirectMessage({ to_uid: selectedPeer, content });
    if (res.error) {
      setError(res.error);
      return;
    }
    setDraft('');
    show('Message sent', 'success', 3000);
  };

  const selectPeer = (uid: string) => {
    setSelectedPeer(uid);
    const peer = peerByUid(uid);
    if (peer) show('Chat with ' + (peer.label || peer.address), 'info', 3000);
  };

  const conversation: DirectMessage[] = selectedPeer ? (inbox[selectedPeer] ?? []) : [];

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Messaging</h1>
          <p className="text-slate-400 text-sm mt-1">Presence and direct messages via the Realtime Database</p>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Shield className="w-3.5 h-3.5" />
          {configured ? (user ? 'Connected' : 'Signed out') : 'Demo mode'}
        </div>
      </div>

      {!configured && (
        <div role="status" className="mb-4 rounded-lg bg-amber-900/20 border border-amber-800/40 p-4 text-amber-200 text-sm">
          Running in demo mode. Configure a cloud account to share presence and exchange direct messages.
        </div>
      )}
      {configured && !user && (
        <div role="status" className="mb-4 rounded-lg bg-indigo-900/20 border border-indigo-800/40 p-4 text-indigo-200 text-sm">
          Sign in to broadcast presence and join conversations.
        </div>
      )}

      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-red-900/30 border border-red-800/50 p-4 text-red-300">
          Error: {error}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Peers', value: peers.length, icon: MessageSquare, color: '#6366f1' },
          { label: 'Users', value: distinctUserCount, icon: Users, color: '#22c55e' },
          { label: 'Online', value: onlineCount, icon: Activity, color: '#06b6d4' },
          { label: 'Messages', value: totalMessages.toLocaleString(), icon: Send, color: '#f59e0b' },
        ].map((card) => (
          <div key={card.label}
            className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <card.icon className="w-4 h-4" style={{ color: card.color }} />
              <span className="text-xs text-slate-400 uppercase tracking-wider">{card.label}</span>
            </div>
            <div className="text-white text-sm font-medium">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-xl border border-white/10 bg-white/5 lg:col-span-1">
          <div className="p-3 border-b border-white/10">
            <span className="text-sm font-medium text-white">Active peers ({peers.length})</span>
          </div>
          <div className="p-2 space-y-1">
            {peers.map((p) => (
              <button key={p.deviceId} onClick={() => selectPeer(p.uid)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  selectedPeer === p.uid ? 'bg-indigo-900/40 text-indigo-300' : 'hover:bg-white/5 text-slate-300'
                }`}
                aria-label={'Chat with ' + (p.label || p.email)}>
                <div className={`w-2 h-2 rounded-full shrink-0 ${p.online ? 'bg-green-500' : 'bg-slate-600'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{p.label || p.email || p.uid}</div>
                  <div className="text-xs text-slate-500 truncate">{p.protocol || 'vantaos-rt'}{p.address ? ' \u00b7 ' + p.address : ''}</div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              </button>
            ))}
            {peers.length === 0 && <p className="text-slate-500 text-sm p-4">No other devices online right now</p>}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 lg:col-span-2 flex flex-col">
          <div className="p-3 border-b border-white/10 flex items-center justify-between">
            <span className="text-sm font-medium text-white">
              {selectedPeer ? peerByUid(selectedPeer)?.label ?? 'Peer' : 'Select a peer'}
            </span>
            <span className="text-xs text-slate-500">{conversation.length} messages</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3" role="log" aria-label="Chat messages" aria-live="polite">
            {conversation.length === 0 && (
              <div className="text-center text-slate-500 py-8">Select a peer to start messaging</div>
            )}
            {conversation.map((msg) => {
              const mine = user !== null && msg.sender_id === user.uid;
              return (
                <div key={msg.id} className="flex gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                    mine ? 'text-white' : 'text-white'
                  }`}
                    style={{ background: mine ? '#4f46e5' : '#065f46' }}>
                    {mine ? 'U' : 'P'}
                  </div>
                  <div className={`max-w-[70%] rounded-lg px-3 py-2 ${
                    mine ? 'bg-indigo-900/40 text-indigo-200' : 'bg-white/5 text-slate-300'
                  }`}>
                    <div className="text-sm">{msg.content}</div>
                    <div className="text-xs text-slate-500 mt-1">{new Date(msg.timestamp).toLocaleTimeString()}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 border-t border-white/10 flex gap-2">
            <input type="text" value={draft} onChange={(e) => setDraft(e.target.value)}
              placeholder={user ? (selectedPeer ? 'Type a message...' : 'Select a peer first') : 'Sign in to message'}
              onKeyDown={(e) => { if (e.key === 'Enter' && draft.trim() && selectedPeer && user) sendMessage(); }}
              disabled={!user || !selectedPeer}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              aria-label="Message input" />
            <button onClick={sendMessage} disabled={!user || !draft.trim() || !selectedPeer}
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
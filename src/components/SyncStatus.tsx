/**
 * VantaOS — Sync Status Indicator.
 *
 * Shows sync state, peer presence, and cursors for collaborative editing.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  Loader2,
  WifiOff,
  AlertTriangle,
  Users,
} from 'lucide-react';
import type { SyncState, PeerPresence } from '../lib/sync/types';

interface SyncStatusProps {
  state: SyncState;
  lastSyncAt: number | null;
  pendingOps: number;
  peers: readonly PeerPresence[];
  conflicts: readonly { nodeId: string; localLamport: number; remoteLamport: number }[];
  deviceId: string;
  className?: string;
}

const STATE_CONFIG: Record<SyncState, { icon: React.ReactNode; label: string; color: string }> = {
  synced: { icon: <CheckCircle2 className="w-4 h-4" />, label: 'Synced', color: 'text-emerald-400' },
  syncing: { icon: <Loader2 className="w-4 h-4 animate-spin" />, label: 'Syncing...', color: 'text-amber-400' },
  offline: { icon: <WifiOff className="w-4 h-4" />, label: 'Offline', color: 'text-red-400' },
  conflict: { icon: <AlertTriangle className="w-4 h-4" />, label: 'Conflict', color: 'text-orange-400' },
};

function formatTimeAgo(ts: number | null): string {
  if (!ts) return 'never';
  const diff = Date.now() - ts;
  if (diff < 5000) return 'just now';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

export default function SyncStatus({
  state,
  lastSyncAt,
  pendingOps,
  peers,
  conflicts,
  deviceId,
  className = '',
}: SyncStatusProps) {
  const [expanded, setExpanded] = useState(false);
  const config = STATE_CONFIG[state];
  const onlinePeers = peers.filter((p) => p.online && Date.now() - p.lastSeen < 30_000);
  const offlinePeers = peers.filter((p) => !p.online || Date.now() - p.lastSeen >= 30_000);

  const shortId = useCallback(() => {
    if (!deviceId) return '???';
    return deviceId.length > 8 ? deviceId.slice(0, 8) : deviceId;
  }, [deviceId]);

  return (
    <div className={`sync-status ${className}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
        aria-expanded={expanded}
        aria-label={`Sync status: ${config.label}`}
      >
        <span className={config.color}>{config.icon}</span>
        <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
        {pendingOps > 0 && (
          <span className="text-xs bg-white/10 text-white/70 px-1.5 py-0.5 rounded-full">
            {pendingOps}
          </span>
        )}
        <span className="text-xs text-white/40 ml-1">{shortId()}</span>
      </button>

      {expanded && (
        <div className="mt-2 p-3 rounded-lg bg-black/60 border border-white/10 text-xs space-y-3 min-w-[240px]">
          <div className="space-y-1">
            <div className="text-white/50">Last sync: {formatTimeAgo(lastSyncAt)}</div>
            {conflicts.length > 0 && (
              <div className="text-orange-400">
                {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''}
              </div>
            )}
          </div>

          {onlinePeers.length > 0 && (
            <div>
              <div className="flex items-center gap-1 text-white/60 mb-1.5">
                <Users className="w-3 h-3" />
                <span>Online ({onlinePeers.length})</span>
              </div>
              <div className="space-y-1.5 pl-4">
                {onlinePeers.map((peer) => (
                  <div key={peer.deviceId} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-white/80 truncate max-w-[140px]">{peer.label || peer.deviceId.slice(0, 8)}</span>
                    {peer.cursor && (
                      <span className="w-3 h-3 text-indigo-400 ml-auto text-[10px] font-bold" title={`Editing ${peer.cursor.nodeId}`}>
                        →
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {offlinePeers.length > 0 && (
            <div>
              <div className="flex items-center gap-1 text-white/40 mb-1.5">
                <Users className="w-3 h-3" />
                <span>Offline ({offlinePeers.length})</span>
              </div>
              <div className="space-y-1 pl-4">
                {offlinePeers.map((peer) => (
                  <div key={peer.deviceId} className="flex items-center gap-2 text-white/30">
                    <span className="w-2 h-2 rounded-full bg-white/20" />
                    <span className="truncate max-w-[140px]">{peer.label || peer.deviceId.slice(0, 8)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {peers.length === 0 && (
            <div className="text-white/30 italic">No peers connected</div>
          )}
        </div>
      )}
    </div>
  );
}

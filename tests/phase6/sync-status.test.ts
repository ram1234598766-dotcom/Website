/**
 * Phase 6 — SyncStatus Component.
 *
 * Verifies the React component renders correct state labels, icons,
 * peer presence, and conflict counts.
 */

import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import SyncStatus from '../../src/components/SyncStatus';

afterEach(() => {
  cleanup();
});

const NOW = Date.now();

function makePeer(overrides: {
  deviceId?: string;
  label?: string;
  online?: boolean;
  lastSeen?: number;
  cursor?: { nodeId: string; position: number } | null;
} = {}): {
  deviceId: string;
  label: string;
  online: boolean;
  lastSeen: number;
  cursor: { nodeId: string; position: number } | null;
} {
  return {
    deviceId: 'peer-1',
    label: 'Peer One',
    online: true,
    lastSeen: NOW,
    cursor: null,
    ...overrides,
  };
}

const CONFLICTS: readonly { nodeId: string; localLamport: number; remoteLamport: number }[] = [
  { nodeId: 'n1', localLamport: 1, remoteLamport: 2 },
  { nodeId: 'n2', localLamport: 3, remoteLamport: 4 },
];

describe('SyncStatus', () => {
  it('renders synced state with correct label', () => {
    render(
      React.createElement(SyncStatus, {
        state: 'synced',
        lastSyncAt: NOW,
        pendingOps: 0,
        peers: [] as readonly { deviceId: string; label: string; online: boolean; lastSeen: number; cursor: { nodeId: string; position: number } | null }[],
        conflicts: [] as readonly { nodeId: string; localLamport: number; remoteLamport: number }[],
        deviceId: 'dev-1',
      })
    );
    expect(screen.getByText('Synced')).toBeDefined();
  });

  it('renders syncing state with spinner', () => {
    render(
      React.createElement(SyncStatus, {
        state: 'syncing',
        lastSyncAt: null,
        pendingOps: 2,
        peers: [] as readonly { deviceId: string; label: string; online: boolean; lastSeen: number; cursor: { nodeId: string; position: number } | null }[],
        conflicts: [] as readonly { nodeId: string; localLamport: number; remoteLamport: number }[],
        deviceId: 'dev-1',
      })
    );
    expect(screen.getByText('Syncing...')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
  });

  it('renders offline state', () => {
    render(
      React.createElement(SyncStatus, {
        state: 'offline',
        lastSyncAt: NOW - 120_000,
        pendingOps: 0,
        peers: [] as readonly { deviceId: string; label: string; online: boolean; lastSeen: number; cursor: { nodeId: string; position: number } | null }[],
        conflicts: [] as readonly { nodeId: string; localLamport: number; remoteLamport: number }[],
        deviceId: 'dev-1',
      })
    );
    expect(screen.getByText('Offline')).toBeDefined();
  });

  it('renders conflict state with conflict count', () => {
    render(
      React.createElement(SyncStatus, {
        state: 'conflict',
        lastSyncAt: NOW,
        pendingOps: 0,
        peers: [] as readonly { deviceId: string; label: string; online: boolean; lastSeen: number; cursor: { nodeId: string; position: number } | null }[],
        conflicts: CONFLICTS,
        deviceId: 'dev-1',
      })
    );
    expect(screen.getByText('Conflict')).toBeDefined();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText(/2 conflicts/)).toBeDefined();
  });

  it('shows short device id', () => {
    render(
      React.createElement(SyncStatus, {
        state: 'synced',
        lastSyncAt: NOW,
        pendingOps: 0,
        peers: [] as readonly { deviceId: string; label: string; online: boolean; lastSeen: number; cursor: { nodeId: string; position: number } | null }[],
        conflicts: [] as readonly { nodeId: string; localLamport: number; remoteLamport: number }[],
        deviceId: '12345678',
      })
    );
    expect(screen.getByText('12345678')).toBeDefined();
  });

  it('expands to show peer list on click', () => {
    const peers = [
      makePeer({ deviceId: 'p1', label: 'Alice', online: true, lastSeen: NOW }),
      makePeer({ deviceId: 'p2', label: 'Bob', online: false, lastSeen: NOW - 120_000 }),
    ];
    render(
      React.createElement(SyncStatus, {
        state: 'synced',
        lastSyncAt: NOW,
        pendingOps: 0,
        peers: peers as readonly { deviceId: string; label: string; online: boolean; lastSeen: number; cursor: { nodeId: string; position: number } | null }[],
        conflicts: [] as readonly { nodeId: string; localLamport: number; remoteLamport: number }[],
        deviceId: 'dev-1',
      })
    );

    expect(screen.queryByText('Alice')).toBeNull();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.getByText('Bob')).toBeDefined();
  });

  it('shows "No peers connected" when peer list is empty', () => {
    render(
      React.createElement(SyncStatus, {
        state: 'synced',
        lastSyncAt: NOW,
        pendingOps: 0,
        peers: [] as readonly { deviceId: string; label: string; online: boolean; lastSeen: number; cursor: { nodeId: string; position: number } | null }[],
        conflicts: [] as readonly { nodeId: string; localLamport: number; remoteLamport: number }[],
        deviceId: 'dev-1',
      })
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('No peers connected')).toBeDefined();
  });

  it('shows cursor icon when peer has active cursor', () => {
    const peers = [makePeer({ deviceId: 'p1', label: 'Alice', online: true, lastSeen: NOW, cursor: { nodeId: 'n1', position: 10 } })];
    render(
      React.createElement(SyncStatus, {
        state: 'synced',
        lastSyncAt: NOW,
        pendingOps: 0,
        peers: peers as readonly { deviceId: string; label: string; online: boolean; lastSeen: number; cursor: { nodeId: string; position: number } | null }[],
        conflicts: [] as readonly { nodeId: string; localLamport: number; remoteLamport: number }[],
        deviceId: 'dev-1',
      })
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Alice')).toBeDefined();
  });

  it('formats last sync as "just now" for recent timestamps', () => {
    render(
      React.createElement(SyncStatus, {
        state: 'synced',
        lastSyncAt: Date.now() - 2000,
        pendingOps: 0,
        peers: [] as readonly { deviceId: string; label: string; online: boolean; lastSeen: number; cursor: { nodeId: string; position: number } | null }[],
        conflicts: [] as readonly { nodeId: string; localLamport: number; remoteLamport: number }[],
        deviceId: 'dev-1',
      })
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText(/just now/)).toBeDefined();
  });

  it('shows "never" when lastSyncAt is null', () => {
    render(
      React.createElement(SyncStatus, {
        state: 'synced',
        lastSyncAt: null,
        pendingOps: 0,
        peers: [] as readonly { deviceId: string; label: string; online: boolean; lastSeen: number; cursor: { nodeId: string; position: number } | null }[],
        conflicts: [] as readonly { nodeId: string; localLamport: number; remoteLamport: number }[],
        deviceId: 'dev-1',
      })
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText(/never/)).toBeDefined();
  });
});

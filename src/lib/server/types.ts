/**
 * VantaOS Shared API Types
 *
 * Central type definitions for the server-side API layer.
 * All API routes should use these types for consistent request/response shapes.
 */

// ─── Standard API Response Envelope ────────────────────────────────────────

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  requestId?: string;
}

// ─── Standard Error Shape ──────────────────────────────────────────────────

export interface ApiError {
  error: string;
  requestId?: string;
  code?: string;
}

// ─── Health Check Types ────────────────────────────────────────────────────

export type ServiceHealth = 'healthy' | 'degraded' | 'unhealthy';

export interface ServiceStatus {
  name: string;
  status: ServiceHealth;
  message?: string;
}

export interface HealthStatus {
  status: ServiceHealth;
  timestamp: string;
  services: Record<string, { configured?: boolean; available?: boolean; status?: string }>;
}

// ─── Status Endpoint Types ─────────────────────────────────────────────────

export interface StatusResponse {
  status: 'ok' | 'degraded' | 'error';
  version: string;
  timestamp: string;
  mode: 'connected' | 'demo';
  services: Record<string, string>;
  tips: string[];
}

// ─── Version Info ──────────────────────────────────────────────────────────

export interface VersionInfo {
  version: string;
  build?: string;
  timestamp?: string;
}

// ─── API Request Wrapper ───────────────────────────────────────────────────

export interface ApiRequest {
  requestId: string;
  timestamp: string;
}

export function createApiRequest(requestId?: string): ApiRequest {
  return {
    requestId: requestId ?? generateRequestId(),
    timestamp: new Date().toISOString(),
  };
}

function generateRequestId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const str = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ─── Peers Types ───────────────────────────────────────────────────────────

export interface PeerInfo {
  id: string;
  address: string;
  protocol: string;
  connectedAt: string;
}

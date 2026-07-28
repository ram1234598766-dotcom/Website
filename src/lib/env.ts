/**
 * Environment detection utilities for VantaOS.
 * Determines which services are available at runtime.
 */

export function getSupabaseUrl(): string {
  // In Next.js static export, NEXT_PUBLIC_* are inlined at build time.
  // We check both the build-time value and a runtime fallback.
  return (typeof process !== 'undefined' && (process as any).env?.NEXT_PUBLIC_SUPABASE_URL) || '';
}

export function getSupabaseKey(): string {
  return (typeof process !== 'undefined' && (process as any).env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) || '';
}

export function isSupabaseConfigured(): boolean {
  const url = getSupabaseUrl();
  return !!(url && !url.includes('placeholder') && !url.includes('YOUR_') && !url.includes('http://placeholder'));
}

export function isGeminiConfigured(): boolean {
  // At runtime on the client, we can't check GEMINI_API_KEY directly.
  // We check via the health endpoint or assume it's not configured.
  return false; // Will be detected at runtime
}

export function getAppUrl(): string {
  return (typeof process !== 'undefined' && (process as any).env?.NEXT_PUBLIC_APP_URL) || 
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8080');
}

export type ServiceStatus = 'available' | 'unavailable' | 'checking';

export const DEMO_MODE = !isSupabaseConfigured();

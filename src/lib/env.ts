/**
 * Environment detection utilities for VantaOS.
 * Determines which services are available at runtime.
 */

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

// Exact-form process.env reads (without the "(process as any).env?" indirection)
// so Next.js inlines NEXT_PUBLIC_* values at build time in the static export.
const fbApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '';
const fbAuthDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '';
const fbProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '';
const fbAppId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '';

export function isFirebaseConfigured(): boolean {
  return !!(
    fbApiKey &&
    fbAuthDomain &&
    fbProjectId &&
    fbAppId &&
    !fbAuthDomain.includes('placeholder') &&
    !fbApiKey.includes('YOUR_')
  );
}

export const DEMO_MODE = !isFirebaseConfigured();

export const runtime = 'nodejs';
export const dynamic = 'force-static';

import { isFirebaseConfigured } from '@/src/lib/env';

export async function GET(): Promise<Response> {
  const indexedDBAvailable = typeof indexedDB !== 'undefined' && indexedDB !== null;
  const firebaseConfigured = isFirebaseConfigured();
  const status = firebaseConfigured || indexedDBAvailable ? 'ok' : 'degraded';

  const body = {
    status,
    timestamp: new Date().toISOString(),
    services: {
      firebase: { configured: firebaseConfigured },
      indexeddb: { available: indexedDBAvailable },
    },
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  });
}

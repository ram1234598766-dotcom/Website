/**
 * GET /api/health
 *
 * Returns the operational health of the VantaOS application.
 * Reports status of Firebase (auth) and IndexedDB (local persistence).
 *
 * Always returns 200 with JSON — use the `status` field to distinguish
 * healthy from degraded. This keeps load-balancers and uptime monitors
 * from flapping on partial outages.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-static';

export async function GET(): Promise<Response> {
  const timestamp = new Date().toISOString();

  const { isFirebaseConfigured } = await import('@/src/lib/env');
  const firebaseConfigured = isFirebaseConfigured();
  const indexeddbAvailable = typeof indexedDB !== 'undefined';

  const services = {
    firebase: { configured: firebaseConfigured },
    indexeddb: { available: indexeddbAvailable },
  };

  const allHealthy = firebaseConfigured || indexeddbAvailable;
  const status: 'ok' | 'degraded' = allHealthy ? 'ok' : 'degraded';

  return new Response(JSON.stringify({ status, timestamp, services }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  });
}

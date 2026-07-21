export async function onRequestGet() {
  return Response.json({
    ok: true,
    uptimeSeconds: 0,
    environment: 'cloudflare-pages',
    timestamp: new Date().toISOString(),
  });
}

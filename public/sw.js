const CACHE_NAME = 'vantaos-static-v1';
const API_CACHE_NAME = 'vantaos-api-v1';
const OFFLINE_URL = '/offline.html';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/404.html',
  '/manifest.json',
  '/favicon.svg',
  '/og-image.png',
  '/_next/static/css/',
  '/_next/static/chunks/',
  '/_next/static/media/',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Best-effort precache; individual failures are tolerated.
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== API_CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return;
  }

  if (url.origin === self.location.origin) {
    if (isStaticAsset(request)) {
      event.respondWith(cacheFirst(request));
      return;
    }

    if (isApiRoute(url.pathname)) {
      event.respondWith(networkFirst(request));
      return;
    }
  }

  event.respondWith(networkFirst(request));
});

function isStaticAsset(request) {
  const accept = request.headers.get('accept') || '';
  if (accept.includes('text/html')) {
    return true;
  }
  const url = new URL(request.url);
  return (
    url.pathname.match(/\.(css|js|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|webp|avif|ico)$/) !== null ||
    url.pathname.startsWith('/_next/static/')
  );
}

function isApiRoute(pathname) {
  return pathname.startsWith('/api/');
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    if (request.headers.get('accept')?.includes('text/html')) {
      return getOfflinePage();
    }
    throw error;
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(API_CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    if (request.headers.get('accept')?.includes('text/html')) {
      return getOfflinePage();
    }

    return new Response(JSON.stringify({ error: 'offline', message: 'You are currently offline.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function getOfflinePage() {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(OFFLINE_URL);
  if (cached) {
    return cached;
  }

  const offlineHtml = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Offline — VantaOS</title>
        <style>
          :root {
            --bg: #07070b;
            --text: #e6e9f0;
            --muted: #646a80;
            --brand: #6366f1;
          }
          * { box-sizing: border-box; }
          html, body {
            margin: 0;
            padding: 0;
            background: var(--bg);
            color: var(--text);
            font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .container { text-align: center; padding: 2rem; max-width: 420px; }
          h1 { font-size: 1.5rem; margin: 0.5rem 0; }
          p { color: var(--muted); margin: 0.5rem 0 1.5rem; }
          button {
            background: var(--brand);
            color: #fff;
            border: none;
            border-radius: 999px;
            padding: 0.75rem 1.5rem;
            font-weight: 600;
            cursor: pointer;
          }
          button:hover { filter: brightness(1.1); }
        </style>
      </head>
      <body>
        <div class="container">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--brand);">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
            <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
          <h1>You're offline</h1>
          <p>VantaOS needs a connection to load this page. Check your network and try again.</p>
          <button onclick="window.location.reload()">Retry</button>
        </div>
      </body>
    </html>
  `;

  return new Response(offlineHtml, {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  });
}

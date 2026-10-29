// DreamDesk CRM - Service Worker v1.0.0
const CACHE_NAME = 'dreamdesk-crm-v1';

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-192-maskable.png',
  '/icons/icon-512.png',
  '/icons/icon-512-maskable.png',
  '/icons/icon.svg'
];

// Install: Cache essential static shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up old cache versions and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Strategy depending on request type
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (e.g. POST, PATCH, DELETE must go straight to network)
  if (request.method !== 'GET') {
    return;
  }

  // 1. Next.js Static Chunks & Public Icons: Cache First with Network Fallback
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 2. Realtime Sync & SSE endpoints: Never cache, direct network
  if (url.pathname.startsWith('/api/sync/')) {
    return;
  }

  // 3. API Requests: Network First with Graceful Offline JSON
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({
            error: 'Network connection unavailable. Realtime sync will resume when online.',
            offline: true
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      })
    );
    return;
  }

  // 4. Page Navigations (HTML): Network First with Cache Fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const rootCached = await caches.match('/');
          if (rootCached) return rootCached;
          return new Response(
            '<html><body style="font-family:sans-serif;text-align:center;padding:50px;background:#090d16;color:#e2e8f0;">' +
            '<h2>DreamDesk CRM - Offline</h2>' +
            '<p>Your internet connection was interrupted. Please check your data connection or Wi-Fi.</p>' +
            '<button onclick="window.location.reload()" style="background:#2563eb;color:#fff;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;margin-top:16px;">Retry Connection</button>' +
            '</body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        })
    );
    return;
  }
});

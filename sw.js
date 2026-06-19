/* ================================================================
   Plant Knowledge Map — Service Worker
   Strategy: Cache-first with network fallback.
   On install: pre-cache all app assets.
   On fetch:   serve from cache; fall back to network if not cached.
   On activate: delete stale caches from previous versions.
   ================================================================ */

const CACHE_NAME = 'plant-map-v1';

/* All files that must be available offline */
const PRECACHE_ASSETS = [
  './plant-mind-map.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './splash.png'
];

/* ── Install: pre-cache core assets ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Pre-caching app assets');
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting()) // activate immediately
  );
});

/* ── Activate: clean up old cache versions ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim()) // take control of all open pages
  );
});

/* ── Fetch: cache-first strategy ── */
self.addEventListener('fetch', event => {
  // Only handle GET requests; skip non-http(s) (e.g. chrome-extension)
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Serve from cache — works fully offline
        return cached;
      }
      // Not in cache — try network (e.g. Google Fonts on first online visit)
      return fetch(event.request).then(response => {
        // Cache a copy of successful network responses (fonts, etc.)
        if (response && response.status === 200 && response.type !== 'opaque') {
          const toCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        }
        return response;
      }).catch(() => {
        // Network failed and not in cache — return nothing (app still works
        // because system font fallbacks are defined in CSS)
        console.log('[SW] Fetch failed, no cache match:', event.request.url);
      });
    })
  );
});

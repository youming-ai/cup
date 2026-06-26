const CACHE_NAME = 'streamcup-v1';
const PRECACHE_URLS = ['/', '/index.html'];

// Install: precache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for same-origin static assets, network-first for API.
// The cache write must be wrapped in `event.waitUntil` so the SW stays alive
// long enough to persist the entry; otherwise the response promise can
// resolve and the SW may be terminated before `cache.put` settles, leaving
// the cache stale on the next request. `.catch` guards against
// QuotaExceededError so one bad write doesn't poison the response.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return; // let cross-origin requests pass through
  if (url.pathname.startsWith('/api/')) return; // never cache API responses
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          event.waitUntil(
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(event.request, clone))
              .catch(() => {}),
          );
        }
        return response;
      });
      return cached || fetched;
    })
  );
});

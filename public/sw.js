const CACHE_NAME = 'lifesaver-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style-v8.css',
  '/app-v8.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/screenshot.png'
];

// Install Event: cache core shell assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching app shell assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: network first for API calls, cache first for static assets
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // For API endpoints, use network-first strategy (don't serve stale donor records from cache)
  if (requestUrl.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(event.request);
        })
    );
  } else {
    // For static assets, use cache-first strategy
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          if (cachedResponse) {
            // Return cached response, but fetch in the background to keep cache fresh (stale-while-revalidate)
            fetch(event.request).then(networkResponse => {
              if (networkResponse.status === 200) {
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse));
              }
            }).catch(() => {/* Ignore network errors offline */});
            return cachedResponse;
          }
          return fetch(event.request).then(networkResponse => {
            if (networkResponse.status === 200) {
              const responseCopy = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseCopy));
            }
            return networkResponse;
          });
        })
    );
  }
});

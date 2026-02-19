// Madmail Admin — Service Worker
// Cache-first strategy with version-based invalidation.

const CACHE_NAME = 'madmail-v1';
const VERSION_URL = 'version.json';

// Assets to pre-cache on install (the SPA shell).
// Dynamic assets under _app/ are cached on first fetch.
const PRECACHE = [
    './',
    './index.html',
    './manifest.json',
];

// ── Install: pre-cache shell ──
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
    );
    self.skipWaiting();
});

// ── Activate: clean old caches ──
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((names) =>
            Promise.all(
                names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
            )
        )
    );
    self.clients.claim();
});

// ── Fetch: cache-first for same-origin app assets only ──
self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);

    // Skip cross-origin requests entirely — let the browser handle them.
    // This prevents the SW from interfering with API calls to external servers.
    if (url.origin !== self.location.origin) {
        return;
    }

    // Don't cache version.json (used for update checking)
    if (url.pathname.endsWith('version.json')) {
        return;
    }

    // Cache-first for same-origin app assets
    e.respondWith(
        caches.match(e.request).then((cached) => {
            if (cached) return cached;
            return fetch(e.request).then((response) => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
                }
                return response;
            });
        })
    );
});

// ── Message handler: force-refresh ──
self.addEventListener('message', (e) => {
    if (e.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    if (e.data === 'CLEAR_CACHE') {
        caches.keys().then((names) =>
            Promise.all(names.map((n) => caches.delete(n)))
        ).then(() => {
            self.clients.matchAll().then((clients) =>
                clients.forEach((c) => c.postMessage('CACHE_CLEARED'))
            );
        });
    }
});

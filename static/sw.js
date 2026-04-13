// Madmail Admin — Service Worker
// Cache-first strategy with automatic version-based invalidation.
//
// How it works:
//   1. On install, fetches version.json to get the current version string
//   2. Creates a cache named "madmail-<version>" 
//   3. On activate, deletes ALL caches that don't match the current version
//   4. On fetch, serves app assets cache-first; skips API calls and version.json
//
// This means: every new deployment with a new version automatically
// invalidates all old caches when the new SW activates.

const VERSION_FILE = 'version.json';
let CACHE_NAME = 'madmail-v0'; // fallback; overwritten on install

// ── Install: fetch version, create versioned cache, pre-cache shell ──
self.addEventListener('install', (e) => {
    e.waitUntil(
        fetchVersionTag().then((tag) => {
            CACHE_NAME = `madmail-${tag}`;
            return caches.open(CACHE_NAME).then((cache) =>
                cache.addAll(['./', './index.html', './manifest.json'])
            );
        })
    );
    self.skipWaiting();
});

// ── Activate: purge ALL caches that aren't the current version ──
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

    // Skip cross-origin requests — let the browser handle them
    if (url.origin !== self.location.origin) return;

    // Never cache version.json (used for update detection)
    if (url.pathname.endsWith(VERSION_FILE)) return;

    // Never cache API calls (/api/ or /admin/ paths)
    if (url.pathname.includes('/api/')) return;

    // Cache-first for same-origin app assets (JS, CSS, HTML, fonts, images)
    e.respondWith(
        caches.match(e.request).then((cached) => {
            if (cached) return cached;
            return fetch(e.request).then((response) => {
                if (response.ok && e.request.method === 'GET') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
                }
                return response;
            });
        })
    );
});

// ── Message handler: manual cache clear from the app ──
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

// ── Helper: read version tag from version.json ──
async function fetchVersionTag() {
    try {
        const res = await fetch(VERSION_FILE, { cache: 'no-store' });
        if (res.ok) {
            const data = await res.json();
            if (data.version) return data.version;
        }
    } catch { /* ignore */ }
    // Fallback: use current timestamp so cache is still unique per install
    return `build-${Date.now()}`;
}

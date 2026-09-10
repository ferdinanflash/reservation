// ================= SERVICE WORKER =================
// Makes the app installable (PWA) and keeps it usable when the network is
// slow or offline. Strategy:
//   - navigations (the HTML page): network first, cached copy as fallback
//   - same-origin static assets (js/css/images/icons): cache first
//   - everything else (Supabase, CDN): never touched, always straight to network
//
// >>> Bump CACHE_VERSION on every deploy so old files are dropped. <<<
const CACHE_VERSION = '2026-09-11-1';
const CACHE_NAME = `svs-${CACHE_VERSION}`;
const PRECACHE = [
    './',
    './index.html',
    './style.css',
    './common.js',
    './lang.js',
    './js/app-core.js',
    './js/app-auth.js',
    './js/app-notes.js',
    './js/app-schedule.js',
    './js/app-applications.js',
    './js/app-waiting.js',
    './js/app-extras.js',
    './fire-banner.js',
    './opening-animation.js',
    './site.webmanifest',
    './icon-192.png',
    './icon-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(PRECACHE))
            .catch(() => undefined)
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return; // Supabase / CDN: untouched

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                    return response;
                })
                .catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html')))
        );
        return;
    }

    event.respondWith(
        caches.match(request).then((cached) => cached || fetch(request).then((response) => {
            if (response.ok) {
                const copy = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
        }))
    );
});

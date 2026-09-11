// ================= SERVICE WORKER =================
// Makes the app installable (PWA) and keeps it usable when the network is
// slow or offline. Strategy:
//   - navigations (the HTML page): network first, cached copy as fallback
//   - same-origin static assets (js/css/images/icons): cache first
//   - everything else (Supabase, CDN): never touched, always straight to network
//
// >>> Bump CACHE_VERSION on every deploy so old files are dropped. <<<
const CACHE_VERSION = '2026-09-11-5';
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
    './js/app-notifications.js',
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


// ================= NOTIFICATION HANDLING =================
// Two sources can trigger a notification:
//  1) Web Push ('push' event, below) — delivered by the browser's push
//     service even when the app/tab/browser is completely closed.
//  2) The page's own Supabase Realtime listener (app-notifications.js),
//     which only updates the on-screen status while the tab is open and no
//     longer shows a duplicate local notification (push covers that now).
self.addEventListener('push', (event) => {
    let payload = {};
    try {
        payload = event.data ? event.data.json() : {};
    } catch (error) {
        payload = { title: 'Reservation Update', body: event.data ? event.data.text() : '' };
    }

    const title = payload.title || 'Reservation Update';
    const options = {
        body: payload.body || '',
        icon: './icon-192.png',
        badge: './icon-192.png',
        tag: `reservation-${payload.application_id || 'update'}`,
        renotify: true,
        data: {
            application_id: payload.application_id || null,
            status: payload.status || null,
            nickname: payload.nickname || null,
            old_time_slot: payload.old_time_slot || null,
            new_time_slot: payload.new_time_slot || null,
            original_time_slot: payload.original_time_slot || null,
            reason: payload.reason || null
        }
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

// Rare: the browser/OS rotates the push subscription on its own (e.g. after
// a long time or a security event). Re-subscribe immediately and hand the
// new subscription to any open page so it can be re-saved to Supabase —
// otherwise future pushes would silently stop arriving for this device.
self.addEventListener('pushsubscriptionchange', (event) => {
    event.waitUntil(
        self.registration.pushManager
            .subscribe(event.oldSubscription ? event.oldSubscription.options : { userVisibleOnly: true })
            .then(async (subscription) => {
                const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
                clientList.forEach((client) => client.postMessage({
                    type: 'PUSH_SUBSCRIPTION_CHANGED',
                    subscription: subscription.toJSON()
                }));
            })
            .catch(() => undefined)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if ('focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow('./');
        })
    );
});

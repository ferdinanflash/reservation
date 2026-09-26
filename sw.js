// ================= SERVICE WORKER =================
// Makes the app installable (PWA) and keeps it usable when the network is
// slow or offline. Strategy:
//   - navigations (the HTML page): network first, cached copy as fallback
//   - same-origin static assets (js/css/images/icons): stale-while-revalidate
//     (serve the cached copy instantly, then refresh it in the background so
//     the NEXT visit is up to date even if nobody remembered to bump a
//     version number — see the fetch handler below for why this matters)
//   - everything else (Supabase, CDN): never touched, always straight to network
//
// >>> Still bump CACHE_VERSION on every deploy. <<<
// It's no longer the only thing standing between users and stale files (the
// stale-while-revalidate fetch handler below self-heals that), but it's what
// throws away old cache namespaces on activate() and gives every user a
// clean slate immediately instead of waiting for a background revalidation.
const CACHE_VERSION = '2026-09-26-02';
const CACHE_NAME = `svs-${CACHE_VERSION}`;

// Icons/images/manifest whose version lives in the FILENAME (e.g. "-v8.png"),
// not a "?v=" query string. These rarely change, so listing them once here is
// fine — when their filename changes, this list simply needs a matching edit.
const PRECACHE_STATIC = [
    './',
    './index.html',
    './christmas-banner-v3.jpg',
    './valentine-banner-v1.jpg',
    './cny-banner-v1.jpg',
    './eid-banner-v1.jpg',
    './midautumn-banner-v1.jpg',
    './bluefire-banner-v1.mp4',
    './bluefire-banner-v1.png',
    './default-banner-v2.jpg',
    './pwa-icon-192-v8.png',
    './pwa-icon-512-v8.png',
    './apple-touch-icon-v8.png',
    './favicon-32-v8.png',
    './favicon-16-v8.png',
    './favicon-v8.ico'
];

// style.css, common.js, lang.js, the js/*.js modules, fire-banner.js and
// site.webmanifest are instead versioned with a "?v=" query string that only
// lives in index.html. Hardcoding those same numbers a second time here used
// to drift out of sync with index.html (precache held "./js/app-core.js"
// while the page actually requested "js/app-core.js?v=48" — two different
// cache keys for one file, the first of which nothing ever read again).
// Instead of guessing, read index.html itself at install time and precache
// exactly the versioned URLs it references right now.
async function getVersionedAssetUrls() {
    try {
        const res = await fetch('./index.html', { cache: 'no-store' });
        const html = await res.text();
        const urls = new Set();
        const attrRe = /\b(?:src|href)\s*=\s*"([^"]+)"/g;
        let match;
        while ((match = attrRe.exec(html))) {
            const raw = match[1];
            if (/^([a-z]+:)?\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('#')) continue; // skip cross-origin / inline
            if (!/\.(js|css|webmanifest)(\?|$)/i.test(raw)) continue; // only the query-string-versioned asset types
            urls.add(raw);
        }
        return [...urls];
    } catch (error) {
        return []; // offline on first install: static list below still works
    }
}

self.addEventListener('install', (event) => {
    event.waitUntil(
        getVersionedAssetUrls()
            .then((versionedUrls) => caches.open(CACHE_NAME)
                .then((cache) => cache.addAll([...PRECACHE_STATIC, ...versionedUrls])))
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

    // Stale-while-revalidate: answer from cache immediately when we have a
    // copy (fast, and works offline), but ALWAYS also kick off a network
    // fetch that refreshes the cache in the background for next time.
    // event.waitUntil() keeps the worker alive long enough for that
    // background fetch to finish even after we've already responded.
    //
    // This is the safety net for human error: if a file's content changes
    // but its "?v=" (or CACHE_VERSION) doesn't get bumped, the OLD cache-first
    // code below would have kept serving the stale copy forever. Now the very
    // next request for that same URL updates the cache, so the visit after
    // that gets the corrected file — no manual "clear site data" needed.
    event.respondWith(
        caches.match(request).then((cached) => {
            const revalidate = fetch(request)
                .then((response) => {
                    if (response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                    }
                    return response;
                })
                .catch(() => undefined);

            if (cached) {
                event.waitUntil(revalidate);
                return cached;
            }
            return revalidate.then((response) => response || caches.match(request));
        })
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

    // Announcements (President Panel -> send-announcement Edge Function) are
    // broadcast to every subscriber and aren't tied to any one reservation,
    // so they get their own tag — reusing the "reservation-*" tag would
    // silently replace (or be replaced by) a real reservation-status
    // notification sitting in the same device's notification tray.
    const isAnnouncement = payload.type === 'announcement';

    const title = payload.title || (isAnnouncement ? 'Announcement' : 'Reservation Update');
    const options = {
        body: payload.body || '',
        icon: './pwa-icon-192-v8.png',
        badge: './pwa-icon-192-v8.png',
        tag: isAnnouncement ? `announcement-${Date.now()}` : `reservation-${payload.application_id || 'update'}`,
        renotify: true,
        data: isAnnouncement
            ? { type: 'announcement' }
            : {
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

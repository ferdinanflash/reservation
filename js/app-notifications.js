// ================= GUEST REAL-TIME NOTIFICATIONS =================
// Guest users have no account/session. Each successful reservation ID is
// stored in localStorage and subscribed to independently.

const MY_APPLICATION_IDS_KEY = 'my_application_ids';
const MY_APPLICATION_ID_KEY = 'my_application_id'; // legacy compatibility
const MY_APPLICATION_NOTIFICATIONS_KEY = 'my_application_notifications_enabled';
const APPLICATION_RETENTION_MS = 10 * 24 * 60 * 60 * 1000;

const myApplicationRealtimeChannels = new Map();
const myApplicationLastStatuses = new Map();

function isGuestNotificationSupported() {
    return typeof window !== 'undefined' && 'Notification' in window;
}

function isPushSupported() {
    return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

// ================= TEMPORARY PUSH DEBUG MODE =================
// Open the app with ?pushdebug=1 appended to the URL (e.g.
// https://yoursite.com/?pushdebug=1) to see exactly where push subscription
// setup succeeds or fails, as a plain alert() popup on the device itself —
// no desktop/USB debugging needed. Does nothing unless that query param is
// present, so it's safe to leave in. Remove this whole block (and the
// pushDebugAlert(...) calls below) once the issue is found and fixed.
function pushDebugEnabled() {
    return typeof location !== 'undefined' && /(?:\?|&)pushdebug=1(?:&|$)/.test(location.search);
}
function pushDebugAlert(message) {
    if (pushDebugEnabled()) alert('[Push Debug] ' + message);
}
// =================================================================

// Standard helper: VAPID public key is base64url, pushManager.subscribe()
// needs it as a Uint8Array.
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
}

// Creates (or reuses) the browser's push subscription for this device and
// saves it against a specific application id, so the Edge Function knows
// which device(s) to notify when that reservation's status changes.
// This is what makes notifications work even with the app/browser closed —
// unlike Supabase Realtime, delivery is handled by the OS/browser push
// service, not by any JS running on the page.
async function ensurePushSubscriptionForApplication(applicationId) {
    if (!isPushSupported()) {
        pushDebugAlert(`isPushSupported() = false for reservation ${applicationId} — this browser/context has no serviceWorker or PushManager.`);
        return null;
    }
    if (!isValidApplicationId(applicationId)) {
        pushDebugAlert(`isValidApplicationId() rejected "${applicationId}" — not attempting push subscription.`);
        return null;
    }

    try {
        pushDebugAlert(`Waiting for navigator.serviceWorker.ready (reservation ${applicationId})...`);
        const registration = await navigator.serviceWorker.ready;
        pushDebugAlert(`Service worker ready. Checking for existing subscription...`);
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            pushDebugAlert(`No existing subscription. Calling pushManager.subscribe()...`);
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(PUSH_VAPID_PUBLIC_KEY)
            });
            pushDebugAlert(`subscribe() succeeded. Endpoint: ${subscription.endpoint.slice(0, 60)}...`);
        } else {
            pushDebugAlert(`Reusing existing subscription. Endpoint: ${subscription.endpoint.slice(0, 60)}...`);
        }

        await savePushSubscriptionRow(String(applicationId), subscription);
        return subscription;
    } catch (error) {
        pushDebugAlert(`FAILED for reservation ${applicationId}: ${error && error.name ? error.name : ''} ${error && error.message ? error.message : String(error)}`);
        console.warn(`Push subscription failed for reservation ${applicationId}:`, error);
        return null;
    }
}

async function savePushSubscriptionRow(applicationId, subscription) {
    const client = typeof getSupabase === 'function' ? getSupabase() : null;
    if (!client) {
        pushDebugAlert(`savePushSubscriptionRow: getSupabase() returned null — cannot save.`);
        return;
    }

    const json = subscription.toJSON();
    try {
        pushDebugAlert(`Saving subscription to Supabase for reservation ${applicationId}...`);
        const { error } = await client.from('push_subscriptions').upsert({
            application_id: applicationId,
            endpoint: json.endpoint,
            subscription: json
        }, { onConflict: 'application_id,endpoint' });

        if (error) {
            pushDebugAlert(`Supabase upsert error: ${error.message || JSON.stringify(error)}`);
            console.warn('Could not save push subscription:', error);
        } else {
            pushDebugAlert(`Saved to Supabase successfully for reservation ${applicationId}!`);
        }
    } catch (error) {
        pushDebugAlert(`Supabase upsert threw: ${error && error.message ? error.message : String(error)}`);
        console.warn('Could not save push subscription:', error);
    }
}

async function subscribeAllSavedApplicationsToPush() {
    if (!isPushSupported()) {
        pushDebugAlert('subscribeAllSavedApplicationsToPush: isPushSupported() = false, stopping.');
        return;
    }
    if (!areGuestNotificationsEnabled()) {
        pushDebugAlert('subscribeAllSavedApplicationsToPush: notifications are not enabled (localStorage flag is false), stopping.');
        return;
    }
    const ids = getSavedApplicationIds();
    pushDebugAlert(`subscribeAllSavedApplicationsToPush: found ${ids.length} saved application id(s): ${ids.join(', ') || '(none)'}`);
    for (const id of ids) await ensurePushSubscriptionForApplication(id);
}

// Unsubscribes this device entirely (used when the user turns notifications
// off) and removes every row pointing at it so the server stops trying to
// send pushes to a subscription that no longer exists.
async function unsubscribeDeviceFromPush() {
    if (!isPushSupported()) return;

    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) return;

        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();

        const client = typeof getSupabase === 'function' ? getSupabase() : null;
        if (client) {
            await client.from('push_subscriptions').delete().eq('endpoint', endpoint);
        }
    } catch (error) {
        console.warn('Could not remove push subscription:', error);
    }
}

async function removePushSubscriptionForApplication(applicationId) {
    const client = typeof getSupabase === 'function' ? getSupabase() : null;
    if (!client || !isValidApplicationId(applicationId)) return;
    try {
        await client.from('push_subscriptions').delete().eq('application_id', String(applicationId));
    } catch (error) {
        console.warn(`Could not remove push subscription for reservation ${applicationId}:`, error);
    }
}

// If the browser ever rotates the subscription on its own (see sw.js
// 'pushsubscriptionchange'), re-save it against every reservation id this
// device currently tracks so pushes keep arriving without user action.
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type !== 'PUSH_SUBSCRIPTION_CHANGED' || !event.data.subscription) return;
        const ids = getSavedApplicationIds();
        ids.forEach((id) => savePushSubscriptionRow(id, {
            toJSON: () => event.data.subscription
        }));
    });
}

function isValidApplicationId(value) {
    return /^(?:\d+|[0-9a-f]{8}-[0-9a-f-]{27,36})$/i.test(String(value || ''));
}

function readGuestApplicationRecords() {
    try {
        const raw = localStorage.getItem(MY_APPLICATION_IDS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) {
            return parsed
                .filter(item => item && isValidApplicationId(item.id))
                .map(item => ({
                    id: String(item.id),
                    savedAt: Number(item.savedAt) || Date.now()
                }));
        }
    } catch (error) {
        console.warn('Could not read saved application IDs:', error);
    }

    // Migrate the previous single-ID implementation automatically.
    const legacyId = localStorage.getItem(MY_APPLICATION_ID_KEY);
    return isValidApplicationId(legacyId)
        ? [{ id: String(legacyId), savedAt: Date.now() }]
        : [];
}

function writeGuestApplicationRecords(records) {
    const unique = new Map();
    records.forEach(item => {
        if (!item || !isValidApplicationId(item.id)) return;
        unique.set(String(item.id), {
            id: String(item.id),
            savedAt: Number(item.savedAt) || Date.now()
        });
    });

    const clean = [...unique.values()];
    localStorage.setItem(MY_APPLICATION_IDS_KEY, JSON.stringify(clean));

    // Keep the legacy key pointing at the newest reservation for compatibility
    // with older project code. It is NOT used as the realtime source of truth.
    if (clean.length) {
        localStorage.setItem(MY_APPLICATION_ID_KEY, clean[clean.length - 1].id);
    } else {
        localStorage.removeItem(MY_APPLICATION_ID_KEY);
    }
    return clean;
}

function cleanupExpiredGuestApplicationIds() {
    const now = Date.now();
    const records = readGuestApplicationRecords();
    const active = records.filter(item => (now - item.savedAt) < APPLICATION_RETENTION_MS);
    const expired = records.filter(item => (now - item.savedAt) >= APPLICATION_RETENTION_MS);

    expired.forEach(item => {
        stopGuestApplicationRealtime(item.id);
        removePushSubscriptionForApplication(item.id);
    });
    writeGuestApplicationRecords(active);

    return { active, expired };
}

function addGuestApplicationId(applicationId) {
    if (!isValidApplicationId(applicationId)) return;
    cleanupExpiredGuestApplicationIds();
    const records = readGuestApplicationRecords();
    records.push({ id: String(applicationId), savedAt: Date.now() });
    writeGuestApplicationRecords(records);
}

function getSavedApplicationIds() {
    return cleanupExpiredGuestApplicationIds().active.map(item => item.id);
}

function getSavedApplicationId() {
    const ids = getSavedApplicationIds();
    return ids.length ? ids[ids.length - 1] : null;
}

function areGuestNotificationsEnabled() {
    return localStorage.getItem(MY_APPLICATION_NOTIFICATIONS_KEY) === 'true';
}

async function requestGuestNotificationPermission() {
    if (!isGuestNotificationSupported()) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;

    try {
        return (await Notification.requestPermission()) === 'granted';
    } catch (error) {
        console.warn('Notification permission request failed:', error);
        return false;
    }
}

function setGuestNotificationPreference(enabled) {
    localStorage.setItem(MY_APPLICATION_NOTIFICATIONS_KEY, enabled ? 'true' : 'false');
}

function getNotificationStatusText(status) {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'accepted' || normalized === 'approved') return 'Approved';
    if (normalized === 'rejected') return 'Rejected';
    if (normalized === 'waiting' || normalized === 'pending') return 'Waiting';
    return String(status || 'Updated');
}

function updateGuestApplicationStatusUI(status, application) {
    if (typeof loadApplications === 'function') loadApplications();

    const statusEl = document.getElementById('my-application-status');
    if (statusEl) {
        statusEl.textContent = getNotificationStatusText(status);
        statusEl.dataset.status = String(status || '').toLowerCase();
    }

    window.dispatchEvent(new CustomEvent('applicationStatusUpdated', {
        detail: { status, application: application || null }
    }));
}

function getOriginalTimeSlotFromApplication(application, fallback = '') {
    let log = application?.time_log;
    if (typeof log === 'string') {
        try { log = JSON.parse(log); } catch (_) { log = []; }
    }
    if (!Array.isArray(log)) return fallback;
    const created = log.find(entry => String(entry?.action || '').toLowerCase() === 'created');
    const match = String(created?.detail || '').match(/\b([01]\d|2[0-3]):[0-5]\d\b/);
    return match ? match[0] : fallback;
}

async function showGuestStatusNotification(status, application) {
    if (!isGuestNotificationSupported() || Notification.permission !== 'granted') return;

    const normalized = String(status || '').toLowerCase();
    const player = String(application?.nickname || 'Player').trim() || 'Player';
    const oldTime = String(application?.__old_time_slot || '').trim();
    const newTime = String(application?.time_slot || '').trim();
    const originalTime = String(application?.__original_time_slot || '').trim();

    let title = `${player} — Reservation Update`;
    let body = `Your reservation status is now ${getNotificationStatusText(status)}.`;

    if ((normalized === 'accepted' || normalized === 'approved') && newTime && originalTime && newTime !== originalTime) {
        title = `${player} — Reservation Approved 🎉`;
        body = `Your reservation has been approved, but the time slot was changed from your original request (${originalTime} UTC) to ${newTime} UTC. Please use ${newTime} UTC as your confirmed slot.`;
    } else if (normalized === 'accepted' || normalized === 'approved') {
        title = `${player} — Reservation Approved 🎉`;
        body = newTime
            ? `Your reservation has been approved for ${newTime} UTC.`
            : 'Your reservation has been approved. Please check the reservation schedule for the latest details.';
    } else if (normalized === 'rejected') {
        title = `${player} — Reservation Rejected`;
        body = 'Your reservation request has been rejected. Please check the reservation details for more information.';
    } else if ((normalized === 'waiting' || normalized === 'pending') && oldTime && newTime && oldTime !== newTime) {
        title = `${player} — Reservation Time Moved`;
        body = `Your reservation slot was moved from ${oldTime} UTC to ${newTime} UTC. Your reservation is still Waiting. ${newTime} UTC is the new slot assigned to your application.`;
    }

    const applicationId = application?.id ? String(application.id) : null;
    const options = {
        body,
        icon: './icon-192.png',
        badge: './icon-192.png',
        tag: `reservation-${applicationId || 'update'}`,
        renotify: true,
        data: { application_id: applicationId, status }
    };

    try {
        if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.ready;
            if (registration?.showNotification) {
                await registration.showNotification(title, options);
                return;
            }
        }
    } catch (error) {
        console.warn('Service Worker notification failed:', error);
    }

    try { new Notification(title, options); }
    catch (error) { console.warn('Browser notification failed:', error); }
}

function stopGuestApplicationRealtime(applicationId) {
    const id = String(applicationId || '');
    const channel = myApplicationRealtimeChannels.get(id);
    const client = typeof getSupabase === 'function' ? getSupabase() : null;

    if (client && channel) client.removeChannel(channel);
    myApplicationRealtimeChannels.delete(id);
    myApplicationLastStatuses.delete(id);
}

async function startGuestApplicationRealtime(savedAppId) {
    const id = String(savedAppId || '');
    const client = typeof getSupabase === 'function' ? getSupabase() : null;
    if (!client || !isValidApplicationId(id) || !areGuestNotificationsEnabled()) return;
    if (myApplicationRealtimeChannels.has(id)) return;

    try {
        const { data: currentApp, error: currentError } = await client
            .from('reservation_slots')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (!currentError && currentApp) {
            myApplicationLastStatuses.set(id, currentApp.status);
            updateGuestApplicationStatusUI(currentApp.status, currentApp);
        }

        const channel = client
            .channel(`guest_application_${id}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'reservation_slots',
                filter: `id=eq.${id}`
            }, async (payload) => {
                const oldStatus = payload.old?.status;
                const newStatus = payload.new?.status;
                const previousStatus = myApplicationLastStatuses.get(id) ?? oldStatus;

                // Always updates the on-screen status while this tab happens
                // to be open.
                updateGuestApplicationStatusUI(newStatus, payload.new);

                // The actual OS notification (including with the app/browser
                // fully closed) is now delivered via Web Push — see the Edge
                // Function and sw.js 'push' handler. We only fall back to a
                // local notification here for browsers that don't support
                // the Push API at all, to avoid a duplicate popping up
                // alongside the push notification in the common case.
                if (!isPushSupported()) {
                    const changed = String(previousStatus || '').toLowerCase() !== String(newStatus || '').toLowerCase();
                    const finalStatus = ['accepted', 'approved', 'rejected'].includes(String(newStatus || '').toLowerCase());
                    const oldTime = String(payload.old?.time_slot || '').trim();
                    const newTime = String(payload.new?.time_slot || '').trim();
                    const waitingTimeMoved =
                        ['waiting', 'pending'].includes(String(newStatus || '').toLowerCase()) &&
                        ['waiting', 'pending'].includes(String(previousStatus || payload.old?.status || '').toLowerCase()) &&
                        oldTime && newTime && oldTime !== newTime;

                    if ((changed && finalStatus) || waitingTimeMoved) {
                        const enrichedApplication = {
                            ...payload.new,
                            __old_time_slot: oldTime,
                            __original_time_slot: getOriginalTimeSlotFromApplication(payload.new, oldTime)
                        };
                        await showGuestStatusNotification(newStatus, enrichedApplication);
                    }
                }

                myApplicationLastStatuses.set(id, newStatus);
            })
            .subscribe((status) => {
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.warn(`Guest reservation ${id} realtime channel:`, status);
                }
            });

        myApplicationRealtimeChannels.set(id, channel);
    } catch (error) {
        console.error(`Failed to start realtime for reservation ${id}:`, error);
    }
}

async function startAllGuestApplicationRealtime() {
    cleanupExpiredGuestApplicationIds();
    if (!areGuestNotificationsEnabled()) return;
    for (const id of getSavedApplicationIds()) await startGuestApplicationRealtime(id);
}

function stopAllGuestApplicationRealtime() {
    [...myApplicationRealtimeChannels.keys()].forEach(stopGuestApplicationRealtime);
}

async function enableGuestApplicationNotifications() {
    const permissionGranted = await requestGuestNotificationPermission();
    if (!permissionGranted) {
        setGuestNotificationPreference(false);
        return false;
    }

    setGuestNotificationPreference(true);
    await startAllGuestApplicationRealtime();
    await subscribeAllSavedApplicationsToPush();
    return true;
}

function disableGuestApplicationNotifications() {
    setGuestNotificationPreference(false);
    stopAllGuestApplicationRealtime();
    unsubscribeDeviceFromPush();
}

// Called after a successful guest submission.
async function setupGuestNotificationsAfterSubmission(applicationId, enabled) {
    if (!isValidApplicationId(applicationId)) return;

    addGuestApplicationId(String(applicationId));

    if (!enabled) return;

    const permissionGranted = await requestGuestNotificationPermission();
    if (!permissionGranted) {
        setGuestNotificationPreference(false);
        return;
    }

    setGuestNotificationPreference(true);
    await startGuestApplicationRealtime(String(applicationId));
    await ensurePushSubscriptionForApplication(String(applicationId));
}

// Expose cleanup for optional admin/debug UI and run it once per page load.
window.cleanupGuestApplicationNotificationIds = cleanupExpiredGuestApplicationIds;

document.addEventListener('DOMContentLoaded', () => {
    pushDebugAlert('app-notifications.js (debug build) loaded and DOMContentLoaded fired.');
    cleanupExpiredGuestApplicationIds();
    startAllGuestApplicationRealtime();
    // Also re-establishes the push subscription on every load. Cheap no-op
    // if one already exists; important for devices that enabled
    // notifications before Web Push support was added.
    subscribeAllSavedApplicationsToPush();
});

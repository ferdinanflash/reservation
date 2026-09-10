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

    expired.forEach(item => stopGuestApplicationRealtime(item.id));
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

async function showGuestStatusNotification(status, application) {
    if (!isGuestNotificationSupported() || Notification.permission !== 'granted') return;

    const normalized = String(status || '').toLowerCase();
    let title = 'Reservation Update';
    let body = `Your reservation status is now ${getNotificationStatusText(status)}.`;

    if (normalized === 'accepted' || normalized === 'approved') {
        title = 'Reservation Approved 🎉';
        body = 'Your reservation has been approved. Please check the reservation schedule for the latest details.';
    } else if (normalized === 'rejected') {
        title = 'Reservation Rejected';
        body = 'Your reservation has been rejected. Please check the reservation details for the latest information.';
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

                updateGuestApplicationStatusUI(newStatus, payload.new);

                const changed = String(previousStatus || '').toLowerCase() !== String(newStatus || '').toLowerCase();
                const finalStatus = ['accepted', 'approved', 'rejected'].includes(String(newStatus || '').toLowerCase());
                if (changed && finalStatus) await showGuestStatusNotification(newStatus, payload.new);

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
    return true;
}

function disableGuestApplicationNotifications() {
    setGuestNotificationPreference(false);
    stopAllGuestApplicationRealtime();
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
}

// Expose cleanup for optional admin/debug UI and run it once per page load.
window.cleanupGuestApplicationNotificationIds = cleanupExpiredGuestApplicationIds;

document.addEventListener('DOMContentLoaded', () => {
    cleanupExpiredGuestApplicationIds();
    startAllGuestApplicationRealtime();
});

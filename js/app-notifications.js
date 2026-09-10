// ================= GUEST REAL-TIME NOTIFICATIONS =================
// Guest users have no account/session, so the notification target is the
// Supabase reservation_slots row id saved in this browser.

const MY_APPLICATION_ID_KEY = 'my_application_id';
const MY_APPLICATION_NOTIFICATIONS_KEY = 'my_application_notifications_enabled';
let myApplicationRealtimeChannel = null;
let myApplicationLastStatus = null;

function isGuestNotificationSupported() {
    return typeof window !== 'undefined' && 'Notification' in window;
}

function getSavedApplicationId() {
    const value = localStorage.getItem(MY_APPLICATION_ID_KEY);
    if (!value) return null;
    // Current project uses numeric BIGINT ids. Keep UUID compatibility too.
    if (!/^(?:\d+|[0-9a-f]{8}-[0-9a-f-]{27,36})$/i.test(value)) return null;
    return value;
}

function areGuestNotificationsEnabled() {
    return localStorage.getItem(MY_APPLICATION_NOTIFICATIONS_KEY) === 'true';
}

async function requestGuestNotificationPermission() {
    if (!isGuestNotificationSupported()) return false;

    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;

    try {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
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
    // Keep the normal schedule/table UI in sync without a page refresh.
    // loadApplications() already rebuilds all schedule rows from Supabase.
    if (typeof loadApplications === 'function') {
        loadApplications();
    }

    // Optional dedicated status element if the host page provides one.
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

    const options = {
        body,
        icon: './icon-192.png',
        badge: './icon-192.png',
        tag: `reservation-${application?.id || getSavedApplicationId()}`,
        renotify: true,
        data: { application_id: application?.id || getSavedApplicationId(), status }
    };

    // Use the service worker when available so the notification is handled
    // consistently for an installed PWA/background tab. Fall back to the
    // normal Web Notification API if the worker is not ready.
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

    try {
        new Notification(title, options);
    } catch (error) {
        console.warn('Browser notification failed:', error);
    }
}

function stopGuestApplicationRealtime() {
    const client = typeof getSupabase === 'function' ? getSupabase() : null;
    if (client && myApplicationRealtimeChannel) {
        client.removeChannel(myApplicationRealtimeChannel);
    }
    myApplicationRealtimeChannel = null;
}

async function startGuestApplicationRealtime(savedAppId) {
    const client = typeof getSupabase === 'function' ? getSupabase() : null;
    if (!client || !savedAppId || !areGuestNotificationsEnabled()) return;

    stopGuestApplicationRealtime();

    try {
        // Load the current row once. This prevents a stale local status from
        // being treated as a new admin change after a page reload.
        const { data: currentApp, error: currentError } = await client
            .from('reservation_slots')
            .select('*')
            .eq('id', savedAppId)
            .maybeSingle();

        if (!currentError && currentApp) {
            myApplicationLastStatus = currentApp.status;
            updateGuestApplicationStatusUI(currentApp.status, currentApp);
        }

        myApplicationRealtimeChannel = client
            .channel(`guest_application_${savedAppId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'reservation_slots',
                    filter: `id=eq.${savedAppId}`
                },
                async (payload) => {
                    const oldStatus = payload.old?.status;
                    const newStatus = payload.new?.status;

                    updateGuestApplicationStatusUI(newStatus, payload.new);

                    if (oldStatus !== newStatus && ['accepted', 'approved', 'rejected'].includes(String(newStatus || '').toLowerCase())) {
                        await showGuestStatusNotification(newStatus, payload.new);
                    }

                    myApplicationLastStatus = newStatus;
                }
            )
            .subscribe((status) => {
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.warn('Guest application realtime channel:', status);
                }
            });
    } catch (error) {
        console.error('Failed to start guest application realtime:', error);
    }
}

async function enableGuestApplicationNotifications() {
    const permissionGranted = await requestGuestNotificationPermission();
    if (!permissionGranted) {
        setGuestNotificationPreference(false);
        return false;
    }

    setGuestNotificationPreference(true);
    const savedAppId = getSavedApplicationId();
    if (savedAppId) await startGuestApplicationRealtime(savedAppId);
    return true;
}

function disableGuestApplicationNotifications() {
    setGuestNotificationPreference(false);
    stopGuestApplicationRealtime();
}

// Called after a successful guest submission.
async function setupGuestNotificationsAfterSubmission(applicationId, enabled) {
    if (!applicationId) return;

    localStorage.setItem(MY_APPLICATION_ID_KEY, String(applicationId));

    if (!enabled) {
        disableGuestApplicationNotifications();
        return;
    }

    const permissionGranted = await requestGuestNotificationPermission();
    if (!permissionGranted) {
        setGuestNotificationPreference(false);
        return;
    }

    setGuestNotificationPreference(true);
    await startGuestApplicationRealtime(String(applicationId));
}

// Restore the listener when a guest returns to the page/PWA later.
document.addEventListener('DOMContentLoaded', () => {
    const savedAppId = getSavedApplicationId();
    if (savedAppId && areGuestNotificationsEnabled()) {
        startGuestApplicationRealtime(savedAppId);
    }
});

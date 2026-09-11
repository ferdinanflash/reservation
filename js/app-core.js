// ================= CORE =================
// Global state, position config, startup (DOMContentLoaded), realtime
// subscriptions, reservation open/close, and shared UI helpers (toast,
// confirm dialog, busy buttons).
// Part of the app script, split out of the old single script.js.
// Load order matters: see the <script> tags in index.html.

// ================= SHARED CODE LIVES IN common.js =================
// Supabase credentials, the President-login rules (STAFF_EMAIL_DOMAIN,
// ALLOWED_ADMIN_USERNAMES, usernameToStaffEmail, staffEmailToUsername,
// isPresidentUsername), escapeHtml, sanitizeCsvField, getSupabase, and
// copyToClipboard are all defined once in common.js and shared with
// script.js. Make sure this page's HTML loads common.js BEFORE this file.

let isAdmin = false;
let currentStaffUsername = null;
let savedApplications = [];
let currentPosition = 'Vice President D1';
let selectedTimeSlot = ''; 
let isReservationOpen = true; 
let isLoadingApplications = false;
let currentWaitingModalTime = null;
let currentReassignModalTime = null;
let currentHowToUseNotes = '';
let howToUseNotesLoaded = false;

// ================= ADDITIONAL PREFERRED TIME SLOT (Apply Form) =================
// Up to MAX_ADDITIONAL_TIME_SLOTS extra dropdowns an applicant can fill in
// case their main selectedTimeSlot ends up unavailable. additionalTimeSlotSeq
// is a monotonic id generator for DOM row ids (never reused, even after a
// row is removed) so remove/add never collides on the same element id.
const MAX_ADDITIONAL_TIME_SLOTS = 3;
let additionalTimeSlotSeq = 0;

// ================= CENTRALIZED POSITION CONFIG =================
// One source of truth for each position's short label & which fields are
// hidden on the apply form, so a new position doesn't require edits in
// several places.
const POSITION_CONFIG = {
    'Vice President D1': { shortLabel: 'VP D1', hiddenFields: ['res', 'train', 'shard'] },
    'Vice President D2': { shortLabel: 'VP D2', hiddenFields: ['fc', 'rfc', 'const', 'train'] },
    'Minister of Education D4': { shortLabel: 'Edu D4', hiddenFields: ['fc', 'rfc', 'const', 'res', 'shard'] },
    'Vice President D5': { shortLabel: 'VP D5', hiddenFields: ['train', 'shard'] }
};

function getPositionConfig(positionName) {
    return POSITION_CONFIG[positionName] || { shortLabel: positionName, hiddenFields: [] };
}

document.addEventListener("DOMContentLoaded", async () => {
    const client = getSupabase();
    if (client) {
        // Restore session from Supabase's own encrypted storage instead of
        // trusting a plain sessionStorage flag anyone could set by hand.
        const { data: { session } } = await client.auth.getSession();
        applyAuthSession(session);

        // Keep isAdmin in sync if the session refreshes, expires, or the
        // user signs in/out in another tab (or on troops.js, since it's the
        // same Supabase project/account).
        client.auth.onAuthStateChange((_event, session) => {
            applyAuthSession(session);
        });
    }

    loadFooterInfo();
    checkReservationStatus(); 
    startLiveClock();
    loadRecentAccepts();
    subscribeToRealtimeUpdates();

    const loginPasswordInput = document.getElementById('input-login-password');
    if (loginPasswordInput) {
        loginPasswordInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submitStaffLogin();
        });
    }

    // Long-interval fallback polling only (in case the realtime connection
    // drops), since primary updates are now pushed via Supabase Realtime.
    setInterval(() => {
        loadRecentAccepts();
        loadFooterInfo(); 
    }, 60000);
});

// Applies (or clears) admin UI/state from a Supabase Auth session. This is
// the single source of truth for isAdmin now — never set it directly.
// A session belonging to any staff account NOT in ALLOWED_ADMIN_USERNAMES
// (e.g. one restored from a troops.js login) is deliberately treated as
// "not admin" here — it's a valid session, just not authorized on this page.
function applyAuthSession(session) {
    const sessionUsername = session ? staffEmailToUsername(session.user.email) : null;
    isAdmin = isPresidentUsername(sessionUsername);
    currentStaffUsername = isAdmin ? sessionUsername : null;
    if (isAdmin) {
        updateAdminUI();
    } else {
        resetAdminUI();
    }
    loadApplications();
}

// ================= REALTIME SUBSCRIPTIONS =================
// Replaces 30-second polling with instant updates as soon as the
// database changes (new submission, accept, delete, etc.).
function subscribeToRealtimeUpdates() {
    const client = getSupabase();
    if (!client) return;

    try {
        client
            .channel('reservation_slots_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'reservation_slots' }, (payload) => {
                const affectedPosition = payload.new?.position || payload.old?.position;
                if (affectedPosition === currentPosition) {
                    loadApplications();
                }
                loadRecentAccepts();
            })
            .subscribe();

        client
            .channel('footer_settings_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'footer_settings' }, () => {
                loadFooterInfo();
            })
            .subscribe();

        client
            .channel('how_to_use_notes_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'how_to_use_notes' }, (payload) => {
                const affectedPosition = payload.new?.position || payload.old?.position;
                if (affectedPosition === currentPosition) {
                    howToUseNotesLoaded = false;
                    if (document.getElementById('how-to-use-modal') && !document.getElementById('how-to-use-modal').classList.contains('hidden')) {
                        loadHowToUseNotes(true);
                    }
                }
            })
            .subscribe();
    } catch (err) {
        console.error("Realtime subscription failed, relying on fallback polling:", err);
    }
}

function updateAdminUI() {
    const adminBtn = document.getElementById('admin-toggle-btn');
    const adminInd = document.getElementById('admin-indicator');
    const editFooterBtn = document.getElementById('edit-footer-btn');
    const toggleResBtn = document.getElementById('toggle-reservation-btn'); 
    const finishSvsBtn = document.getElementById('finish-svs-btn'); 

    if (adminBtn) adminBtn.innerText = currentStaffUsername ? t("admin_logout_named", { name: currentStaffUsername.toUpperCase() }) : t("admin_logout_btn");
    if (adminInd) adminInd.style.display = "inline";
    if (editFooterBtn) editFooterBtn.style.display = "inline-block";
    if (toggleResBtn) toggleResBtn.style.display = "inline-block"; 
    if (finishSvsBtn) finishSvsBtn.style.display = "inline-block"; 
}

function resetAdminUI() {
    const adminBtn = document.getElementById('admin-toggle-btn');
    const adminInd = document.getElementById('admin-indicator');
    const editFooterBtn = document.getElementById('edit-footer-btn');
    const toggleResBtn = document.getElementById('toggle-reservation-btn');
    const finishSvsBtn = document.getElementById('finish-svs-btn');

    if (adminBtn) adminBtn.innerText = t("admin_login_btn");
    if (adminInd) adminInd.style.display = "none";
    if (editFooterBtn) editFooterBtn.style.display = "none";
    if (toggleResBtn) toggleResBtn.style.display = "none";
    if (finishSvsBtn) finishSvsBtn.style.display = "none";
}

async function checkReservationStatus() {
    const client = getSupabase();
    if (!client) return;
    try {
        const { data, error } = await client
            .from('system_settings')
            .select('is_open')
            .eq('id', currentPosition)
            .single();
        
        if (data) {
            isReservationOpen = data.is_open;
        } else {
            isReservationOpen = true; 
        }
        updateReservationButtonUI();
    } catch (err) {
        console.error("Error checking status:", err);
    }
}

function updateReservationButtonUI() {
    const toggleBtn = document.getElementById('toggle-reservation-btn');
    if (!toggleBtn) return;

    if (isReservationOpen) {
        toggleBtn.innerText = t("btn_close_reservation");
        toggleBtn.style.background = "#dc2626"; 
    } else {
        toggleBtn.innerText = t("btn_open_reservation");
        toggleBtn.style.background = "#22c55e"; 
    }
}

async function handleToggleReservation() {
    if (!isAdmin) return;

    const newStatus = !isReservationOpen;
    const actionText = newStatus ? "open" : "close";

    // Uses the existing custom confirm modal for visual consistency
    // (previously used the browser's built-in confirm()).
    showCustomConfirm(`Are you sure to ${actionText} reservation for ${currentPosition}?`, async () => {
        const client = getSupabase();
        if (!client) return;

        const toggleBtn = document.getElementById('toggle-reservation-btn');
        setButtonBusy(toggleBtn, true, actionText === 'open' ? 'Opening...' : 'Closing...');

        try {
            const { error } = await client
                .from('system_settings')
                .update({ is_open: newStatus })
                .eq('id', currentPosition);

            if (error) throw error;

            isReservationOpen = newStatus;
            showToast(t("toast_reservation_now", { position: translatePositionName(currentPosition), status: newStatus ? t("status_word_open") : t("status_word_close") }), "success");
        } catch (err) {
            console.error("Failed to update reservation status:", err);
            showToast(t("toast_update_reservation_failed"), "error");
        } finally {
            setButtonBusy(toggleBtn, false);
            updateReservationButtonUI();
        }
    }, newStatus ? '#22c55e' : '#dc2626');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerText = message;

    if (type === 'success') toast.style.borderLeftColor = '#22c55e';
    if (type === 'error') toast.style.borderLeftColor = '#ef4444';
    if (type === 'warning') toast.style.borderLeftColor = '#f59e0b';

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ================= CROSS-DEVICE REASON MODAL =================
// Avoids window.prompt(), whose behavior can be inconsistent in Chrome/PWA
// on some Android devices (including Samsung). This HTML modal is controlled
// entirely by the page, so it works consistently across Android/iOS/PWA.
function showReasonModal(label, defaultValue = '') {
    return new Promise((resolve) => {
        const modal = document.getElementById('reason-modal');
        const titleEl = document.getElementById('reason-modal-title');
        const labelEl = document.getElementById('reason-modal-label');
        const input = document.getElementById('reason-modal-input');
        const okBtn = document.getElementById('reason-modal-ok-btn');
        const cancelBtn = document.getElementById('reason-modal-cancel-btn');
        if (!modal || !input || !okBtn || !cancelBtn) {
            resolve('');
            return;
        }

        if (titleEl) titleEl.innerText = t('reason_modal_title');
        if (labelEl) labelEl.innerText = label || t('reason_modal_label');
        input.value = defaultValue || '';
        input.placeholder = t('reason_modal_placeholder');
        modal.classList.remove('hidden');

        let settled = false;
        const finish = (value) => {
            if (settled) return;
            settled = true;
            modal.classList.add('hidden');
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
            modal.removeEventListener('click', onBackdrop);
            input.removeEventListener('keydown', onKeyDown);
            resolve(String(value || '').trim());
        };
        const onOk = () => finish(input.value);
        const onCancel = () => finish('');
        const onBackdrop = (event) => {
            if (event.target === modal) onCancel();
        };
        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onCancel();
            }
        };

        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);
        modal.addEventListener('click', onBackdrop);
        input.addEventListener('keydown', onKeyDown);

        // Focus after the modal is painted so mobile browsers reliably open
        // the keyboard when the dialog is triggered by a user action.
        setTimeout(() => {
            try {
                input.focus();
                input.setSelectionRange(input.value.length, input.value.length);
            } catch (_) {}
        }, 50);
    });
}

function showCustomConfirm(message, onConfirm, buttonColor = '#ef4444') {
    const modal = document.getElementById('confirm-modal');
    const msgEl = document.getElementById('confirm-message');
    const okBtn = document.getElementById('confirm-ok-btn');
    const cancelBtn = document.getElementById('confirm-cancel-btn');

    msgEl.innerText = message;
    okBtn.style.background = buttonColor;
    modal.classList.remove('hidden');

    const newOkBtn = okBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    newOkBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
        onConfirm();
    });

    newCancelBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });
}

// Helper to disable a button + show a spinner while an async process is
// running, so the user can't double-click (prevents duplicate submits/actions).
function setButtonBusy(button, isBusy, busyText = null) {
    if (!button) return;
    if (isBusy) {
        button.dataset.originalText = button.innerHTML;
        button.disabled = true;
        button.innerHTML = `<span class="spinner-inline"></span>${busyText || t('please_wait')}`;
    } else {
        button.disabled = false;
        if (button.dataset.originalText) {
            button.innerHTML = button.dataset.originalText;
            delete button.dataset.originalText;
        }
    }
}


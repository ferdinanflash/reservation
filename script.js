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

// ================= CENTRALIZED POSITION CONFIG =================
// One source of truth for each position's short label & which fields are
// hidden on the apply form, so a new position doesn't require edits in
// several places.
const POSITION_CONFIG = {
    'Vice President D1': { shortLabel: 'VP D1', hiddenFields: ['res', 'train'] },
    'Vice President D2': { shortLabel: 'VP D2', hiddenFields: ['fc', 'rfc', 'const', 'train'] },
    'Minister of Education D4': { shortLabel: 'Edu D4', hiddenFields: ['fc', 'rfc', 'const', 'res'] },
    'Vice President D5': { shortLabel: 'VP D5', hiddenFields: ['train'] }
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

    if (adminBtn) adminBtn.innerText = currentStaffUsername ? `Logout (${currentStaffUsername.toUpperCase()})` : t("admin_logout_btn");
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

async function loadFooterInfo() {
    const cachedPresident = localStorage.getItem('cached_president_name');
    const cachedGuild = localStorage.getItem('cached_guild_name');
    
    if (cachedPresident) {
        const elPres = document.getElementById('display-president-name');
        if (elPres) elPres.innerText = cachedPresident;
    }
    if (cachedGuild) {
        const elGuild = document.getElementById('display-guild-name');
        if (elGuild) elGuild.innerText = cachedGuild;
    }

    const client = getSupabase();
    if (!client) return;
    try {
        const { data, error } = await client
            .from('footer_settings')
            .select('president_name, guild_name')
            .eq('id', 'main')
            .single();
        
        if (data) {
            if (data.president_name) {
                const elPres = document.getElementById('display-president-name');
                if (elPres) elPres.innerText = data.president_name;
                localStorage.setItem('cached_president_name', data.president_name);
            }
            if (data.guild_name) {
                const elGuild = document.getElementById('display-guild-name');
                if (elGuild) elGuild.innerText = data.guild_name;
                localStorage.setItem('cached_guild_name', data.guild_name);
            }
        }
    } catch (err) {
        console.error("Error loading footer info from database:", err);
    }
}

// Opens the custom modal for editing president/guild info (replacing
// two calls to the browser's built-in prompt(), which looked inconsistent).
function handleEditFooter() {
    if (!isAdmin) return;
    const currentName = document.getElementById('display-president-name').innerText;
    const currentGuild = document.getElementById('display-guild-name').innerText;

    document.getElementById('edit-footer-name').value = currentName === '...' ? '' : currentName;
    document.getElementById('edit-footer-guild').value = currentGuild === '...' ? '' : currentGuild;
    document.getElementById('edit-footer-modal').classList.remove('hidden');
}

function closeEditFooterModal() {
    document.getElementById('edit-footer-modal').classList.add('hidden');
}

async function saveEditFooter() {
    if (!isAdmin) return;

    const newName = document.getElementById('edit-footer-name').value.trim();
    const newGuild = document.getElementById('edit-footer-guild').value.trim();

    if (newName === "" || newGuild === "") {
        showToast(t("toast_name_guild_empty"), "warning");
        return;
    }

    const client = getSupabase();
    if (!client) return;

    const saveBtn = document.getElementById('edit-footer-save-btn');
    setButtonBusy(saveBtn, true, 'Saving...');

    try {
        const { error } = await client
            .from('footer_settings')
            .update({
                president_name: newName,
                guild_name: newGuild,
                updated_at: new Date().toISOString()
            })
            .eq('id', 'main');

        if (error) throw error;

        localStorage.setItem('cached_president_name', newName);
        localStorage.setItem('cached_guild_name', newGuild);
        loadFooterInfo();
        showToast(t("toast_president_updated"), "success");
        closeEditFooterModal();
    } catch (err) {
        console.error("Failed to update footer info:", err);
        const detail = err?.message || err?.error_description || JSON.stringify(err);
        showToast(t("toast_update_db_failed", { detail: detail }), "error");
    } finally {
        setButtonBusy(saveBtn, false);
    }
}

// ================= PRESIDENT LOGIN (Supabase Auth) =================
// Real authentication now happens on Supabase's servers via
// auth.signInWithPassword, which returns a verified session token. Access to
// write endpoints (reservation_slots, footer_settings, system_settings) must
// be enforced with Row Level Security policies tied to
// auth.role() = 'authenticated' — this client-side isAdmin flag is only used
// to show/hide UI, never to authorize writes.
function handleAdminLogin() {
    if (isAdmin) {
        handleStaffLogout();
        return;
    }
    document.getElementById('input-login-username').value = '';
    document.getElementById('input-login-password').value = '';
    document.getElementById('login-modal').classList.remove('hidden');
    document.getElementById('input-login-username').focus();
}

function closeLoginModal() {
    document.getElementById('login-modal').classList.add('hidden');
}

async function submitStaffLogin() {
    const client = getSupabase();
    if (!client) return;

    const username = document.getElementById('input-login-username').value.trim();
    const password = document.getElementById('input-login-password').value;

    if (!username || !password) {
        showToast(t("toast_enter_both"), "warning");
        return;
    }

    // This page is President-only — don't even attempt a sign-in for any
    // other staff username (idn/arx/vnx/zxc/cat/tal/etc.), so a valid staff
    // password never accidentally opens a real session here.
    if (!isPresidentUsername(username)) {
        showToast(t("toast_president_only"), "error");
        return;
    }

    const submitBtn = document.getElementById('login-submit-btn');
    setButtonBusy(submitBtn, true, 'Signing in...');

    const { data, error } = await client.auth.signInWithPassword({
        email: usernameToStaffEmail(username),
        password
    });

    setButtonBusy(submitBtn, false);

    if (error) {
        showToast(t("toast_login_failed"), "error");
        return;
    }

    applyAuthSession(data.session);
    closeLoginModal();
    showToast(t("toast_welcome_back"), "success");
}

async function handleStaffLogout() {
    const client = getSupabase();
    if (client) {
        await client.auth.signOut();
    }
    applyAuthSession(null);
    showToast(t("toast_logged_out"), "info");
}

function showSchedule(positionName) {
    currentPosition = positionName;
    document.getElementById('positions-page').classList.add('hidden');
    document.getElementById('schedule-page').classList.remove('hidden');
    document.getElementById('selected-title').innerText = translatePositionName(positionName);
    detectAndSetTimezone();
    
    checkReservationStatus().then(() => {
        loadApplications();
    });
}

function detectAndSetTimezone() {
    const selector = document.getElementById('timezone');
    if (!selector) return;
    selector.innerHTML = "";

    const tzLabels = {
        "-12": "Kwajalein", "-11": "Midway Island", "-10": "Hawaii", "-9": "Alaska", 
        "-8": "Pacific Time", "-7": "Mountain Time", "-6": "Central Time", 
        "-5": "Eastern Time", "-4": "Atlantic Time", "-3.5": "Newfoundland", 
        "-3": "Buenos Aires", "-2": "Mid-Atlantic", "-1": "Azores", 
        "0": "GMT / UTC", "1": "Berlin, Paris", "2": "Cairo, Johannesburg", 
        "3": "Moscow, Nairobi", "3.5": "Tehran", "4": "Dubai", 
        "4.5": "Kabul", "5": "Karachi", "5.5": "New Delhi", 
        "5.75": "Kathmandu", "6": "Dhaka", "6.5": "Yangon", 
        "7": "Jakarta, WIB", "8": "Singapore, WITA", "9": "Tokyo, WIT", 
        "9.5": "Darwin", "10": "Sydney", "10.5": "Lord Howe",
        "11": "Solomon Is.", "11.5": "Norfolk Is.", "12": "Auckland, Fiji", 
        "12.75": "Chatham Is.", "13": "Tonga", "14": "Kiritimati"
    };

    const offsets = [
        -12, -11, -10, -9, -8, -7, -6, -5, -4, -3.5, -3, -2, -1, 0, 
        1, 2, 3, 3.5, 4, 4.5, 5, 5.5, 5.75, 6, 6.5, 7, 8, 9, 9.5, 10, 10.5, 11, 11.5, 12, 12.75, 13, 14
    ];

    const userOffsetMinutes = new Date().getTimezoneOffset();
    const userOffsetHours = parseFloat((-(userOffsetMinutes / 60)).toFixed(2));
    let exactMatchFound = false;

    offsets.forEach(offset => {
        const option = document.createElement('option');
        option.value = offset;
        const sign = offset >= 0 ? "+" : "-";
        const absOffset = Math.abs(offset);
        const hours = Math.floor(absOffset);
        const minutes = Math.round((absOffset % 1) * 60);
        const timeString = `UTC ${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        const label = tzLabels[String(offset)] ? ` (${tzLabels[String(offset)]})` : "";
        option.text = `${timeString}${label}`;

        if (Math.abs(offset - userOffsetHours) < 0.1) {
            option.selected = true;
            exactMatchFound = true;
        }
        selector.add(option);
    });

    if (!exactMatchFound) {
        const sign = userOffsetHours >= 0 ? "+" : "-";
        const absOffset = Math.abs(userOffsetHours);
        const hours = Math.floor(absOffset);
        const minutes = Math.round((absOffset % 1) * 60);
        const customOption = document.createElement('option');
        customOption.value = userOffsetHours;
        customOption.text = `UTC ${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} (Your Location)`;
        customOption.selected = true;
        selector.insertBefore(customOption, selector.firstChild);
    }
}

function showPositions() {
    document.getElementById('schedule-page').classList.add('hidden');
    document.getElementById('positions-page').classList.remove('hidden');
}

async function loadApplications() {
    const client = getSupabase();
    if (!client) return;

    isLoadingApplications = true;
    renderLoadingState();

    try {
        const { data, error } = await client.from('reservation_slots').select('*').eq('position', currentPosition);
        if (error) throw error;
        savedApplications = data || [];
    } catch (e) {
        console.error("Database failure:", e);
        savedApplications = [];
        showToast(t("toast_load_schedule_failed"), "error");
    }
    isLoadingApplications = false;
    renderTimeSlots();
}

// Placeholder row while data is still being fetched from Supabase, so the
// table doesn't look empty or flicker before the data appears.
function renderLoadingState() {
    const tbody = document.getElementById('schedule-table-body');
    if (!tbody) return;
    tbody.innerHTML = `<tr class="loading-row"><td colspan="6"><span class="spinner-inline"></span>${t("loading_schedule")}</td></tr>`;
}

function renderTimeSlots() {
    const tbody = document.getElementById('schedule-table-body');
    if (!tbody) return;
    if (isLoadingApplications) return;
    const offset = parseFloat(document.getElementById('timezone').value);
    tbody.innerHTML = "";

    for (let i = 0; i < 48; i++) {
        let totalMinutes = i * 30;
        let utcH = Math.floor(totalMinutes / 60);
        let utcM = totalMinutes % 60;
        let utcTimeStr = `${String(utcH).padStart(2, '0')}:${String(utcM).padStart(2, '0')}`;

        let totalLocalMinutes = totalMinutes + Math.round(offset * 60);
        let localH = Math.floor(totalLocalMinutes / 60) % 24;
        if (localH < 0) localH += 24;
        let localM = totalLocalMinutes % 60;
        if (localM < 0) localM += 60;
        let localTimeStr = `${String(localH).padStart(2, '0')}:${String(localM).padStart(2, '0')}`;

        let appsInSlot = savedApplications.filter(a => String(a.time_slot).trim() === utcTimeStr);
        let acceptedApp = appsInSlot.find(a => a.status === 'Accepted');
        let countWaiting = appsInSlot.filter(a => a.status === 'Waiting').length;

        const row = document.createElement('tr');
        if (acceptedApp) {
            let detailBtn = `<span class="icon-tap-target" style="cursor:pointer; font-size: 1rem; vertical-align: middle;" title="${t("title_view_details")}" onclick="openDetailsModal(${acceptedApp.id})">🔍</span>`;
            let actionBtn = isAdmin
                ? `<div style="display:flex; align-items:center; justify-content:center; gap:6px;">
                     ${detailBtn}
                     <button class="btn-apply btn-danger btn-compact" style="padding: 4px 8px; font-size: 0.75rem;" onclick="removeApp(${acceptedApp.id})">${t("btn_remove")}</button>
                   </div>`
                : detailBtn;

            // Other applicants who were still "Waiting" in this slot are NOT
            // removed just because one got accepted — surface them here so
            // the President can always come back and move them later, not
            // only right after clicking Accept.
            let leftoverCount = appsInSlot.filter(a => a.status === 'Waiting').length;
            let leftoverBadge = (isAdmin && leftoverCount > 0)
                ? `<br><span style="color:#f59e0b; font-size:0.75rem; cursor:pointer; text-decoration:underline;" onclick="openReassignModal('${utcTimeStr}')">${t("move_waiting_count", { count: leftoverCount })}</span>`
                : '';

            row.innerHTML = `
                <td>${actionBtn}</td>
                <td><strong>${utcTimeStr} UTC</strong><br><small style="color:#8a8d98;">Local: ${localTimeStr}</small></td>
                <td><span style="color:#22c55e; font-weight:bold;">Accepted</span>${leftoverBadge}</td>
                <td>${escapeHtml(acceptedApp.nickname)}</td>
                <td><span style="cursor:pointer; color:#3b82f6; text-decoration:underline;" onclick="copyToClipboard('${escapeHtml(acceptedApp.game_id)}')">${escapeHtml(acceptedApp.game_id)}</span></td>
                <td>${escapeHtml(acceptedApp.furnace_level) || '-'}</td>
            `;
        } else {
            let actionBtn = `<button class="btn-apply" onclick="applySlot('${utcTimeStr}')">Apply</button>`;
            let statusText = '<span class="no-apps">No Applications</span>';
            if (countWaiting > 0) {
                statusText = `<span style="color:#f59e0b; font-weight:bold; cursor:pointer; text-decoration:underline;" onclick="openWaitingModal('${utcTimeStr}')">${t("status_waiting_count", { count: countWaiting })}</span>`;
            }
            row.innerHTML = `
                <td>${actionBtn}</td>
                <td><strong>${utcTimeStr} UTC</strong><br><small style="color:#8a8d98;">Local: ${localTimeStr}</small></td>
                <td>${statusText}</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
            `;
        }
        tbody.appendChild(row);
    }
}

// ================= SHARED DETAIL BLOCK BUILDER =================
// Shared by openDetailsModal() and openWaitingModal() so the stat detail
// markup isn't duplicated in two different places.
function buildStatDetailsHtml(app, compact = false) {
    if (compact) {
        return `
            <div><span style="color:#8a8d98; margin-right: 10px;">Furnace Lvl:</span> <strong style="color:#f1f5f9;">${escapeHtml(app.furnace_level) || '-'}</strong></div>
            <div><span style="color:#8a8d98; margin-right: 10px;">FC:</span> <strong style="color:#f59e0b;">${escapeHtml(app.fire_crystal) || '0'}</strong></div>
            <div><span style="color:#8a8d98; margin-right: 10px;">RFC:</span> <strong style="color:#f59e0b;">${escapeHtml(app.refined_fire_crystal) || '0'}</strong></div>
            <div><span style="color:#8a8d98; margin-right: 10px;">General:</span> <strong style="color:#f1f5f9;">${escapeHtml(app.general_speedup) || '0'}</strong></div>
            <div><span style="color:#8a8d98; margin-right: 10px;">Const:</span> <strong style="color:#f1f5f9;">${escapeHtml(app.construction_speedup) || '0'}</strong></div>
            <div><span style="color:#8a8d98; margin-right: 10px;">Research:</span> <strong style="color:#f1f5f9;">${escapeHtml(app.research_speedup) || '0'}</strong></div>
            <div><span style="color:#8a8d98; margin-right: 10px;">Train:</span> <strong style="color:#f1f5f9;">${escapeHtml(app.training_speedup) || '0'}</strong></div>
        `;
    }

    return `
        <div><span style="color:#8a8d98;">Nickname:</span> <strong style="color:#f1f5f9;">${escapeHtml(app.nickname) || '-'}</strong></div>
        <div><span style="color:#8a8d98;">Game ID:</span> <strong style="color:#3b82f6;">${escapeHtml(app.game_id) || '-'}</strong></div>
        <div><span style="color:#8a8d98;">Furnace Level:</span> <strong style="color:#f1f5f9;">${escapeHtml(app.furnace_level) || '-'}</strong></div>
        <hr style="border: 0; border-top: 1px solid #334155; margin: 4px 0;">
        <div><span style="color:#8a8d98;">Fire Crystals (FC):</span> <strong style="color:#f59e0b;">${escapeHtml(app.fire_crystal) || '0'}</strong></div>
        <div><span style="color:#8a8d98;">Refined Fire Crystals (RFC):</span> <strong style="color:#f59e0b;">${escapeHtml(app.refined_fire_crystal) || '0'}</strong></div>
        <div><span style="color:#8a8d98;">General Speedup:</span> <strong style="color:#f1f5f9;">${escapeHtml(app.general_speedup) || '0'} Days</strong></div>
        <div><span style="color:#8a8d98;">Construction Speedup:</span> <strong style="color:#f1f5f9;">${escapeHtml(app.construction_speedup) || '0'} Days</strong></div>
        <div><span style="color:#8a8d98;">Research Speedup:</span> <strong style="color:#f1f5f9;">${escapeHtml(app.research_speedup) || '0'} Days</strong></div>
        <div><span style="color:#8a8d98;">Training Speedup:</span> <strong style="color:#f1f5f9;">${escapeHtml(app.training_speedup) || '0'} Days</strong></div>
    `;
}

// Function to open the detail popup modal
function openDetailsModal(appId) {
    const app = savedApplications.find(a => a.id === appId);
    if (!app) return;

    const modal = document.getElementById('details-modal');
    const contentEl = document.getElementById('details-content');
    contentEl.innerHTML = buildStatDetailsHtml(app, false);
    
    modal.classList.remove('hidden');
}

function closeDetailsModal() {
    document.getElementById('details-modal').classList.add('hidden');
}

function openWaitingModal(timeStr) {
    const modal = document.getElementById('waiting-modal');
    if (!modal) return;
    
    document.getElementById('modal-title').innerText = t("waiting_list_title", { time: timeStr });
    const modalTbody = document.getElementById('modal-table-body');
    modalTbody.innerHTML = "";

    const thead = modal.querySelector('thead tr');
    thead.innerHTML = `
        <th style="padding: 5px 10px; text-align: left;">NICKNAME</th>
        <th style="padding: 5px 10px; text-align: left;">ID</th>
    `;

    let appsInSlot = savedApplications.filter(a => String(a.time_slot).trim() === timeStr && a.status === 'Waiting');

    appsInSlot.forEach(app => {
        const mainRow = document.createElement('tr');
        let adminButtons = isAdmin ? `
            <div style="margin-top: 4px;">
                <button class="btn-apply btn-compact" style="background:#22c55e; font-size:0.7rem; margin-right:4px; animation: none;" onclick="acceptApp(${app.id})">${t("btn_accept")}</button>
                <button class="btn-apply btn-danger btn-compact" style="font-size:0.7rem;" onclick="removeApp(${app.id})">${t("btn_drop")}</button>
            </div>
        ` : '';

        mainRow.innerHTML = `
            <td style="padding: 5px 10px; text-align: left; font-weight: 500; white-space: nowrap;">
                <span class="icon-tap-target" style="cursor:pointer; margin-right: 6px;" onclick="toggleDetails(${app.id})">🔍</span>${escapeHtml(app.nickname)}
            </td>
            <td style="padding: 5px 10px; text-align: left; white-space: nowrap;">
                <span style="cursor:pointer; color:#3b82f6; text-decoration:underline;" onclick="copyToClipboard('${escapeHtml(app.game_id)}')">${escapeHtml(app.game_id)}</span>
                ${adminButtons}
            </td>
        `;
        modalTbody.appendChild(mainRow);

        const detailsRow = document.createElement('tr');
        detailsRow.id = `details-${app.id}`;
        detailsRow.style.display = 'none'; 
        detailsRow.innerHTML = `
            <td colspan="2" style="padding: 0; border: none;">
                <div style="background: #151821; padding: 8px; margin: 2px 5px; border-radius: 4px; font-size: 0.8rem; text-align: left; border: 1px solid #334155;">
                    ${buildStatDetailsHtml(app, true)}
                </div>
            </td>
        `;
        modalTbody.appendChild(detailsRow);
    });
    
    modal.classList.remove('hidden');
}

function toggleDetails(id) {
    const detailsRow = document.getElementById(`details-${id}`);
    if (detailsRow) {
        detailsRow.style.display = detailsRow.style.display === 'none' ? 'table-row' : 'none';
    }
}

function closeModal() {
    document.getElementById('waiting-modal').classList.add('hidden');
}

function applySlot(time) {
    if (!isReservationOpen) {
        showToast(t("toast_reservation_locked"), "error");
        return; 
    }

    selectedTimeSlot = time;
    document.getElementById('form-position-title').innerText = currentPosition;
    document.getElementById('form-time-title').innerText = time + " UTC";
    
    document.getElementById('input-nickname').value = "";
    document.getElementById('input-gameid').value = "";
    document.getElementById('input-furnace').value = "";
    document.getElementById('input-fc').value = "";
    document.getElementById('input-rfc').value = "";
    document.getElementById('input-gensp').value = "";
    document.getElementById('input-constsp').value = "";
    document.getElementById('input-ressp').value = "";
    document.getElementById('input-trainsp').value = "";

    const fieldGroups = {
        fc: document.getElementById('input-fc').closest('.form-group'),
        rfc: document.getElementById('input-rfc').closest('.form-group'),
        const: document.getElementById('input-constsp').closest('.form-group'),
        res: document.getElementById('input-ressp').closest('.form-group'),
        train: document.getElementById('input-trainsp').closest('.form-group')
    };

    Object.values(fieldGroups).forEach(group => group.classList.remove('hidden'));

    const { hiddenFields } = getPositionConfig(currentPosition);
    hiddenFields.forEach(fieldKey => {
        if (fieldGroups[fieldKey]) fieldGroups[fieldKey].classList.add('hidden');
    });
    
    document.getElementById('apply-modal').classList.remove('hidden');
}

function closeApplyModal() {
    document.getElementById('apply-modal').classList.add('hidden');
}

async function submitApplication() {
    if (!isReservationOpen) {
        showToast(t("toast_reservation_locked"), "error");
        return;
    }

    const client = getSupabase();
    if (!client) return;

    const nickname = document.getElementById('input-nickname').value.trim();
    const gameId = document.getElementById('input-gameid').value.trim();
    const furnaceLevel = document.getElementById('input-furnace').value.trim();
    const fc = parseInt(document.getElementById('input-fc').value.trim()) || 0;
    const rfc = parseInt(document.getElementById('input-rfc').value.trim()) || 0;
    const genSp = parseInt(document.getElementById('input-gensp').value.trim()) || 0;
    const constSp = parseInt(document.getElementById('input-constsp').value.trim()) || 0;
    const resSp = parseInt(document.getElementById('input-ressp').value.trim()) || 0;
    const trainSp = parseInt(document.getElementById('input-trainsp').value.trim()) || 0;

    if (!nickname) { showToast(t("toast_enter_nickname"), "warning"); return; }
    if (!gameId) { showToast(t("toast_enter_gameid"), "warning"); return; }
    if (!/^\d+$/.test(gameId)) { showToast(t("toast_gameid_numeric"), "warning"); return; }
    if (!furnaceLevel) { showToast(t("toast_select_furnace"), "warning"); return; }

    const submitBtn = document.querySelector('#apply-modal .btn-apply');
    setButtonBusy(submitBtn, true, 'Submitting...');

    try {
        const { error } = await client
            .from('reservation_slots')
            .insert({ 
                time_slot: selectedTimeSlot, position: currentPosition, nickname: nickname, game_id: gameId, 
                furnace_level: furnaceLevel,
                fire_crystal: fc, refined_fire_crystal: rfc, general_speedup: genSp, construction_speedup: constSp, research_speedup: resSp, training_speedup: trainSp,
                status: 'Waiting'
            });

        if (error) throw error;

        showToast(t("toast_app_submitted"), "success");
        closeApplyModal();
        loadApplications();
    } catch (err) {
        console.error("Failed to submit application:", err);
        showToast(t("toast_app_submit_failed"), "error");
    } finally {
        setButtonBusy(submitBtn, false);
    }
}

async function acceptApp(id) {
    // Grab this app's time slot BEFORE it's accepted, so we know which
    // slot's other applicants (if any) need attention afterwards.
    const targetApp = savedApplications.find(a => a.id === id);
    const targetTime = targetApp ? String(targetApp.time_slot).trim() : null;

    showCustomConfirm(t("confirm_accept_app"), async () => {
        const client = getSupabase();
        if (!client) return;
        closeModal();
        try {
            const { error } = await client.from('reservation_slots').update({ status: 'Accepted' }).eq('id', id);
            if (error) throw error;
            showToast(t("toast_app_approved"), "success");
            await loadApplications();
            loadRecentAccepts(); 

            // IMPORTANT: any other application that was still "Waiting" in
            // this same slot is NEVER deleted just because one got accepted.
            // Instead, immediately prompt the President to move each one to
            // a free slot instead of letting them sit invisible in the DB.
            if (targetTime && getLeftoverWaitingApps(targetTime).length > 0) {
                openReassignModal(targetTime);
            }
        } catch (err) {
            console.error("Failed to approve application:", err);
            showToast(t("toast_app_approve_failed"), "error");
            loadApplications();
        }
    }, '#22c55e');
}

// ================= MOVE LEFTOVER WAITING APPS TO ANOTHER SLOT =================
// Whenever a slot gets an Accepted application, any OTHER application that
// was still "Waiting" in that same slot is left completely intact in the
// database — it is never auto-deleted or auto-accepted. This section gives
// the President a way to relocate each leftover applicant to a free slot
// instead, from a dedicated modal (openReassignModal / closeReassignModal).

// All 48 half-hour UTC slots used by the schedule table, as "HH:MM" strings.
function getAllUtcSlots() {
    const slots = [];
    for (let i = 0; i < 48; i++) {
        const totalMinutes = i * 30;
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
    return slots;
}

// A slot counts as "free" for reassignment if it doesn't already have an
// Accepted application. excludeTime lets the origin slot be left out, since
// moving an applicant back to the slot they're already stuck in is pointless.
function getAvailableTimeSlots(excludeTime = null) {
    return getAllUtcSlots().filter(time => {
        if (time === excludeTime) return false;
        const hasAccepted = savedApplications.some(a => String(a.time_slot).trim() === time && a.status === 'Accepted');
        return !hasAccepted;
    });
}

function getLeftoverWaitingApps(timeStr) {
    return savedApplications.filter(a => String(a.time_slot).trim() === timeStr && a.status === 'Waiting');
}

function openReassignModal(originTime) {
    if (!isAdmin) return;
    const modal = document.getElementById('reassign-modal');
    if (!modal) return;

    const titleEl = document.getElementById('reassign-modal-title');
    if (titleEl) titleEl.innerText = t("reassign_modal_title_dyn", { time: originTime });

    renderReassignRows(originTime);
    modal.classList.remove('hidden');
}

function closeReassignModal() {
    const modal = document.getElementById('reassign-modal');
    if (modal) modal.classList.add('hidden');
}

function renderReassignRows(originTime) {
    const tbody = document.getElementById('reassign-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const leftovers = getLeftoverWaitingApps(originTime);
    if (leftovers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="padding:12px; text-align:center; color:#8a8d98;">${t("no_more_waiting")}</td></tr>`;
        return;
    }

    const availableSlots = getAvailableTimeSlots(originTime);

    leftovers.forEach(app => {
        const row = document.createElement('tr');
        const selectId = `reassign-select-${app.id}`;
        const options = availableSlots.length > 0
            ? availableSlots.map(t => `<option value="${t}">${t} UTC</option>`).join('')
            : `<option value="">No free slots</option>`;

        row.innerHTML = `
            <td style="padding: 5px 10px; text-align: left; white-space: nowrap;">${escapeHtml(app.nickname)}</td>
            <td style="padding: 5px 10px; text-align: left; white-space: nowrap;">
                <span style="cursor:pointer; color:#3b82f6; text-decoration:underline;" onclick="copyToClipboard('${escapeHtml(app.game_id)}')">${escapeHtml(app.game_id)}</span>
            </td>
            <td style="padding: 5px 10px; text-align: left;">
                <select id="${selectId}" style="max-width: 140px;" ${availableSlots.length === 0 ? 'disabled' : ''}>${options}</select>
            </td>
            <td style="padding: 5px 10px; text-align: left; white-space: nowrap;">
                <button class="btn-apply btn-compact" style="font-size:0.7rem;" ${availableSlots.length === 0 ? 'disabled' : ''} onclick="moveAppToSlot(${app.id}, document.getElementById('${selectId}').value, '${originTime}')">${t("btn_move")}</button>
                <button class="btn-apply btn-danger btn-compact" style="font-size:0.7rem;" onclick="removeApp(${app.id})">${t("btn_drop")}</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Relocates one leftover applicant to a different (still free) slot. Status
// stays "Waiting" — this only moves them, it never deletes or auto-accepts.
async function moveAppToSlot(id, newTimeSlot, originTime) {
    if (!isAdmin) return;
    if (!newTimeSlot) {
        showToast(t("toast_no_slot_selected"), "warning");
        return;
    }

    const client = getSupabase();
    if (!client) return;

    try {
        const { error } = await client
            .from('reservation_slots')
            .update({ time_slot: newTimeSlot })
            .eq('id', id);
        if (error) throw error;
        showToast(t("toast_applicant_moved", { time: newTimeSlot }), "success");
        await loadApplications();
        renderReassignRows(originTime);
    } catch (err) {
        console.error("Failed to move application:", err);
        showToast(t("toast_move_failed"), "error");
    }
}

async function removeApp(id) {
    showCustomConfirm("Delete this application record permanently?", async () => {
        const client = getSupabase();
        if (!client) return;
        closeModal(); 
        try {
            const { error } = await client.from('reservation_slots').delete().eq('id', id);
            if (error) throw error;
            showToast(t("toast_record_dropped"), "success");
            loadApplications();
            loadRecentAccepts(); 
        } catch (err) {
            console.error("Failed to delete application:", err);
            showToast(t("toast_delete_failed"), "error");
        }
    }, '#ef4444');
}

function exportToCSV() {
    if (savedApplications.length === 0) {
        showToast(t("toast_no_data_export"), "warning");
        return;
    }
    const headers = ["Position", "Time Slot UTC", "Status", "Nickname", "Game ID", "Furnace Level", "Fire Crystal", "Refined Fire Crystal", "General SP (Days)", "Construction SP (Days)", "Research SP (Days)", "Training SP (Days)"];
    const rows = savedApplications.map(app => [
        sanitizeCsvField(app.position), sanitizeCsvField(app.time_slot), sanitizeCsvField(app.status),
        sanitizeCsvField(app.nickname || '-'), sanitizeCsvField(app.game_id || '-'), sanitizeCsvField(app.furnace_level || '-'), sanitizeCsvField(app.fire_crystal || '0'),
        sanitizeCsvField(app.refined_fire_crystal || '0'),
        sanitizeCsvField(app.general_speedup || '0'), sanitizeCsvField(app.construction_speedup || '0'),
        sanitizeCsvField(app.research_speedup || '0'), sanitizeCsvField(app.training_speedup || '0')
    ]);

    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `SVS_Ministry_Export_${currentPosition.replace(/\s+/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(t("toast_csv_downloaded"), "success");
}

async function handleFinishSVS() {
    if (!isAdmin) return;
    const client = getSupabase();
    if (!client) return;

    showCustomConfirm("Caution to finish SVS!\n Are you sure ?, this will be reset all applied data", async () => {
        const finishBtn = document.getElementById('finish-svs-btn');
        setButtonBusy(finishBtn, true, 'Clearing...');
        try {
            const { error } = await client.from('reservation_slots').delete().neq('id', 0); 
            if (error) throw error;
            showToast(t("toast_all_cleared"), "success");
            loadApplications();
            loadRecentAccepts(); 
        } catch (err) {
            console.error("Failed to clear data:", err);
            showToast(t("toast_clear_failed"), "error");
        } finally {
            setButtonBusy(finishBtn, false);
        }
    }, '#dc2626'); 
}

function startLiveClock() {
    const localClockEl = document.getElementById('local-clock');
    const localLabelEl = document.getElementById('local-clock-label');
    const utcClockEl = document.getElementById('utc-clock');
    const timezoneSelect = document.getElementById('timezone');

    if (!localClockEl || !utcClockEl || !localLabelEl) return;

    setInterval(() => {
        const now = new Date();
        const utcHours = String(now.getUTCHours()).padStart(2, '0');
        const utcMinutes = String(now.getUTCMinutes()).padStart(2, '0');
        const utcSeconds = String(now.getUTCSeconds()).padStart(2, '0');
        utcClockEl.innerText = `${utcHours}:${utcMinutes}:${utcSeconds}`;

        const schedulePage = document.getElementById('schedule-page');
        const isScheduleVisible = schedulePage && !schedulePage.classList.contains('hidden');

        if (isScheduleVisible && timezoneSelect && timezoneSelect.value !== "") {
            const offset = parseFloat(timezoneSelect.value); 
            const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
            const targetTime = new Date(utcTime + (3600000 * offset));

            const displayHours = String(targetTime.getHours()).padStart(2, '0');
            const displayMinutes = String(targetTime.getMinutes()).padStart(2, '0');
            const displaySeconds = String(targetTime.getSeconds()).padStart(2, '0');
            
            const sign = offset >= 0 ? "+" : "-";
            const absOffset = Math.abs(offset);
            const hours = Math.floor(absOffset); 
            const minutes = Math.round((absOffset - hours) * 60); 
            
            if (minutes > 0) {
                localLabelEl.innerText = `UTC${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:`;
            } else {
                localLabelEl.innerText = `UTC${sign}${String(hours).padStart(2, '0')}:`;
            }
            localClockEl.innerText = `${displayHours}:${displayMinutes}:${displaySeconds}`;
        } else {
            localLabelEl.innerText = t("local_label");
            localClockEl.innerText = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        }
    }, 1000);
}

async function loadRecentAccepts() {
    const logListEl = document.getElementById('recent-log-list');
    if (!logListEl) return;
    const client = getSupabase();
    if (!client) return;

    try {
        const { data, error } = await client
            .from('reservation_slots')
            .select('nickname, position, time_slot, updated_at') 
            .eq('status', 'Accepted')
            .not('nickname', 'is', null)
            .neq('nickname', '')
            .order('updated_at', { ascending: false })
            .limit(10);

        if (error) throw error;
        if (!data || data.length === 0) {
            logListEl.innerHTML = `<div class="log-item-empty">${t("log_empty")}</div>`;
            return;
        }
        logListEl.innerHTML = ''; 
        data.forEach(item => {
            const shortPos = item.position ? getPositionConfig(item.position).shortLabel : 'Unknown';
            const logRow = document.createElement('div');
            logRow.className = 'log-entry';
            logRow.innerHTML = `
                <span>✅ <span class="log-user">${escapeHtml(item.nickname)}</span> <span style="color: #8a8d98; font-size: 0.95em; margin-left: 5px;">${escapeHtml(item.time_slot)} UTC</span></span>
                <span class="log-pos">[${escapeHtml(shortPos)}]</span>
            `;
            logListEl.appendChild(logRow);
        });
    } catch (err) { console.error("Failed to load recent accepts:", err); }
}

// ================= SNOWFLAKE EFFECT =================
function createSnowEffect() {
    const snowContainer = document.getElementById('snow-container');
    if (!snowContainer) return;

    const maxSnowflakes = 20; 
    if (snowContainer.querySelectorAll('.snowflake').length >= maxSnowflakes) return;

    const snowflake = document.createElement('div');
    snowflake.classList.add('snowflake');
    snowflake.style.left = Math.random() * 100 + 'vw';

    const size = Math.random() * 3 + 2 + 'px';
    snowflake.style.width = size;
    snowflake.style.height = size;

    const durationSeconds = Math.random() * 5 + 10; 
    snowflake.style.animationDuration = durationSeconds + 's';
    snowflake.style.opacity = Math.random() * 0.5 + 0.2;

    snowContainer.appendChild(snowflake);

    setTimeout(() => {
        snowflake.remove();
    }, durationSeconds * 1000);
}
setInterval(createSnowEffect, 200);
// ======================================================

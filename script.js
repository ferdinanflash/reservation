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

const DEFAULT_HOW_TO_USE_NOTES = {
    en: `1. Choose a free time slot and click Apply.
2. Enter the required in-game information and submit the reservation.
3. Waiting means the slot has applicants but no Accepted applicant yet.
4. If you are President, you can open an applicant's details, change status/time, or remove the record.
5. A moved application keeps its previous status and records the move in Time Log.
6. Use the timezone selector to view slot times in your local timezone.`,
    id: `1. Pilih slot waktu yang kosong lalu tekan Ajukan.
2. Isi informasi dalam game yang diperlukan lalu kirim reservasi.
3. Waiting berarti slot memiliki pengajuan tetapi belum ada pengajuan yang Accepted.
4. Jika Anda Presiden, Anda dapat melihat detail, mengubah status/waktu, atau menghapus pengajuan.
5. Pengajuan yang dipindahkan tetap mempertahankan status sebelumnya dan perpindahannya tercatat di Time Log.
6. Gunakan pilihan zona waktu untuk melihat waktu slot sesuai zona waktu Anda.`,
    ph: `1. Pumili ng bakanteng time slot at pindutin ang Mag-apply.
2. Ilagay ang kinakailangang in-game information at isumite ang reservation.
3. Ang Waiting ay nangangahulugang may mga application sa slot pero wala pang Accepted.
4. Kung ikaw ay President, maaari mong tingnan ang details, baguhin ang status/time, o alisin ang record.
5. Ang inilipat na application ay mananatili sa dating status at itatala ang paglipat sa Time Log.
6. Gamitin ang timezone selector para makita ang oras ayon sa iyong local timezone.`,
    cn: `1. 选择空闲时间段，然后点击预约。
2. 填写所需的游戏信息并提交预约。
3. Waiting 表示该时间段已有申请，但还没有 Accepted 申请。
4. 如果您是会长，可以查看详情、修改状态/时间，或删除记录。
5. 移动申请时会保留原状态，并在 Time Log 中记录移动历史。
6. 使用时区选择器可按照您的本地时区查看时间段。`
};

function getDefaultHowToUseNotes() {
    const lang = typeof getLang === 'function' ? getLang() : 'en';
    return DEFAULT_HOW_TO_USE_NOTES[lang] || DEFAULT_HOW_TO_USE_NOTES.en;
}

async function loadHowToUseNotes(force = false) {
    if (!force && howToUseNotesLoaded) return currentHowToUseNotes;
    const client = getSupabase();
    if (!client) {
        currentHowToUseNotes = getDefaultHowToUseNotes();
        howToUseNotesLoaded = true;
        return currentHowToUseNotes;
    }

    const lang = typeof getLang === 'function' ? getLang() : 'en';
    try {
        const { data, error } = await client
            .from('how_to_use_notes')
            .select('content')
            .eq('position', currentPosition)
            .eq('language', lang)
            .maybeSingle();
        if (error) throw error;
        currentHowToUseNotes = data?.content ?? getDefaultHowToUseNotes();
    } catch (err) {
        console.error('Failed to load How to Use notes:', err);
        currentHowToUseNotes = getDefaultHowToUseNotes();
    }
    howToUseNotesLoaded = true;
    return currentHowToUseNotes;
}

async function openHowToUseModal() {
    const modal = document.getElementById('how-to-use-modal');
    const notesEl = document.getElementById('how-to-use-notes');
    const saveBtn = document.getElementById('how-to-use-save-btn');
    if (!modal || !notesEl) return;

    modal.classList.remove('hidden');
    notesEl.value = getDefaultHowToUseNotes();
    notesEl.readOnly = true;
    notesEl.classList.remove('admin-editable');
    if (saveBtn) saveBtn.style.display = isAdmin ? 'inline-block' : 'none';

    const notes = await loadHowToUseNotes();
    if (!modal.classList.contains('hidden')) notesEl.value = notes;
    if (isAdmin) {
        notesEl.readOnly = false;
        notesEl.classList.add('admin-editable');
    }
}

function closeHowToUseModal() {
    const modal = document.getElementById('how-to-use-modal');
    if (modal) modal.classList.add('hidden');
}

async function saveHowToUseNotes() {
    if (!isAdmin) return;
    const client = getSupabase();
    const notesEl = document.getElementById('how-to-use-notes');
    const saveBtn = document.getElementById('how-to-use-save-btn');
    if (!client || !notesEl) return;

    const content = notesEl.value.trim();
    if (!content) {
        showToast(t('toast_how_to_use_empty'), 'warning');
        return;
    }

    const lang = typeof getLang === 'function' ? getLang() : 'en';
    setButtonBusy(saveBtn, true, t('saving_text'));
    try {
        const { error } = await client
            .from('how_to_use_notes')
            .upsert({
                position: currentPosition,
                language: lang,
                content,
                updated_at: new Date().toISOString()
            }, { onConflict: 'position,language' });
        if (error) throw error;
        currentHowToUseNotes = content;
        howToUseNotesLoaded = true;
        showToast(t('toast_how_to_use_saved'), 'success');
        closeHowToUseModal();
    } catch (err) {
        console.error('Failed to save How to Use notes:', err);
        showToast(t('toast_how_to_use_save_failed'), 'error');
    } finally {
        setButtonBusy(saveBtn, false);
    }
}

function showSchedule(positionName) {
    currentPosition = positionName;
    currentHowToUseNotes = '';
    howToUseNotesLoaded = false;
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
                <td><strong>${utcTimeStr} UTC</strong><br><small style="color:#8a8d98;">${t("local_prefix", { time: localTimeStr })}</small></td>
                <td><span style="color:#22c55e; font-weight:bold;">${t("status_accepted")}</span>${leftoverBadge}</td>
                <td>${escapeHtml(acceptedApp.nickname)}</td>
                <td><span style="cursor:pointer; color:#3b82f6; text-decoration:underline;" onclick="copyToClipboard('${escapeHtml(acceptedApp.game_id)}')">${escapeHtml(acceptedApp.game_id)}</span></td>
                <td>${escapeHtml(acceptedApp.furnace_level) || '-'}</td>
            `;
        } else {
            let actionBtn = `<button class="btn-apply" onclick="applySlot('${utcTimeStr}')">${t("btn_apply_action")}</button>`;
            let statusText = `<span class="no-apps">${t("status_no_applications")}</span>`;
            if (countWaiting > 0) {
                statusText = `<span style="color:#f59e0b; font-weight:bold; cursor:pointer; text-decoration:underline;" onclick="openWaitingModal('${utcTimeStr}')">${t("status_waiting_count", { count: countWaiting })}</span>`;
            }
            row.innerHTML = `
                <td>${actionBtn}</td>
                <td><strong>${utcTimeStr} UTC</strong><br><small style="color:#8a8d98;">${t("local_prefix", { time: localTimeStr })}</small></td>
                <td>${statusText}</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
            `;
        }
        tbody.appendChild(row);
    }
}

// ================= APPLICATION TIME LOG =================
// Time history is stored per application in reservation_slots.time_log as a
// JSON array. It is intentionally rendered only inside the magnifying-glass
// detail view, never in the main schedule table.
function getApplicationTimeLog(app) {
    let log = app && app.time_log;
    if (typeof log === 'string') {
        try { log = JSON.parse(log); } catch (_) { log = []; }
    }
    if (!Array.isArray(log)) log = [];

    // Older records may predate the time_log column. If they have created_at,
    // surface that timestamp without changing the record until an admin saves it.
    if (log.length === 0 && app && app.created_at) {
        log = [{ action: 'created', at: app.created_at, actor: 'Applicant' }];
    }
    return log;
}

function formatApplicationLogTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return escapeHtml(String(value));
    const langMap = { en: 'en-US', id: 'id-ID', ph: 'fil-PH', cn: 'zh-CN' };
    const locale = langMap[(typeof getLang === 'function' ? getLang() : 'en')] || 'en-US';
    try {
        return new Intl.DateTimeFormat(locale, {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        }).format(date);
    } catch (_) {
        return date.toLocaleString();
    }
}

function buildApplicationTimeLogHtml(app) {
    const log = getApplicationTimeLog(app);
    if (log.length === 0) {
        return `<div class="application-time-log-empty">${t("time_log_empty")}</div>`;
    }

    return log.map(entry => {
        const actionKey = String(entry.action || 'updated').toLowerCase();
        const actionLabel = t(`time_log_${actionKey}`) || entry.action || t("time_log_updated");
        const detail = entry.detail ? ` — ${escapeHtml(String(entry.detail))}` : '';
        const actor = entry.actor ? `<span class="time-log-actor">${escapeHtml(String(entry.actor))}</span>` : '';
        return `<div class="time-log-entry">
            <div class="time-log-main"><strong>${escapeHtml(actionLabel)}</strong>${detail}</div>
            <div class="time-log-meta">${formatApplicationLogTime(entry.at)}${actor ? ` · ${actor}` : ''}</div>
        </div>`;
    }).join('');
}

async function appendApplicationTimeLog(app, entry) {
    const client = getSupabase();
    if (!client || !app || !app.id) return;

    const nextLog = [...getApplicationTimeLog(app), {
        action: entry.action || 'updated',
        at: entry.at || new Date().toISOString(),
        actor: entry.actor || (isAdmin ? (currentStaffUsername || 'President') : 'Applicant'),
        detail: entry.detail || ''
    }];

    const { error } = await client
        .from('reservation_slots')
        .update({ time_log: nextLog })
        .eq('id', app.id);
    if (error) throw error;
    app.time_log = nextLog;
}

function buildAdminApplicationControls(app) {
    if (!isAdmin) return '';

    const currentStatus = app.status === 'Accepted' ? 'Accepted' : 'Waiting';
    const allSlots = getAllUtcSlots();
    const options = allSlots.map(time =>
        `<option value="${time}" ${String(app.time_slot).trim() === time ? 'selected' : ''}>${time} UTC</option>`
    ).join('');

    return `
        <div class="admin-application-controls">
            <div class="admin-control-title">${t("admin_application_controls")}</div>
            <div class="admin-control-grid">
                <label>${t("admin_status_label")}
                    <select id="admin-status-select-${app.id}" class="admin-control-select">
                        <option value="Waiting" ${currentStatus === 'Waiting' ? 'selected' : ''}>${t("status_waiting")}</option>
                        <option value="Accepted" ${currentStatus === 'Accepted' ? 'selected' : ''}>${t("status_accepted")}</option>
                    </select>
                </label>
                <label>${t("admin_time_label")}
                    <select id="admin-time-select-${app.id}" class="admin-control-select">${options}</select>
                </label>
            </div>
            <button type="button" class="btn-apply admin-save-application-btn" onclick="saveAdminApplicationChanges(${app.id})">${t("btn_save_changes")}</button>
        </div>
    `;
}

async function saveAdminApplicationChanges(id) {
    if (!isAdmin) return;
    const app = savedApplications.find(a => a.id === id);
    if (!app) return;

    const statusEl = document.getElementById(`admin-status-select-${id}`);
    const timeEl = document.getElementById(`admin-time-select-${id}`);
    if (!statusEl || !timeEl) return;

    const newStatus = statusEl.value === 'Accepted' ? 'Accepted' : 'Waiting';
    const newTime = String(timeEl.value || '').trim();
    const oldStatus = app.status === 'Accepted' ? 'Accepted' : 'Waiting';
    const oldTime = String(app.time_slot).trim();

    if (!newTime) {
        showToast(t("toast_no_slot_selected"), "warning");
        return;
    }
    if (newStatus === oldStatus && newTime === oldTime) {
        showToast(t("toast_no_changes"), "warning");
        return;
    }

    // Only one Accepted application is allowed per UTC slot.
    const occupiedByAnotherAccepted = savedApplications.some(other =>
        other.id !== id &&
        other.status === 'Accepted' &&
        String(other.time_slot).trim() === newTime
    );
    if (newStatus === 'Accepted' && occupiedByAnotherAccepted) {
        showToast(t("toast_slot_already_accepted"), "error");
        return;
    }

    const changes = {};
    if (newStatus !== oldStatus) changes.status = newStatus;
    if (newTime !== oldTime) changes.time_slot = newTime;

    const detailParts = [];
    if (newTime !== oldTime) detailParts.push(`${oldTime} UTC → ${newTime} UTC`);
    if (newStatus !== oldStatus) detailParts.push(`${oldStatus} → ${newStatus}`);

    const now = new Date().toISOString();
    const nextLog = [...getApplicationTimeLog(app), {
        action: newTime !== oldTime && newStatus !== oldStatus ? 'updated' : (newTime !== oldTime ? 'moved' : 'status_changed'),
        at: now,
        actor: currentStaffUsername || 'President',
        detail: detailParts.join('; ')
    }];
    changes.time_log = nextLog;

    const client = getSupabase();
    if (!client) return;

    const saveBtn = document.querySelector(`#details-content .admin-save-application-btn`);
    setButtonBusy(saveBtn, true, t("saving"));
    try {
        const { error } = await client.from('reservation_slots').update(changes).eq('id', id);
        if (error) throw error;
        showToast(t("toast_application_updated"), "success");
        await loadApplications();
        loadRecentAccepts();
        const refreshed = savedApplications.find(a => a.id === id);
        if (refreshed) openDetailsModal(id);
    } catch (err) {
        console.error("Failed to update application:", err);
        showToast(t("toast_application_update_failed"), "error");
    } finally {
        setButtonBusy(saveBtn, false);
    }
}

// ================= SHARED DETAIL BLOCK BUILDER =================
// Shared by openDetailsModal() and openWaitingModal() so the stat detail
// markup isn't duplicated in two different places.
function buildStatDetailsHtml(app, compact = false) {
    const additionalSlots = getAdditionalTimeSlots(app);
    const additionalSlotsText = additionalSlots.map(s => `${escapeHtml(s)} UTC`).join(', ');
    const additionalRowCompact = additionalSlots.length > 0
        ? `<div><span style="color:#8a8d98; margin-right: 10px;">${t("stat_additional_time_slots")}</span> <strong style="color:#f1f5f9;">${additionalSlotsText}</strong></div>`
        : '';
    const additionalRowFull = additionalSlots.length > 0
        ? `<div><span style="color:#8a8d98;">${t("stat_additional_time_slots")}</span> <strong style="color:#f1f5f9;">${additionalSlotsText}</strong></div>`
        : '';

    if (compact) {
        return `
            <div><span style="color:#8a8d98; margin-right: 10px;">${t("stat_furnace_lvl")}</span> <strong style="color:#f1f5f9;">${escapeHtml(app.furnace_level) || '-'}</strong></div>
            ${additionalRowCompact}
            <div><span style="color:#8a8d98; margin-right: 10px;">${t("stat_fc")}</span> <strong style="color:#f59e0b;">${escapeHtml(app.fire_crystal) || '0'}</strong></div>
            <div><span style="color:#8a8d98; margin-right: 10px;">${t("stat_rfc")}</span> <strong style="color:#f59e0b;">${escapeHtml(app.refined_fire_crystal) || '0'}</strong></div>
            <div><span style="color:#8a8d98; margin-right: 10px;">${t("stat_general")}</span> <strong style="color:#f1f5f9;">${escapeHtml(app.general_speedup) || '0'}</strong></div>
            <div><span style="color:#8a8d98; margin-right: 10px;">${t("stat_const")}</span> <strong style="color:#f1f5f9;">${escapeHtml(app.construction_speedup) || '0'}</strong></div>
            <div><span style="color:#8a8d98; margin-right: 10px;">${t("stat_research")}</span> <strong style="color:#f1f5f9;">${escapeHtml(app.research_speedup) || '0'}</strong></div>
            <div><span style="color:#8a8d98; margin-right: 10px;">${t("stat_train")}</span> <strong style="color:#f1f5f9;">${escapeHtml(app.training_speedup) || '0'}</strong></div>
        `;
    }

    return `
        <div><span style="color:#8a8d98;">${t("stat_nickname")}</span> <strong style="color:#f1f5f9;">${escapeHtml(app.nickname) || '-'}</strong></div>
        <div><span style="color:#8a8d98;">${t("stat_game_id")}</span> <strong style="color:#3b82f6;">${escapeHtml(app.game_id) || '-'}</strong></div>
        <div><span style="color:#8a8d98;">${t("stat_furnace_level")}</span> <strong style="color:#f1f5f9;">${escapeHtml(app.furnace_level) || '-'}</strong></div>
        ${additionalRowFull}
        <hr style="border: 0; border-top: 1px solid #334155; margin: 4px 0;">
        <div><span style="color:#8a8d98;">${t("stat_fire_crystals")}</span> <strong style="color:#f59e0b;">${escapeHtml(app.fire_crystal) || '0'}</strong></div>
        <div><span style="color:#8a8d98;">${t("stat_refined_fire_crystals")}</span> <strong style="color:#f59e0b;">${escapeHtml(app.refined_fire_crystal) || '0'}</strong></div>
        <div><span style="color:#8a8d98;">${t("stat_general_speedup")}</span> <strong style="color:#f1f5f9;">${escapeHtml(app.general_speedup) || '0'} ${t('days_suffix')}</strong></div>
        <div><span style="color:#8a8d98;">${t("stat_construction_speedup")}</span> <strong style="color:#f1f5f9;">${escapeHtml(app.construction_speedup) || '0'} ${t('days_suffix')}</strong></div>
        <div><span style="color:#8a8d98;">${t("stat_research_speedup")}</span> <strong style="color:#f1f5f9;">${escapeHtml(app.research_speedup) || '0'} ${t('days_suffix')}</strong></div>
        <div><span style="color:#8a8d98;">${t("stat_training_speedup")}</span> <strong style="color:#f1f5f9;">${escapeHtml(app.training_speedup) || '0'} ${t('days_suffix')}</strong></div>
    `;
}

// Function to open the detail popup modal
function openDetailsModal(appId) {
    const app = savedApplications.find(a => a.id === appId);
    if (!app) return;

    const modal = document.getElementById('details-modal');
    const contentEl = document.getElementById('details-content');
    contentEl.innerHTML = `
        <div class="details-stats">${buildStatDetailsHtml(app, false)}</div>
        <div class="application-time-log">
            <div class="application-time-log-title">${t("time_log_title")}</div>
            <div class="application-time-log-list">${buildApplicationTimeLogHtml(app)}</div>
        </div>
        ${buildAdminApplicationControls(app)}
    `;
    contentEl.dataset.appId = String(appId);
    modal.classList.remove('hidden');
}

function closeDetailsModal() {
    document.getElementById('details-modal').classList.add('hidden');
}

function openWaitingModal(timeStr) {
    const modal = document.getElementById('waiting-modal');
    if (!modal) return;
    
    currentWaitingModalTime = timeStr;
    document.getElementById('modal-title').innerText = t("waiting_list_title", { time: timeStr });
    const modalTbody = document.getElementById('modal-table-body');
    modalTbody.innerHTML = "";

    const thead = modal.querySelector('thead tr');
    thead.innerHTML = `
        <th style="padding: 5px 10px; text-align: left;">${t("modal_nickname_short")}</th>
        <th style="padding: 5px 10px; text-align: left;">${t("modal_id_short")}</th>
        <th style="padding: 5px 10px; text-align: left;">${t("th_move_to")}</th>
        <th style="padding: 5px 10px; text-align: left;">${t("th_actions")}</th>
    `;

    let appsInSlot = savedApplications.filter(a => String(a.time_slot).trim() === timeStr && a.status === 'Waiting');

    appsInSlot.forEach(app => {
        const mainRow = document.createElement('tr');
        let adminButtons = isAdmin ? `
            <div class="admin-action-buttons" role="group" aria-label="Application actions">
                <button type="button" class="btn-apply btn-compact admin-action-btn admin-accept-btn" onclick="acceptApp(${app.id})">${t("btn_accept")}</button>
                <button type="button" class="btn-apply btn-danger btn-compact admin-action-btn admin-reject-btn" onclick="removeApp(${app.id})">${t("btn_drop")}</button>
            </div>
        ` : '';

        // President/Admin can move ANY Waiting application directly from the Waiting List.
        // The status remains Waiting; only time_slot and the time log are changed.
        const availableWaitingSlots = isAdmin ? getAvailableTimeSlots(timeStr) : [];
        const moveSelectId = `waiting-move-select-${app.id}`;
        const moveOptions = availableWaitingSlots.length > 0
            ? availableWaitingSlots.map(time => `<option value="${time}">${time} UTC</option>`).join('')
            : `<option value="">${t("no_free_slots")}</option>`;
        const moveControls = isAdmin ? `
            <select id="${moveSelectId}" class="admin-control-select waiting-move-select" ${availableWaitingSlots.length === 0 ? 'disabled' : ''}>${moveOptions}</select>
            <button type="button" class="btn-apply btn-compact waiting-move-btn" ${availableWaitingSlots.length === 0 ? 'disabled' : ''} onclick="moveWaitingListApp(${app.id}, document.getElementById('${moveSelectId}').value, '${timeStr}')">${t("btn_move")}</button>
        ` : '-';

        mainRow.innerHTML = `
            <td style="padding: 5px 10px; text-align: left; font-weight: 500; white-space: nowrap;">
                <span class="icon-tap-target" style="cursor:pointer; margin-right: 6px;" onclick="toggleDetails(${app.id})">🔍</span>${escapeHtml(app.nickname)}
            </td>
            <td style="padding: 5px 10px; text-align: left; white-space: nowrap;">
                <span style="cursor:pointer; color:#3b82f6; text-decoration:underline;" onclick="copyToClipboard('${escapeHtml(app.game_id)}')">${escapeHtml(app.game_id)}</span>
            </td>
            <td style="padding: 5px 10px; text-align: left; white-space: nowrap;">${moveControls}</td>
            <td style="padding: 5px 10px; text-align: left; white-space: nowrap;">${adminButtons}</td>
        `;
        modalTbody.appendChild(mainRow);

        const detailsRow = document.createElement('tr');
        detailsRow.id = `details-${app.id}`;
        detailsRow.style.display = 'none'; 
        detailsRow.innerHTML = `
            <td colspan="4" style="padding: 0; border: none;">
                <div style="background: #151821; padding: 8px; margin: 2px 5px; border-radius: 4px; font-size: 0.8rem; text-align: left; border: 1px solid #334155;">
                    ${buildStatDetailsHtml(app, true)}
                    <div class="waiting-time-log">
                        <div class="application-time-log-title">${t("time_log_title")}</div>
                        <div class="application-time-log-list">${buildApplicationTimeLogHtml(app)}</div>
                    </div>
                </div>
            </td>
        `;
        modalTbody.appendChild(detailsRow);
    });
    
    modal.classList.remove('hidden');
}

// Move directly from the Waiting List. This intentionally preserves the Waiting status.
async function moveWaitingListApp(id, newTimeSlot, originTime) {
    if (!isAdmin) return;
    if (!newTimeSlot) {
        showToast(t("toast_no_slot_selected"), "warning");
        return;
    }

    const app = savedApplications.find(a => a.id === id);
    if (!app) return;
    if (app.status !== 'Waiting') return;

    const oldTime = String(app.time_slot).trim();
    if (oldTime === String(newTimeSlot).trim()) {
        showToast(t("toast_no_changes"), "warning");
        return;
    }

    const client = getSupabase();
    if (!client) return;

    const btn = document.querySelector(`#waiting-move-select-${id}`)?.nextElementSibling;
    setButtonBusy(btn, true, t("saving"));
    try {
        const nextLog = [...getApplicationTimeLog(app), {
            action: 'moved',
            at: new Date().toISOString(),
            actor: currentStaffUsername || 'President',
            detail: `${oldTime} UTC → ${String(newTimeSlot).trim()} UTC`
        }];
        const { error } = await client.from('reservation_slots').update({
            time_slot: String(newTimeSlot).trim(),
            time_log: nextLog
        }).eq('id', id);
        if (error) throw error;

        showToast(t("toast_applicant_moved", { time: String(newTimeSlot).trim() }), "success");
        await loadApplications();
        openWaitingModal(originTime);
    } catch (err) {
        console.error("Failed to move waiting application:", err);
        showToast(t("toast_move_failed"), "error");
    } finally {
        setButtonBusy(btn, false);
    }
}

function toggleDetails(id) {
    const detailsRow = document.getElementById(`details-${id}`);
    if (detailsRow) {
        detailsRow.style.display = detailsRow.style.display === 'none' ? 'table-row' : 'none';
    }
}

function closeModal() {
    currentWaitingModalTime = null;
    document.getElementById('waiting-modal').classList.add('hidden');
}

function applySlot(time) {
    if (!isReservationOpen) {
        showToast(t("toast_reservation_locked"), "error");
        return; 
    }

    selectedTimeSlot = time;
    document.getElementById('form-position-title').innerText = translatePositionName(currentPosition);
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

    // Reset the Additional Preferred Time Slot section for a fresh form.
    document.getElementById('input-additional-time-toggle').checked = false;
    const additionalContainer = document.getElementById('additional-time-slots-container');
    additionalContainer.innerHTML = "";
    additionalContainer.classList.add('hidden');
    document.getElementById('btn-add-another-time').classList.add('hidden');
    additionalTimeSlotSeq = 0;

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

// Called when the "Additional Preferred Time Slot" checkbox is toggled.
// Checking it reveals the first extra dropdown; unchecking it clears
// everything back out.
function toggleAdditionalTimeSlots() {
    const checked = document.getElementById('input-additional-time-toggle').checked;
    const container = document.getElementById('additional-time-slots-container');
    const addBtn = document.getElementById('btn-add-another-time');

    if (checked) {
        container.classList.remove('hidden');
        if (container.children.length === 0) {
            addAdditionalTimeSlotRow();
        }
        addBtn.classList.toggle('hidden', container.children.length >= MAX_ADDITIONAL_TIME_SLOTS);
    } else {
        container.classList.add('hidden');
        container.innerHTML = "";
        addBtn.classList.add('hidden');
    }
}

// Triggered by the "+ Add another time?" button.
function addAnotherTimeSlot() {
    addAdditionalTimeSlotRow();
}

// Appends one more time-slot dropdown row, up to MAX_ADDITIONAL_TIME_SLOTS.
function addAdditionalTimeSlotRow() {
    const container = document.getElementById('additional-time-slots-container');
    const addBtn = document.getElementById('btn-add-another-time');
    if (container.children.length >= MAX_ADDITIONAL_TIME_SLOTS) return;

    additionalTimeSlotSeq++;
    const rowId = additionalTimeSlotSeq;

    const options = getAllUtcSlots().map(time => `<option value="${time}">${time} UTC</option>`).join('');
    const row = document.createElement('div');
    row.className = 'additional-time-slot-row';
    row.id = `additional-time-row-${rowId}`;
    row.innerHTML = `
        <select id="input-additional-time-${rowId}" class="additional-time-select">
            <option value="">${t("option_select_additional_time")}</option>
            ${options}
        </select>
        <button type="button" class="btn-remove-additional-time" onclick="removeAdditionalTimeSlot(${rowId})" aria-label="${t("btn_remove")}" title="${t("btn_remove")}">&times;</button>
    `;
    container.appendChild(row);

    addBtn.classList.toggle('hidden', container.children.length >= MAX_ADDITIONAL_TIME_SLOTS);
}

// Removes a single additional time-slot row (does not touch the checkbox;
// the user can always add another one back up to the max).
function removeAdditionalTimeSlot(rowId) {
    const row = document.getElementById(`additional-time-row-${rowId}`);
    if (row) row.remove();

    const container = document.getElementById('additional-time-slots-container');
    const addBtn = document.getElementById('btn-add-another-time');
    const stillChecked = document.getElementById('input-additional-time-toggle').checked;
    addBtn.classList.toggle('hidden', !stillChecked || container.children.length >= MAX_ADDITIONAL_TIME_SLOTS);
}

// Reads every additional time-slot dropdown currently in the form and
// returns the distinct, non-empty selections (excluding the main
// selectedTimeSlot), capped at MAX_ADDITIONAL_TIME_SLOTS.
function collectAdditionalTimeSlots() {
    const values = Array.from(document.querySelectorAll('#additional-time-slots-container .additional-time-select'))
        .map(sel => sel.value.trim())
        .filter(v => v !== '' && v !== selectedTimeSlot);
    return [...new Set(values)].slice(0, MAX_ADDITIONAL_TIME_SLOTS);
}

// Normalizes an application's stored additional_time_slots (jsonb array or
// legacy JSON string) into a clean array of "HH:MM" strings.
function getAdditionalTimeSlots(app) {
    let slots = app && app.additional_time_slots;
    if (typeof slots === 'string') {
        try { slots = JSON.parse(slots); } catch (_) { slots = []; }
    }
    if (!Array.isArray(slots)) slots = [];
    return slots.filter(s => typeof s === 'string' && s.trim() !== '');
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

    const additionalTimeSlots = collectAdditionalTimeSlots();

    const submitBtn = document.querySelector('#apply-modal .btn-apply');
    setButtonBusy(submitBtn, true, 'Submitting...');

    try {
        const { error } = await client
            .from('reservation_slots')
            .insert({ 
                time_slot: selectedTimeSlot, position: currentPosition, nickname: nickname, game_id: gameId, 
                furnace_level: furnaceLevel,
                fire_crystal: fc, refined_fire_crystal: rfc, general_speedup: genSp, construction_speedup: constSp, research_speedup: resSp, training_speedup: trainSp,
                status: 'Waiting',
                additional_time_slots: additionalTimeSlots,
                time_log: [{ action: 'created', at: new Date().toISOString(), actor: 'Applicant', detail: `${selectedTimeSlot} UTC` }]
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
            if (!targetApp) throw new Error('Application not found');
            const nextLog = [...getApplicationTimeLog(targetApp), {
                action: 'status_changed',
                at: new Date().toISOString(),
                actor: currentStaffUsername || 'President',
                detail: `${targetApp.status} → Accepted`
            }];
            const { error } = await client.from('reservation_slots').update({ status: 'Accepted', time_log: nextLog }).eq('id', id);
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

    currentReassignModalTime = originTime;
    const titleEl = document.getElementById('reassign-modal-title');
    if (titleEl) titleEl.innerText = t("reassign_modal_title_dyn", { time: originTime });

    renderReassignRows(originTime);
    modal.classList.remove('hidden');
}

function closeReassignModal() {
    currentReassignModalTime = null;
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
            : `<option value="">${t("no_free_slots")}</option>`;

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
                <button type="button" class="btn-apply btn-danger btn-compact admin-action-btn admin-reject-btn" onclick="removeApp(${app.id})">${t("btn_drop")}</button>
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
        const app = savedApplications.find(a => a.id === id);
        if (!app) throw new Error('Application not found');
        const oldTime = String(app.time_slot).trim();
        const nextLog = [...getApplicationTimeLog(app), {
            action: 'moved',
            at: new Date().toISOString(),
            actor: currentStaffUsername || 'President',
            detail: `${oldTime} UTC → ${newTimeSlot} UTC`
        }];
        const { error } = await client
            .from('reservation_slots')
            .update({ time_slot: newTimeSlot, time_log: nextLog })
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
    link.setAttribute("download", `SVS_Minister_Export_${currentPosition.replace(/\s+/g, '_')}.csv`);
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

    showCustomConfirm("Caution to finish SvS!\n Are you sure ?, this will be reset all applied data", async () => {
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
            const shortPos = item.position ? translatePositionShort(item.position) : t('label_unknown');
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

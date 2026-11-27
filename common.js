/*
 * 3475 SOURCE OWNERSHIP
 * Copyright (c) 2026 Ferdinan | https://3475.web.id
 * Proprietary source code. All rights reserved. Unauthorized reuse is prohibited.
 */
// ================= SHARED CONFIG & UTILITIES =================
// Single source of truth for anything both script.js (Transfer Portal) and
// res.js (Reservation Portal) rely on: Supabase credentials, the
// President-login rules, and small helper functions. Both pages must load
// this file BEFORE their own script:
//   <script src="common.js"></script>
//   <script src="script.js"></script>   (or res.js)
//
// This exists specifically to prevent the two pages from silently drifting
// apart — e.g. one page changing ALLOWED_ADMIN_USERNAMES or escapeHtml()
// without the other being updated to match.

// ================= SUPABASE PUBLIC CONFIGURATION =================
const SUPABASE_URL = 'https://pwqkpeykjyujhnreleax.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3cWtwZXlranl1amhucmVsZWF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyMzgxNDgsImV4cCI6MjA5ODgxNDE0OH0.6u2CKOPHcMtVeA2ph0QWTqgtvs-4BQJpsz6v2kCyOEY';
// =================================================================

// ================= WEB PUSH PUBLIC CONFIGURATION =================
// Public VAPID key used by the browser to create a push subscription so
// notifications can be delivered even when the app/tab/browser is closed.
// Safe to expose client-side (same trust level as SUPABASE_ANON_KEY above).
// The matching PRIVATE key lives ONLY in the Supabase Edge Function's
// environment secrets (`supabase secrets set VAPID_PRIVATE_KEY=...`) — never
// put the private key in this file or commit it to git.
const PUSH_VAPID_PUBLIC_KEY = 'BOdByEDiZ7bmzBUBUrto18EX8KbFE1R7yQKOCXxLjNVQsQOEtkO-z9OJPzWgqV23pMYfInBVTajCJ2IX0JYAWAE';
// =================================================================

// Supabase Auth requires an email address, but this app only wants a plain
// username + password. Both pages share the same email domain so accounts
// can be shared across them — but each page still only grants admin access
// to the usernames listed below. A session logged in from one page as any
// OTHER staff account is simply ignored on a page that doesn't allow it —
// it stays a valid session, it just doesn't unlock admin controls there.
const STAFF_EMAIL_DOMAIN = '@3475-staff.internal';
const ALLOWED_ADMIN_USERNAMES = ['president', 'demon', 'mie', 'phoenix']; // <-- only these usernames get admin access

function usernameToStaffEmail(username) {
    return username.trim().toLowerCase().replace(/\s+/g, '') + STAFF_EMAIL_DOMAIN;
}

function staffEmailToUsername(email) {
    return (email || '').endsWith(STAFF_EMAIL_DOMAIN)
        ? email.slice(0, -STAFF_EMAIL_DOMAIN.length)
        : email;
}

function isPresidentUsername(username) {
    return !!username && ALLOWED_ADMIN_USERNAMES.includes(username.trim().toLowerCase());
}

// ================= SECURITY: HTML ESCAPING =================
// Any data that comes from a user (nickname, game ID, notes, etc.) MUST go
// through this function before being inserted into innerHTML, so it can't
// be used for stored XSS (e.g. a nickname containing <img onerror=...>).
function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ================= DISPLAY SAFETY: ZALGO / COMBINING-MARK CAPPING =================
// Some nicknames stack many Unicode combining marks (accents/diacritics, i.e.
// "Zalgo" style text) on top of a single base character. Those characters are
// perfectly valid text, but a long stack of marks makes the browser expand the
// line height around them, which pushes the rest of that table row/modal out
// of alignment (e.g. the Waiting List modal). This function is display-only:
// it never touches the nickname that's stored in the DB, exported to CSV, or
// used for copy-to-clipboard/lookup — it only caps what gets rendered on screen
// so the nickname still shows, just without breaking the surrounding layout.
//
// Decorative "fancy text" nicknames (wide symbol alphabets, Tibetan marks,
// emoji ZWJ sequences, etc.) are also a problem on iOS Safari: they measure
// much wider than Latin text and ignore overflow-wrap, so a single nickname
// can stretch a table column and push Move/Accept/Drop off-screen. displayNickname
// truncates by grapheme cluster after capZalgo so layout stays stable.
function capZalgo(value, maxMarksPerChar = 2) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    let result = '';
    let combiningStreak = 0;
    for (const ch of str) {
        // \p{M} = Unicode "Mark" category: combining accents, diacritics, etc.
        if (/\p{M}/u.test(ch)) {
            combiningStreak++;
            if (combiningStreak > maxMarksPerChar) continue; // drop marks past the cap
        } else {
            combiningStreak = 0;
        }
        result += ch;
    }
    return result;
}

/** Display-only nickname: capZalgo + soft truncate by grapheme count (iOS-safe). */
function displayNickname(value, maxGraphemes = 28) {
    const capped = capZalgo(value);
    if (!capped) return '';
    // Prefer Intl.Segmenter when available (modern Safari / Chrome).
    try {
        if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
            const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
            const parts = [];
            for (const { segment } of seg.segment(capped)) {
                parts.push(segment);
                if (parts.length > maxGraphemes) break;
            }
            if (parts.length > maxGraphemes) {
                return parts.slice(0, maxGraphemes).join('') + '…';
            }
            return parts.join('');
        }
    } catch (_) { /* fall through */ }
    // Fallback: iterate code points (good enough when Segmenter is missing).
    const cps = Array.from(capped);
    if (cps.length <= maxGraphemes) return capped;
    return cps.slice(0, maxGraphemes).join('') + '…';
}

/** HTML for a nickname cell: ellipsis-friendly span + full name in title. */
function nicknameHtml(value, maxGraphemes = 28) {
    const raw = value == null ? '' : String(value);
    const shown = displayNickname(raw, maxGraphemes);
    const title = escapeHtml(capZalgo(raw));
    const body = escapeHtml(shown);
    if (!body) return '—';
    return `<span class="nick-display" title="${title}">${body}</span>`;
}

// ================= SHARED SUPABASE CLIENT =================
let supabaseClient = null;
function getSupabase() {
    if (!supabaseClient) {
        if (typeof window.supabase !== 'undefined') {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        } else {
            console.error("Supabase CDN library failed to load");
        }
    }
    return supabaseClient;
}

// ================= CSV FIELD SANITIZATION =================
// Wraps a value for one CSV cell: escapes double quotes properly, and
// guards against CSV/Formula Injection by prefixing an apostrophe if the
// value starts with =, +, -, or @ (these can be executed as a formula in
// Excel/Sheets).
function sanitizeCsvField(value) {
    let str = String(value ?? '-');
    if (/^[=+\-@]/.test(str)) {
        str = `'${str}`;
    }
    str = str.replace(/"/g, '""');
    return `"${str}"`;
}

// ================= CLIPBOARD HELPER =================
function copyToClipboard(text) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        showToast(typeof t === "function" ? t("toast_id_copied", { id: text }) : `ID ${text} copied to clipboard!`, "success");
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        // Fallback for browsers/contexts where the Clipboard API is blocked
        // (e.g. non-HTTPS pages or older mobile browsers).
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showToast(typeof t === "function" ? t("toast_id_copied_fallback", { id: text }) : `ID ${text} copied!`, "success");
        } catch (e) {
            showToast(typeof t === "function" ? t("toast_copy_failed") : "Failed to copy ID automatically.", "error");
        }
        document.body.removeChild(textArea);
    });
}


// ================= NAVBAR "MENU" DROPDOWN =================
// Groups Discord, Redeem Code and President login behind one button.
function toggleNavMenu(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById('nav-menu');
    if (!menu) return;
    const isOpen = menu.classList.toggle('nav-menu-open');
    const trigger = menu.querySelector('.nav-menu-trigger');
    if (trigger) trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

function closeNavMenu() {
    const menu = document.getElementById('nav-menu');
    if (!menu) return;
    menu.classList.remove('nav-menu-open');
    const trigger = menu.querySelector('.nav-menu-trigger');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
}

// Close after picking an item, on outside click, or on Escape.
document.addEventListener('click', function (e) {
    const menu = document.getElementById('nav-menu');
    if (!menu) return;
    if (!menu.contains(e.target) || e.target.closest('.nav-menu-item')) closeNavMenu();
});
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeNavMenu();
});


// ================= PWA INSTALL BUTTON =================
const installAppButton = document.getElementById('install-app-btn');
const PWA_APP_ID = 'https://3475.web.id/';
const PWA_INSTALLED_KEY = '3475_pwa_install_confirmed';
const supportsWebInstall = typeof navigator.install === 'function';
let deferredInstallPrompt = null;

function isRunningAsInstalledApp() {
    return !!(
        (window.matchMedia && (
            window.matchMedia('(display-mode: standalone)').matches ||
            window.matchMedia('(display-mode: minimal-ui)').matches ||
            window.matchMedia('(display-mode: fullscreen)').matches ||
            window.matchMedia('(display-mode: window-controls-overlay)').matches
        )) ||
        navigator.standalone === true
    );
}

function hideInstallAppButton() {
    if (installAppButton) installAppButton.hidden = true;
}

function setInstallAppButton(mode) {
    if (!installAppButton || isRunningAsInstalledApp()) {
        hideInstallAppButton();
        return;
    }
    const isOpenMode = mode === 'open';
    installAppButton.dataset.mode = isOpenMode ? 'open' : 'install';
    // A normal same-tab link lets Android/Chrome attempt app-link capture.
    installAppButton.href = isOpenMode ? PWA_APP_ID : '#';
    installAppButton.removeAttribute('target');
    installAppButton.removeAttribute('rel');
    const labelElement = installAppButton.querySelector('[data-i18n]');
    const key = isOpenMode ? 'open_app_btn' : 'install_app_btn';
    if (labelElement) {
        labelElement.dataset.i18n = key;
        labelElement.textContent = typeof window.t === 'function' ? window.t(key) : (isOpenMode ? 'Open in App' : 'Install App');
    }
    installAppButton.hidden = false;
}

function showInstallAppButton() { setInstallAppButton('install'); }
function showOpenAppButton() { setInstallAppButton('open'); }

async function detectInstalledPwa() {
    if (!installAppButton) return false;

    // A standalone window is already the installed app: never show Install.
    if (isRunningAsInstalledApp()) {
        hideInstallAppButton();
        return true;
    }

    // appinstalled is a durable signal across browser refreshes.
    try {
        if (localStorage.getItem(PWA_INSTALLED_KEY) === '1') {
            showOpenAppButton();
            return true;
        }
    } catch (_) {}

    // Also detect installations made before this code was deployed.
    if (typeof navigator.getInstalledRelatedApps === 'function') {
        try {
            const apps = await navigator.getInstalledRelatedApps();
            if (apps.some(app => app.platform === 'webapp')) {
                try { localStorage.setItem(PWA_INSTALLED_KEY, '1'); } catch (_) {}
                showOpenAppButton();
                return true;
            }
        } catch (error) {
            console.debug('Installed PWA detection is unavailable:', error);
        }
    }

    if (deferredInstallPrompt || supportsWebInstall) {
        showInstallAppButton();
    } else {
        hideInstallAppButton();
    }
    return false;
}

if (installAppButton) {
    installAppButton.hidden = true;
    installAppButton.dataset.mode = 'install';
    installAppButton.addEventListener('click', (event) => {
        if (installAppButton.dataset.mode === 'install') {
            event.preventDefault();
            installWebApp();
            return;
        }
        if (typeof closeNavMenu === 'function') closeNavMenu();
    });
}

window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    if (!isRunningAsInstalledApp()) {
        // Do not override a confirmed installed state.
        let alreadyInstalled = false;
        try { alreadyInstalled = localStorage.getItem(PWA_INSTALLED_KEY) === '1'; } catch (_) {}
        if (!alreadyInstalled) showInstallAppButton();
    }
});

window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    try { localStorage.setItem(PWA_INSTALLED_KEY, '1'); } catch (_) {}
    showOpenAppButton();
});

async function installWebApp() {
    closeNavMenu();

    if (!installAppButton || installAppButton.getAttribute('aria-disabled') === 'true') return;

    installAppButton.setAttribute('aria-disabled', 'true');
    try {
        if (supportsWebInstall) {
            await navigator.install();
            try { localStorage.setItem(PWA_INSTALLED_KEY, '1'); } catch (_) {}
            showOpenAppButton();
        } else if (deferredInstallPrompt) {
            const promptEvent = deferredInstallPrompt;
            deferredInstallPrompt = null;
            await promptEvent.prompt();
            const choice = await promptEvent.userChoice;
            if (choice && choice.outcome === 'accepted') {
                try { localStorage.setItem(PWA_INSTALLED_KEY, '1'); } catch (_) {}
                showOpenAppButton();
            } else if (!deferredInstallPrompt) {
                hideInstallAppButton();
            }
        }
    } catch (error) {
        if (!error || error.name !== 'AbortError') {
            console.error('PWA installation could not start:', error);
        }
    } finally {
        installAppButton.removeAttribute('aria-disabled');
    }
}

detectInstalledPwa();

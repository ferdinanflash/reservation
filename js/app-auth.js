// ================= AUTH =================
// Footer info (president/guild name) and the staff/President login,
// logout, and session handling.
// Part of the app script, split out of the old single script.js.
// Load order matters: see the <script> tags in index.html.

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


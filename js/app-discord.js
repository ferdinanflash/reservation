/*
 * 3475 SOURCE OWNERSHIP
 * Copyright (c) 2026 Ferdinan | https://3475.web.id
 * Proprietary source code. All rights reserved.
 *
 * President UI for configuring multiple Discord guilds and sending
 * per-guild announcements. Uses server-side Edge Functions only.
 */
(() => {
    const $ = (id) => document.getElementById(id);
    let guilds = [];
    let subscriptions = [];
    let newReservationNotificationsEnabled = true;

    function api(action, extra = {}) {
        const client = getSupabase();
        if (!client) throw new Error("Supabase is not available");
        return client.functions.invoke("discord-guild-settings", { body: { action, ...extra } });
    }

    function closeModal(id) {
        $(id)?.classList.add("hidden");
    }

    function openDiscordSettingsModal() {
        if (!isAdmin) return;
        closeModal("president-panel-modal");
        $("discord-settings-modal")?.classList.remove("hidden");
        loadGuilds();
    }

    function openDiscordComposerModal() {
        if (!isAdmin) return;
        closeModal("president-panel-modal");
        $("discord-composer-modal")?.classList.remove("hidden");
        $("discord-announcement-title").value = "";
        $("discord-announcement-message").value = "";
        $("discord-mention-everyone").checked = false;
        loadGuilds();
    }

    async function loadGuilds() {
        const list = $("discord-guild-list");
        if (!list) return;
        list.innerHTML = `<p class="redeem-hint">${t("discord_loading_servers")}</p>`;
        const subscriptionList = $("discord-subscription-list");
        if (subscriptionList) subscriptionList.innerHTML = `<p class="redeem-hint">Loading subscriptions…</p>`;
        try {
            const { data, error } = await api("list");
            if (error) throw error;
            guilds = Array.isArray(data?.guilds) ? data.guilds : [];
            subscriptions = Array.isArray(data?.subscriptions) ? data.subscriptions : [];
            newReservationNotificationsEnabled = data?.new_reservation_notifications_enabled !== false;
            const newReservationToggle = $("discord-new-reservation-toggle");
            if (newReservationToggle) newReservationToggle.checked = newReservationNotificationsEnabled;
            renderGuildList();
            renderSubscriptionList();
            renderGuildSelect();
        } catch (error) {
            console.error("Unable to load Discord guild settings:", error);
            list.innerHTML = `<p class="redeem-hint">${t("discord_load_failed")}</p>`;
            if (subscriptionList) subscriptionList.innerHTML = `<p class="redeem-hint">Unable to load subscriptions.</p>`;
        }
    }

    async function updateNewReservationNotifications() {
        if (!isAdmin) return;
        const toggle = $("discord-new-reservation-toggle");
        if (!toggle) return;
        const requestedValue = toggle.checked;
        toggle.disabled = true;
        try {
            const { data, error } = await api("set_new_reservation_notifications", { enabled: requestedValue });
            if (error) {
                let message = "";
                try { message = (await error.context?.clone?.().json())?.error || ""; } catch (_) {}
                throw new Error(message || error.message || "Save failed");
            }
            newReservationNotificationsEnabled = data?.enabled === true;
            toggle.checked = newReservationNotificationsEnabled;
            showToast(newReservationNotificationsEnabled
                ? "New Reservation Request notifications enabled in all Discord channels."
                : "New Reservation Request notifications disabled in all Discord channels.", "success");
        } catch (error) {
            console.error("Unable to update global Discord reservation notification setting:", error);
            toggle.checked = newReservationNotificationsEnabled;
            showToast("Unable to update notification setting. Please try again.", "error");
        } finally {
            toggle.disabled = false;
        }
    }

    function renderGuildList() {
        const list = $("discord-guild-list");
        if (!list) return;
        if (!guilds.length) {
            list.innerHTML = `<p class="redeem-hint">${t("discord_no_servers")}</p>`;
            return;
        }
        list.innerHTML = guilds.map((g) => `
            <div class="discord-guild-card">
                <div class="discord-guild-card-main">
                    <strong>${escapeHtml(g.guild_name)}</strong>
                    <small>${escapeHtml(g.guild_id)}</small>
                    <small>${t("discord_channel_prefix")}: ${escapeHtml(g.announcement_channel_id)}</small>
                    <span class="discord-guild-status ${g.announcements_enabled ? "is-enabled" : ""}">${g.announcements_enabled ? t("discord_enabled") : t("discord_disabled")} · @everyone ${g.allow_everyone ? t("discord_allowed") : t("discord_blocked")}</span>
                </div>
                <div class="discord-guild-card-actions">
                    <button type="button" class="btn-back discord-history-btn" data-guild="${escapeHtml(g.guild_id)}">${t("discord_history")}</button>
                    <button type="button" class="btn-back discord-edit-btn" data-guild="${escapeHtml(g.guild_id)}">${t("discord_edit")}</button>
                    <button type="button" class="btn-back discord-delete-btn" data-guild="${escapeHtml(g.guild_id)}">${t("discord_remove")}</button>
                </div>
            </div>`).join("");
        list.querySelectorAll(".discord-edit-btn").forEach((btn) => btn.addEventListener("click", () => {
            const g = guilds.find((item) => item.guild_id === btn.dataset.guild);
            if (!g) return;
            $("discord-guild-id").value = g.guild_id;
            $("discord-guild-id").readOnly = true;
            $("discord-guild-name").value = g.guild_name;
            $("discord-channel-id").value = g.announcement_channel_id;
            $("discord-enabled").checked = !!g.announcements_enabled;
            $("discord-allow-everyone").checked = !!g.allow_everyone;
            $("discord-save-btn").textContent = t("discord_update_server");
            $("discord-guild-name").focus();
        }));
        list.querySelectorAll(".discord-delete-btn").forEach((btn) => btn.addEventListener("click", async () => {
            if (!confirm(t("discord_confirm_remove"))) return;
            try {
                const { error } = await api("delete", { guild_id: btn.dataset.guild });
                if (error) throw error;
                await loadGuilds();
                showToast(t("discord_server_removed"), "success");
            } catch (error) {
                console.error(error);
                showToast(t("discord_save_failed"), "error");
            }
        }));
        list.querySelectorAll(".discord-history-btn").forEach((btn) => btn.addEventListener("click", () => loadHistory(btn.dataset.guild)));
    }

    function renderSubscriptionList() {
        const list = $("discord-subscription-list");
        const count = $("discord-subscription-count");
        if (!list) return;
        if (count) count.textContent = String(subscriptions.length);
        if (!subscriptions.length) {
            list.innerHTML = `<p class="redeem-hint">No active Reservation subscriptions yet. Use /subscribe in a Discord channel to add one.</p>`;
            return;
        }
        list.innerHTML = subscriptions.map((item) => `
            <article class="discord-subscription-card">
                <div class="discord-subscription-main">
                    <strong><span aria-hidden="true">🛡️</span> ${escapeHtml(item.guild_name || item.guild_id)}</strong>
                    <span class="discord-subscription-channel"># ${escapeHtml(item.channel_name || item.channel_id)}</span>
                    <small>Server ID: ${escapeHtml(item.guild_id)} · Channel ID: ${escapeHtml(item.channel_id)}</small>
                    <small>Subscribed ${item.created_at ? new Date(item.created_at).toLocaleString() : ""}</small>
                </div>
                <span class="discord-subscription-alliance">${escapeHtml(item.alliance)}</span>
            </article>`).join("");
    }
    function renderGuildSelect() {
        const select = $("discord-announcement-guild");
        if (!select) return;
        const previous = select.value;
        select.innerHTML = `<option value="">${t("discord_select_server")}</option>` + guilds
            .filter((g) => g.announcements_enabled)
            .map((g) => `<option value="${escapeHtml(g.guild_id)}">${escapeHtml(g.guild_name)}</option>`).join("");
        if (guilds.some((g) => g.guild_id === previous && g.announcements_enabled)) select.value = previous;
        const selected = guilds.find((g) => g.guild_id === select.value);
        $("discord-mention-everyone")?.toggleAttribute("disabled", !selected?.allow_everyone);
        if (!selected?.allow_everyone && $("discord-mention-everyone")) $("discord-mention-everyone").checked = false;
        select.onchange = () => {
            const g = guilds.find((item) => item.guild_id === select.value);
            $("discord-mention-everyone").disabled = !g?.allow_everyone;
            if (!g?.allow_everyone) $("discord-mention-everyone").checked = false;
        };
    }

    async function loadHistory(guildId) {
        const target = $("discord-history");
        if (!target) return;
        target.classList.remove("hidden");
        target.innerHTML = `<p class="redeem-hint">${t("discord_loading_history")}</p>`;
        try {
            const { data, error } = await api("history", { guild_id: guildId });
            if (error) throw error;
            const rows = data?.history || [];
            target.innerHTML = rows.length ? rows.map((row) => `
                <article class="discord-history-item">
                    <strong>${escapeHtml(row.title)}</strong>
                    <p>${escapeHtml(row.message)}</p>
                    <small>${new Date(row.created_at).toLocaleString()} · ${row.status === "sent" ? t("discord_status_sent") : t("discord_status_failed")} · ${row.mentioned_everyone ? "@everyone" : t("discord_no_mention")}${row.error_code ? " · " + escapeHtml(row.error_code) : ""}</small>
                </article>`).join("") : `<p class="redeem-hint">${t("discord_no_history")}</p>`;
        } catch (error) {
            console.error(error);
            target.innerHTML = `<p class="redeem-hint">${t("discord_history_failed")}</p>`;
        }
    }

    async function saveGuild() {
        if (!isAdmin) return;
        const payload = {
            guild_id: $("discord-guild-id").value.trim(),
            guild_name: $("discord-guild-name").value.trim(),
            channel_id: $("discord-channel-id").value.trim(),
            announcements_enabled: $("discord-enabled").checked,
            allow_everyone: $("discord-allow-everyone").checked,
        };
        if (!payload.guild_id || !payload.guild_name || !payload.channel_id) {
            showToast(t("discord_required_fields"), "warning");
            return;
        }
        const button = $("discord-save-btn");
        setButtonBusy(button, true, t("discord_save_server"));
        try {
            const { error } = await api("save", payload);
            if (error) {
                let message = "";
                try { message = (await error.context?.clone?.().json())?.error || ""; } catch (_) {}
                throw new Error(message || error.message || "Save failed");
            }
            $("discord-guild-form").reset();
            $("discord-guild-id").readOnly = false;
            button.textContent = t("discord_save_server");
            $("discord-history")?.classList.add("hidden");
            await loadGuilds();
            showToast(t("discord_server_saved"), "success");
        } catch (error) {
            console.error("Discord server save failed:", error);
            const msg = error.message === "bot_cannot_access_channel" ? t("discord_bot_channel_error")
                : error.message === "channel_mismatch_or_unsupported" ? t("discord_channel_mismatch")
                : t("discord_save_failed");
            showToast(msg, "error");
        } finally {
            setButtonBusy(button, false);
        }
    }

    async function sendDiscordAnnouncement() {
        if (!isAdmin) return;
        const guildId = $("discord-announcement-guild").value;
        const title = $("discord-announcement-title").value.trim();
        const message = $("discord-announcement-message").value.trim();
        const mentionEveryone = $("discord-mention-everyone").checked;
        if (!guildId || !message) {
            showToast(t("discord_announcement_required"), "warning");
            return;
        }
        const button = $("discord-announcement-send-btn");
        setButtonBusy(button, true, t("discord_sending"));
        try {
            const client = getSupabase();
            const { data, error } = await client.functions.invoke("discord-announcement", {
                body: { guild_id: guildId, title, message, mention_everyone: mentionEveryone }
            });
            if (error) {
                let detail = "";
                try { detail = (await error.context?.clone?.().json())?.error || ""; } catch (_) {}
                throw new Error(detail || error.message || "Send failed");
            }
            showToast(t("discord_announcement_sent"), "success");
            closeModal("discord-composer-modal");
        } catch (error) {
            console.error("Discord announcement failed:", error);
            showToast(error.message === "president_only" ? t("discord_president_only") : t("discord_announcement_failed"), "error");
        } finally {
            setButtonBusy(button, false);
        }
    }

    function resetGuildForm() {
        $("discord-guild-form")?.reset();
        $("discord-guild-id").readOnly = false;
        $("discord-save-btn").textContent = t("discord_save_server");
    }

    window.openDiscordSettingsModal = openDiscordSettingsModal;
    window.closeDiscordSettingsModal = () => closeModal("discord-settings-modal");
    window.openDiscordComposerModal = openDiscordComposerModal;
    window.closeDiscordComposerModal = () => closeModal("discord-composer-modal");
    window.saveDiscordGuild = saveGuild;
    window.updateNewReservationNotifications = updateNewReservationNotifications;
    window.sendDiscordAnnouncement = sendDiscordAnnouncement;
    window.resetDiscordGuildForm = resetGuildForm;
})();

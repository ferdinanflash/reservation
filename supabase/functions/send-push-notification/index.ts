/*
 * 3475 SOURCE OWNERSHIP
 * Copyright (c) 2026 Ferdinan | https://3475.web.id
 * Proprietary source code. All rights reserved. Unauthorized reuse is prohibited.
 */
// ================= SEND PUSH NOTIFICATION (Edge Function) =================
// Triggered by a Supabase Database Webhook on INSERT and UPDATE of public.reservation_slots.
// This is the piece that lets a notification reach the guest's device even
// when the app/browser is fully closed: the browser's own push service
// (e.g. FCM for Chrome/Edge, Mozilla's for Firefox, Apple's for Safari)
// delivers the message and wakes the service worker's 'push' handler,
// completely independent of any tab being open.
//
// Deploy:
// supabase functions deploy send-push-notification --no-verify-jwt
//
// Required secrets (set once):
// supabase secrets set VAPID_PUBLIC_KEY=...
// supabase secrets set VAPID_PRIVATE_KEY=...
// supabase secrets set VAPID_SUBJECT=mailto:you@example.com
// supabase secrets set WEBHOOK_SECRET=<a random string you invent>
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are already injected
// automatically for every Edge Function — no need to set them.)
//
// Then, in the Supabase Dashboard: Database -> Webhooks -> Create a new
// webhook -> table "reservation_slots" -> events "Insert" and "Update" -> type "Supabase
// Edge Function" -> function "send-push-notification" -> add HTTP header
// "x-webhook-secret: <the same random string>". That header is what stops
// randoms on the internet from hitting this endpoint and spamming pushes,
// since --no-verify-jwt is required for database webhooks to be able to
// call it at all.

import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN") ?? "";
const DISCORD_API = "https://discord.com/api/v10";
const DISCORD_SEND_MAX_ATTEMPTS = 4;
const DISCORD_SEND_TIMEOUT_MS = 15_000;

// IMPORTANT: web-push must be initialized with the VAPID identity before
// sendNotification() is called. Without this, every push send can fail even
// though subscriptions, the webhook, and the service worker are configured.
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        VAPID_SUBJECT,
        VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY
    );
}

const FINAL_STATUSES = ["accepted", "approved", "rejected"];
const WAITING_STATUSES = ["waiting", "pending"];

function normalizeStatus(status: unknown) {
    return String(status ?? "").trim().toLowerCase();
}

function statusText(status: string) {
    const normalized = normalizeStatus(status);
    if (normalized === "accepted" || normalized === "approved") return "Approved";
    if (normalized === "rejected") return "Rejected";
    if (normalized === "waiting" || normalized === "pending") return "Waiting";
    return String(status || "Updated");
}

// time_log is kept as JSONB and records the original submission as:
// { action: "created", detail: "HH:MM UTC", ... }.
// Reading it here lets us tell the applicant when an accepted reservation
// ended up in a different slot from the slot they originally requested.
function getTimeLog(record: any): any[] {
    let log = record?.time_log;
    if (typeof log === "string") {
        try { log = JSON.parse(log); } catch (_) { log = []; }
    }
    return Array.isArray(log) ? log : [];
}

function getOriginalTimeSlot(record: any, fallback = "") {
    const created = getTimeLog(record).find((entry) => String(entry?.action || "").toLowerCase() === "created");
    const detail = String(created?.detail || "");
    const match = detail.match(/\b([01]\d|2[0-3]):[0-5]\d\b/);
    return match ? match[0] : fallback;
}

function displayPlayerName(record: any) {
    const nickname = String(record?.nickname ?? "").trim();
    return nickname || "Player";
}

function getPositionDay(position: unknown) {
    const normalized = String(position ?? "").trim().toLowerCase();
    const positions: Record<string, string> = {
        "vice president d1": "VP D1 (Monday)",
        "vice president d2": "VP D2 (Tuesday)",
        "minister of education d4": "EDU D4 (Thursday)",
        "vice president d5": "VP D5 (Friday)",
    };
    return positions[normalized] || String(position ?? "").trim();
}

function cleanDetail(value: unknown) {
    return String(value ?? "").trim();
}

function getLatestLogEntry(record: any, actions: string[]) {
    const wanted = new Set(actions.map((a) => a.toLowerCase()));
    const log = getTimeLog(record);
    for (let i = log.length - 1; i >= 0; i--) {
        const action = String(log[i]?.action ?? "").trim().toLowerCase();
        if (wanted.has(action)) return log[i];
    }
    return null;
}

function extractReason(entry: any) {
    if (!entry) return "";
    const explicit = cleanDetail(entry.reason);
    if (explicit) return explicit;
    const detail = cleanDetail(entry.detail);
    const match = detail.match(/(?:reason|keterangan)\s*:\s*(.+)$/i);
    return match ? match[1].trim() : "";
}

function buildNotification(record: any, oldRecord: any) {
    const status = normalizeStatus(record?.status);
    const oldStatus = normalizeStatus(oldRecord?.status);
    const player = displayPlayerName(record);
    const oldTime = String(oldRecord?.time_slot ?? "").trim();
    const newTime = String(record?.time_slot ?? "").trim();
    const originalTime = getOriginalTimeSlot(record, getOriginalTimeSlot(oldRecord, oldTime));
    const latestMove = getLatestLogEntry(record, ["moved", "updated"]);
    const moveReason = extractReason(latestMove);
    const latestRejected = getLatestLogEntry(record, ["rejected", "status_rejected"]);
    const rejectionReason = extractReason(latestRejected);

    // 1) Waiting -> Waiting with a slot move.
    if (
        WAITING_STATUSES.includes(status) &&
        WAITING_STATUSES.includes(oldStatus) &&
        oldTime && newTime && oldTime !== newTime
    ) {
        const reasonLine = moveReason ? ` Reason: ${moveReason}` : "";
        return {
            title: `🎾 ${player} — Reservation Time Changed`,
            body: `Your reservation is still Waiting.\nSlot changed: ${oldTime} UTC → ${newTime} UTC.\nNew assigned slot: ${newTime} UTC.${reasonLine}`
        };
    }

    // 2) Accepted -> Accepted with a changed slot.
    if (
        (status === "accepted" || status === "approved") &&
        (oldStatus === "accepted" || oldStatus === "approved") &&
        oldTime && newTime && oldTime !== newTime
    ) {
        const reasonLine = moveReason ? ` Reason: ${moveReason}` : "";
        return {
            title: `🕒 ${player} — Accepted Reservation Time Changed`,
            body: `Your accepted reservation time has been changed.\nPrevious slot: ${oldTime} UTC.\nNew confirmed slot: ${newTime} UTC.${reasonLine}`
        };
    }

    // 3) Accepted with a slot different from the original submission.
    if (
        (status === "accepted" || status === "approved") &&
        newTime && originalTime && newTime !== originalTime
    ) {
        const reasonLine = moveReason ? ` Reason: ${moveReason}` : "";
        return {
            title: `🎉 ${player} — Reservation Approved`,
            body: `Your reservation has been approved with a different time slot.\nRequested slot: ${originalTime} UTC.\nConfirmed slot: ${newTime} UTC.${reasonLine}`
        };
    }

    // 3) Rejected.
    if (status === "rejected") {
        const reasonLine = rejectionReason ? ` Reason: ${rejectionReason}` : " Please check the reservation details for more information.";
        return {
            title: `❌ ${player} — Reservation Rejected`,
            body: `Your reservation request has been rejected.${reasonLine}`
        };
    }

    // Normal acceptance.
    if (status === "accepted" || status === "approved") {
        return {
            title: `🎉 ${player} — Reservation Approved`,
            body: newTime
                ? `Your reservation has been approved.\nConfirmed slot: ${newTime} UTC.`
                : "Your reservation has been approved. Please check the reservation schedule for the latest details."
        };
    }

    return {
        title: `🎾 ${player} — Reservation Update`,
        body: `Your reservation status is now ${statusText(record?.status)}.`
    };
}

async function fetchSubscriptions(applicationId: string) {
    const url = `${SUPABASE_URL}/rest/v1/push_subscriptions`
        + `?application_id=eq.${encodeURIComponent(applicationId)}`
        + `&select=id,subscription`;

    const response = await fetch(url, {
        headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
    });

    if (!response.ok) {
        console.error("Failed to fetch push subscriptions:", await response.text());
        return [];
    }
    return (await response.json()) as Array<{ id: string; subscription: unknown }>;
}

async function deleteStaleSubscriptions(ids: string[]) {
    if (!ids.length) return;
    const url = `${SUPABASE_URL}/rest/v1/push_subscriptions?id=in.(${ids.join(",")})`;
    await fetch(url, {
        method: "DELETE",
        headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
    }).catch((error) => console.error("Failed to delete stale subscriptions:", error));
}


function discordRetryDelay(response: Response | null, attempt: number): number {
    const retryAfterHeader = response?.headers.get("Retry-After");
    if (retryAfterHeader) {
        const seconds = Number(retryAfterHeader);
        const retryAt = Number.isFinite(seconds)
            ? Date.now() + Math.max(0, seconds) * 1000
            : Date.parse(retryAfterHeader);
        if (Number.isFinite(retryAt)) return Math.min(15_000, Math.max(500, retryAt - Date.now()));
    }
    return Math.min(8_000, 1000 * (2 ** attempt));
}

async function sendDiscordMessageWithRetry(channelId: string, payload: unknown): Promise<Response> {
    // Reuse one nonce across retries so Discord can deduplicate a message
    // whose first response was lost after the API accepted it.
    const idempotentPayload = {
        ...(payload as Record<string, unknown>),
        nonce: crypto.randomUUID().replace(/-/g, "").slice(0, 25),
        enforce_nonce: true,
    };
    let lastError: unknown = null;
    for (let attempt = 0; attempt < DISCORD_SEND_MAX_ATTEMPTS; attempt++) {
        let response: Response | null = null;
        try {
            response = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
                method: "POST",
                headers: { Authorization: "Bot " + DISCORD_BOT_TOKEN, "Content-Type": "application/json" },
                body: JSON.stringify(idempotentPayload),
                signal: AbortSignal.timeout(DISCORD_SEND_TIMEOUT_MS),
            });
            if (response.status !== 429 && response.status < 500) return response;
            if (attempt === DISCORD_SEND_MAX_ATTEMPTS - 1) {
                console.error("[send-push-notification] Discord send retries exhausted", {
                    attempts: DISCORD_SEND_MAX_ATTEMPTS,
                    httpStatus: response.status,
                });
                return response;
            }

            let retryAfter = response.headers.get("Retry-After");
            if (response.status === 429) {
                const body = await response.clone().json().catch(() => ({}));
                const seconds = Number(body?.retry_after);
                if (!retryAfter && Number.isFinite(seconds)) retryAfter = String(seconds);
            }
            const waitMs = discordRetryDelay(
                retryAfter ? new Response(null, { headers: { "Retry-After": retryAfter } }) : response,
                attempt,
            );
            console.warn("[send-push-notification] Discord send retry", {
                attempt: attempt + 1,
                nextAttempt: attempt + 2,
                maxAttempts: DISCORD_SEND_MAX_ATTEMPTS,
                reason: `http_${response.status}`,
                httpStatus: response.status,
                waitMs,
            });
            await new Promise((resolve) => setTimeout(resolve, waitMs));
        } catch (error) {
            lastError = error;
            if (attempt === DISCORD_SEND_MAX_ATTEMPTS - 1) {
                console.error("[send-push-notification] Discord send retries exhausted", {
                    attempts: DISCORD_SEND_MAX_ATTEMPTS,
                    reason: "network_error",
                    errorName: error instanceof Error ? error.name : "UnknownError",
                });
                break;
            }
            const waitMs = discordRetryDelay(null, attempt);
            console.warn("[send-push-notification] Discord send retry", {
                attempt: attempt + 1,
                nextAttempt: attempt + 2,
                maxAttempts: DISCORD_SEND_MAX_ATTEMPTS,
                reason: "network_error",
                errorName: error instanceof Error ? error.name : "UnknownError",
                waitMs,
            });
            await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
    }
    throw lastError instanceof Error ? lastError : new Error("Discord message delivery failed after retries");
}

// Get Notification is the guest's explicit opt-in. A push_subscriptions row
// exists only after that guest enabled notifications for this application.
// Alliance membership is looked up server-side by the reservation's Player ID.
async function sendAllianceDiscordNotification(record: any, notification: { title: string; body: string }, isNewReservation = false) {
    if (!DISCORD_BOT_TOKEN) {
        console.warn("Discord reservation notification skipped: DISCORD_BOT_TOKEN is not configured.");
        return { sent: 0, reason: "discord_not_configured" };
    }

    if (isNewReservation) {
        const settingQuery = new URLSearchParams({
            select: "enabled",
            setting_key: "eq.new_reservation_request",
            limit: "1",
        });
        const settingResponse = await fetch(SUPABASE_URL + "/rest/v1/discord_notification_settings?" + settingQuery, {
            headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: "Bearer " + SUPABASE_SERVICE_ROLE_KEY },
        });
        if (!settingResponse.ok) {
            console.error("Discord notification: failed to load global New Reservation Request setting:", settingResponse.status);
            return { sent: 0, reason: "global_notification_setting_unavailable" };
        }
        const settingRows = await settingResponse.json();
        if (Array.isArray(settingRows) && settingRows[0]?.enabled === false) {
            return { sent: 0, reason: "new_reservation_notifications_disabled" };
        }
    }

    const gameId = String(record?.game_id ?? "").trim();
    if (!/^[0-9]{4,20}$/.test(gameId)) return { sent: 0, reason: "missing_player_id" };

    const playerQuery = new URLSearchParams({
        select: "game_id,nickname,alliance",
        game_id: "eq." + gameId,
        limit: "1",
    });
    const playerResponse = await fetch(SUPABASE_URL + "/rest/v1/troops_power?" + playerQuery, {
        headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: "Bearer " + SUPABASE_SERVICE_ROLE_KEY },
    });
    if (!playerResponse.ok) {
        console.error("Discord notification: failed to verify Player ID in troops_power:", playerResponse.status);
        return { sent: 0, reason: "player_lookup_failed" };
    }
    const players = await playerResponse.json();
    const player = Array.isArray(players) ? players[0] : null;
    if (!player || String(player.game_id ?? "").trim() !== gameId) return { sent: 0, reason: "player_not_found" };

    const alliance = String(player.alliance ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9_-]{1,100}$/.test(alliance)) return { sent: 0, reason: "missing_or_invalid_alliance" };

    // Preserve President-managed guild destinations and add self-service channel subscriptions.
    const settingsQuery = new URLSearchParams({
        select: "guild_id,guild_name,announcement_channel_id,announcements_enabled",
        order: "created_at.asc",
    });
    const subscriptionsQuery = new URLSearchParams({
        select: "guild_id,channel_id,alliance",
        alliance: "eq." + alliance,
    });
    const [settingsResponse, subscriptionsResponse] = await Promise.all([
        fetch(SUPABASE_URL + "/rest/v1/discord_guild_settings?" + settingsQuery, {
            headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: "Bearer " + SUPABASE_SERVICE_ROLE_KEY },
        }),
        fetch(SUPABASE_URL + "/rest/v1/discord_reservation_subscriptions?" + subscriptionsQuery, {
            headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: "Bearer " + SUPABASE_SERVICE_ROLE_KEY },
        }),
    ]);
    if (!settingsResponse.ok) {
        console.error("Discord notification: failed to load configured guilds:", settingsResponse.status);
        return { sent: 0, reason: "guild_settings_failed", alliance };
    }
    if (!subscriptionsResponse.ok) {
        console.error("Discord notification: failed to load channel subscriptions:", subscriptionsResponse.status);
        return { sent: 0, reason: "subscription_lookup_failed", alliance };
    }

    const configuredGuilds = await settingsResponse.json();
    const subscriptions = await subscriptionsResponse.json();
    const destinations = new Map<string, { guild_id: string; channel_id: string }>();

    if (Array.isArray(configuredGuilds)) {
        for (const guild of configuredGuilds) {
            const channelId = String(guild?.announcement_channel_id ?? "").trim();
            if (String(guild?.guild_name ?? "").trim().toUpperCase() === alliance &&
                guild?.announcements_enabled !== false && /^[0-9]{17,20}$/.test(channelId)) {
                destinations.set(channelId, { guild_id: String(guild.guild_id), channel_id: channelId });
            }
        }
    }
    if (Array.isArray(subscriptions)) {
        for (const subscription of subscriptions) {
            const guildId = String(subscription?.guild_id ?? "").trim();
            const channelId = String(subscription?.channel_id ?? "").trim();
            if (String(subscription?.alliance ?? "").toUpperCase() === alliance &&
                /^[0-9]{17,20}$/.test(guildId) && /^[0-9]{17,20}$/.test(channelId)) {
                destinations.set(channelId, { guild_id: guildId, channel_id: channelId });
            }
        }
    }

    if (!destinations.size) return { sent: 0, reason: "no_matching_configured_channel", alliance };

    const playerName = String(player.nickname ?? record.nickname ?? "Player").trim() || "Player";
    const timeSlot = String(record.time_slot ?? "").trim();
    const status = String(record.status ?? "Updated").trim();
    const embed = {
        title: notification.title,
        description: notification.body,
        color: 0x5865F2,
        fields: [
            { name: "Player", value: playerName.slice(0, 256), inline: true },
            { name: "Player ID", value: gameId, inline: true },
            { name: "Alliance", value: alliance, inline: true },
            ...(getPositionDay(record.position) ? [{ name: "Position / Day", value: getPositionDay(record.position).slice(0, 256), inline: true }] : []),
            ...(timeSlot ? [{ name: "Reservation Slot", value: timeSlot + " UTC", inline: true }] : []),
            { name: "Status", value: status.slice(0, 256), inline: true },
        ],
        footer: { text: "State of 3475 • Reservation Portal" },
        timestamp: new Date().toISOString(),
    };

    let sent = 0;
    for (const destination of destinations.values()) {
        try {
            const sendResponse = await sendDiscordMessageWithRetry(destination.channel_id, {
                embeds: [embed],
                allowed_mentions: { parse: [] },
            });
            if (!sendResponse.ok) {
                const detail = await sendResponse.text().catch(() => "");
                console.error("Discord reservation notification failed:", {
                    guild_id: destination.guild_id, channel_id: destination.channel_id,
                    status: sendResponse.status, detail: detail.slice(0, 300),
                });
                continue;
            }
            sent++;
        } catch (error) {
            console.error("Discord reservation notification failed:", destination.guild_id, error);
        }
    }
    return { sent, reason: sent ? "sent" : "discord_send_failed", alliance };
}

Deno.serve(async (req: Request) => {
    if (req.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    if (!WEBHOOK_SECRET || req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
        return new Response("Forbidden", { status: 403 });
    }

    const pushConfigured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT);
    if (!pushConfigured) {
        console.warn("VAPID configuration is incomplete; Web Push will be skipped, but Discord routing can still run.");
    }

    let payload: any;
    try {
        payload = await req.json();
    } catch {
        return new Response("Invalid JSON", { status: 400 });
    }

    // Supabase Database Webhook payload shape:
    // { type: "INSERT" | "UPDATE", table, schema, record, old_record }
    const eventType = String(payload?.type ?? "").toUpperCase();
    if (!["INSERT", "UPDATE"].includes(eventType) || !payload?.record) {
        return new Response("Ignored (not an INSERT or UPDATE)", { status: 200 });
    }

    const record = payload.record;
    const isInsert = eventType === "INSERT";
    const oldRecord = payload.old_record ?? {};
    const newStatus = normalizeStatus(record.status);
    const oldStatus = normalizeStatus(oldRecord.status);
    const oldTime = String(oldRecord.time_slot ?? "").trim();
    const newTime = String(record.time_slot ?? "").trim();

    const statusChanged = newStatus !== oldStatus;
    const timeChanged = oldTime !== newTime;
    const waitingTimeMoved =
        WAITING_STATUSES.includes(newStatus) &&
        WAITING_STATUSES.includes(oldStatus) &&
        timeChanged;
    const acceptedTimeMoved =
        (newStatus === "accepted" || newStatus === "approved") &&
        (oldStatus === "accepted" || oldStatus === "approved") &&
        timeChanged;

    // Notify on final status changes OR slot moves while Waiting or Accepted.
    // This intentionally does not notify unrelated field edits.
    const shouldNotify = isInsert ||
        (statusChanged && FINAL_STATUSES.includes(newStatus)) ||
        waitingTimeMoved ||
        acceptedTimeMoved;

    if (!shouldNotify) {
        return new Response("Ignored (no notifiable reservation change)", { status: 200 });
    }

    const applicationId = String(record.id);
    const notification = isInsert
        ? {
            title: `🆕 ${displayPlayerName(record)} — New Reservation Request`,
            body: `A new reservation request has been submitted.\nRequested slot: ${newTime || "Not specified"} UTC.\nStatus: ${statusText(record.status)}.`
        }
        : buildNotification(record, oldRecord);

    // Discord routing is independent of Get Notification. New reservations
    // and qualifying updates are routed by the verified alliance to its
    // same-named channel in every configured Discord guild.
    const discordDelivery = await sendAllianceDiscordNotification(record, notification, isInsert)
        .catch((error) => {
            console.error("Discord reservation notification unexpectedly failed:", error);
            return { sent: 0, reason: "unexpected_error" };
        });

    // Log the routing result so HTTP 200 requests can be diagnosed.
    const discordResult = discordDelivery as {
        sent: number;
        reason: string;
        alliance?: string;
    };
    console.log("Reservation Discord delivery result", {
        eventType,
        applicationId,
        discordSent: discordResult.sent,
        discordReason: discordResult.reason,
        alliance: discordResult.alliance ?? null,
    });

    // New reservation submissions are Discord announcements. Get Notification
    // remains reserved for browser push on subsequent status/slot updates.
    if (isInsert) {
        return new Response(JSON.stringify({
            sent: 0,
            removed_stale: 0,
            push_reason: "new_reservation_discord_only",
            discord_sent: discordDelivery.sent,
            discord_reason: discordDelivery.reason
        }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // Get Notification controls browser push only. No subscription must never
    // prevent the independent Discord notification above.
    const subscriptions = await fetchSubscriptions(applicationId);
    if (!subscriptions.length || !pushConfigured) {
        return new Response(JSON.stringify({
            sent: 0,
            removed_stale: 0,
            push_reason: !pushConfigured ? "vapid_not_configured" : "no_get_notification_opt_in",
            discord_sent: discordDelivery.sent,
            discord_reason: discordDelivery.reason
        }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    const notificationPayload = JSON.stringify({
        title: notification.title,
        body: notification.body,
        application_id: applicationId,
        status: record.status,
        nickname: displayPlayerName(record),
        old_time_slot: oldTime || null,
        new_time_slot: newTime || null,
        original_time_slot: getOriginalTimeSlot(record, oldTime) || null,
        reason: extractReason(getLatestLogEntry(record, ["rejected", "status_rejected", "moved", "updated"])) || null
    });

    const staleIds: string[] = [];

    await Promise.all(subscriptions.map(async (row) => {
        try {
            await webpush.sendNotification(row.subscription as any, notificationPayload);
        } catch (error: any) {
            // 404/410 = the browser/OS has invalidated this subscription
            // (uninstalled, expired, etc.) — safe to delete it.
            if (error?.statusCode === 404 || error?.statusCode === 410) {
                staleIds.push(row.id);
            } else {
                console.error(`Push send failed for subscription ${row.id}:`, error?.body || error);
            }
        }
    }));

    await deleteStaleSubscriptions(staleIds);

    return new Response(JSON.stringify({
        sent: subscriptions.length - staleIds.length,
        removed_stale: staleIds.length,
        discord_sent: discordDelivery.sent,
        discord_reason: discordDelivery.reason
    }), { status: 200, headers: { "Content-Type": "application/json" } });
});

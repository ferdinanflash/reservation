/*
 * 3475 SOURCE OWNERSHIP
 * Copyright (c) 2026 Ferdinan | https://3475.web.id
 * Proprietary source code. All rights reserved. Unauthorized reuse is prohibited.
 */
// ================= SEND PUSH NOTIFICATION (Edge Function) =================
// Triggered by a Supabase Database Webhook on UPDATE of public.reservation_slots.
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
// webhook -> table "reservation_slots" -> event "Update" -> type "Supabase
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

    // 2) Accepted with a slot different from the original submission.
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


// Get Notification is the guest's explicit opt-in. A push_subscriptions row
// exists only after that guest enabled notifications for this application.
// Alliance membership is looked up server-side by the reservation's Player ID.
async function sendIdnAllianceDiscordNotification(record: any, notification: { title: string; body: string }) {
    if (!DISCORD_BOT_TOKEN) {
        console.warn("Discord reservation notification skipped: DISCORD_BOT_TOKEN is not configured.");
        return { sent: 0, reason: "discord_not_configured" };
    }

    const gameId = String(record?.game_id ?? "").trim();
    if (!/^\d{4,20}$/.test(gameId)) {
        console.info("Discord reservation notification skipped: missing or invalid Player ID.");
        return { sent: 0, reason: "missing_player_id" };
    }

    const playerQuery = new URLSearchParams({
        select: "game_id,nickname,alliance",
        game_id: "eq." + gameId,
        limit: "1",
    });
    const playerResponse = await fetch(SUPABASE_URL + "/rest/v1/troops_power?" + playerQuery, {
        headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: "Bearer " + SUPABASE_SERVICE_ROLE_KEY,
        },
    });
    if (!playerResponse.ok) {
        console.error("Discord notification: failed to verify Player ID in troops_power:", playerResponse.status);
        return { sent: 0, reason: "player_lookup_failed" };
    }

    const players = await playerResponse.json();
    const player = Array.isArray(players) ? players[0] : null;
    if (!player || String(player.game_id ?? "").trim() !== gameId) {
        console.info("Discord reservation notification skipped: Player ID not found in troops_power.");
        return { sent: 0, reason: "player_not_found" };
    }

    const alliance = String(player.alliance ?? "").trim().toUpperCase();
    if (alliance !== "IDN") {
        console.info("Discord reservation notification skipped: alliance is not IDN.", { gameId, alliance: alliance || "empty" });
        return { sent: 0, reason: "not_idn" };
    }

    const settingsQuery = new URLSearchParams({
        select: "guild_id,guild_name",
        announcements_enabled: "eq.true",
        order: "created_at.asc",
    });
    const settingsResponse = await fetch(SUPABASE_URL + "/rest/v1/discord_guild_settings?" + settingsQuery, {
        headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: "Bearer " + SUPABASE_SERVICE_ROLE_KEY,
        },
    });
    if (!settingsResponse.ok) {
        console.error("Discord reservation notification: failed to load configured guilds:", settingsResponse.status);
        return { sent: 0, reason: "guild_settings_failed" };
    }

    const guilds = await settingsResponse.json();
    if (!Array.isArray(guilds) || !guilds.length) {
        return { sent: 0, reason: "no_enabled_discord_guilds" };
    }

    let sent = 0;
    for (const guild of guilds) {
        try {
            const channelsResponse = await fetch(DISCORD_API + "/guilds/" + guild.guild_id + "/channels", {
                headers: { Authorization: "Bot " + DISCORD_BOT_TOKEN },
            });
            if (!channelsResponse.ok) {
                console.warn("Discord reservation notification: cannot list channels for configured guild.", {
                    guild_id: guild.guild_id,
                    status: channelsResponse.status,
                });
                continue;
            }

            const channels = await channelsResponse.json();
            const idnChannel = Array.isArray(channels)
                ? channels.find((channel: any) => channel?.name === "IDN" && [0, 5].includes(Number(channel?.type)))
                : null;
            if (!idnChannel) {
                console.info("Discord reservation notification skipped: no exact IDN text channel in guild.", guild.guild_id);
                continue;
            }

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
                    { name: "Alliance", value: "IDN", inline: true },
                    ...(timeSlot ? [{ name: "Reservation Slot", value: timeSlot + " UTC", inline: true }] : []),
                    { name: "Status", value: status.slice(0, 256), inline: true },
                ],
                footer: { text: "State of 3475 • Reservation Portal" },
                timestamp: new Date().toISOString(),
            };
            const sendResponse = await fetch(DISCORD_API + "/channels/" + idnChannel.id + "/messages", {
                method: "POST",
                headers: {
                    Authorization: "Bot " + DISCORD_BOT_TOKEN,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ embeds: [embed], allowed_mentions: { parse: [] } }),
            });
            if (!sendResponse.ok) {
                const detail = await sendResponse.text().catch(() => "");
                console.error("Discord IDN reservation notification failed:", sendResponse.status, detail.slice(0, 300));
                continue;
            }
            sent++;
        } catch (error) {
            console.error("Discord IDN reservation notification failed for guild:", guild.guild_id, error);
        }
    }

    return { sent, reason: sent ? "sent" : "no_matching_idn_channel" };
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
    // { type: "UPDATE", table, schema, record, old_record }
    if (payload?.type !== "UPDATE" || !payload?.record) {
        return new Response("Ignored (not an UPDATE)", { status: 200 });
    }

    const record = payload.record;
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

    // Notify on final status changes OR a slot move while still Waiting.
    // This intentionally does not notify unrelated field edits.
    const shouldNotify =
        (statusChanged && FINAL_STATUSES.includes(newStatus)) ||
        waitingTimeMoved;

    if (!shouldNotify) {
        return new Response("Ignored (no notifiable reservation change)", { status: 200 });
    }

    const applicationId = String(record.id);
    const notification = buildNotification(record, oldRecord);

    // Discord routing is independent of Get Notification. Every qualifying
    // reservation update is checked against troops_power; only confirmed IDN
    // players are sent to the configured guilds' exact "IDN" channels.
    const discordDelivery = await sendIdnAllianceDiscordNotification(record, notification)
        .catch((error) => {
            console.error("Discord reservation notification unexpectedly failed:", error);
            return { sent: 0, reason: "unexpected_error" };
        });

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

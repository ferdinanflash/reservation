/*
 * 3475 SOURCE OWNERSHIP
 * Copyright (c) 2026 Ferdinan | https://3475.web.id
 * Proprietary source code. All rights reserved. Unauthorized reuse is prohibited.
 *
 * Send a President-authorized announcement to one configured Discord server.
 * Deploy: supabase functions deploy discord-announcement
 *
 * Required secret: DISCORD_BOT_TOKEN
 * Standard Supabase runtime secrets are injected automatically.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN") ?? "";
const DISCORD_API = "https://discord.com/api/v10";
const ADMIN_EMAILS = new Set(["president", "demon", "phoenix"].map((name) => name + "@3475-staff.internal"));

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
}

async function authenticatedUserId(authHeader: string | null): Promise<string | null> {
    if (!authHeader || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
    try {
        const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: { Authorization: authHeader, apikey: SUPABASE_ANON_KEY },
        });
        if (!response.ok) return null;
        const user = await response.json();
        const email = String(user?.email ?? "").trim().toLowerCase();
        return typeof user?.id === "string" && ADMIN_EMAILS.has(email) ? user.id : null;
    } catch {
        return null;
    }
}

async function serviceRest(path: string, init: RequestInit = {}) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        ...init,
        headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
            ...(init.headers ?? {}),
        },
    });
    const text = await response.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!response.ok) throw new Error(`Database request failed (${response.status})`);
    return data;
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const userId = await authenticatedUserId(req.headers.get("Authorization"));
    if (!userId) return json({ error: "President login required" }, 403);

    if (!SUPABASE_SERVICE_ROLE_KEY || !DISCORD_BOT_TOKEN) {
        return json({ error: "Discord announcement service is not configured" }, 503);
    }

    let body: any;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

    const sendToAll = body?.send_to_all === true;
    const guildId = String(body?.guild_id ?? "").trim();
    const channelId = String(body?.channel_id ?? "").trim();
    const title = String(body?.title ?? "📢 Announcement").trim();
    const message = String(body?.message ?? "").trim();
    const wantsEveryone = body?.mention_everyone === true;

    if (!sendToAll && (!/^\d{17,20}$/.test(guildId) || !/^\d{17,20}$/.test(channelId))) {
        return json({ error: "Invalid Discord server or channel ID" }, 400);
    }
    if (!message || message.length > 1800) return json({ error: "Message is required (maximum 1,800 characters)" }, 400);
    if (title.length > 100) return json({ error: "Title must be 100 characters or fewer" }, 400);

    let subscriptions: any[] = [];
    try {
        subscriptions = await serviceRest(
            sendToAll
                ? "discord_reservation_subscriptions?select=guild_id,channel_id,channel_name&order=guild_id.asc,channel_id.asc"
                : `discord_reservation_subscriptions?select=guild_id,channel_id,channel_name&guild_id=eq.${guildId}&channel_id=eq.${channelId}&limit=1`,
        );
    } catch (error) {
        console.error("Discord subscription lookup failed:", error);
        return json({ error: "Unable to load subscribed Discord channels" }, 500);
    }

    // One delivery per unique channel, even when it subscribes to several alliances.
    const uniqueTargets = new Map<string, any>();
    for (const item of Array.isArray(subscriptions) ? subscriptions : []) {
        const targetGuildId = String(item.guild_id ?? "");
        const targetChannelId = String(item.channel_id ?? "");
        if (/^\d{17,20}$/.test(targetGuildId) && /^\d{17,20}$/.test(targetChannelId)) {
            uniqueTargets.set(`${targetGuildId}:${targetChannelId}`, {
                guild_id: targetGuildId, channel_id: targetChannelId, channel_name: item.channel_name ?? "",
            });
        }
    }
    const targets = [...uniqueTargets.values()];
    if (!targets.length) return json({ error: sendToAll ? "There are no active subscribed Discord channels" : "This channel is not actively subscribed to Reservation notifications" }, 404);

    let guildSettings: any[] = [];
    try {
        guildSettings = await serviceRest("discord_guild_settings?select=guild_id,guild_name,announcements_enabled,allow_everyone");
    } catch (error) {
        console.error("Discord server settings lookup failed:", error);
        return json({ error: "Unable to load Discord server configuration" }, 500);
    }
    const settingsByGuild = new Map(guildSettings.map((item) => [String(item.guild_id), item]));
    const eligibleTargets = targets.filter((target) => {
        const config = settingsByGuild.get(target.guild_id);
        return !config || config.announcements_enabled === true;
    });
    if (!eligibleTargets.length) return json({ error: "Announcements are disabled for all subscribed Discord servers" }, 403);
    if (wantsEveryone && eligibleTargets.some((target) => !settingsByGuild.get(target.guild_id)?.allow_everyone)) {
        return json({ error: "@everyone is not enabled in every selected Discord server" }, 403);
    }

    const results: any[] = [];
    for (const target of eligibleTargets) {
        const payload = {
            content: wantsEveryone ? "@everyone" : undefined,
            embeds: [{
                title: title || "📢 Announcement",
                description: message,
                color: 0x5865F2,
                footer: { text: "State of 3475 • Reservation Portal" },
                timestamp: new Date().toISOString(),
            }],
            allowed_mentions: { parse: wantsEveryone ? ["everyone"] : [] },
        };
        let discordMessage: any = null;
        let status: "sent" | "failed" = "failed";
        let errorCode: string | null = null;
        try {
            const response = await fetch(`${DISCORD_API}/channels/${target.channel_id}/messages`, {
                method: "POST",
                headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            discordMessage = await response.json().catch(() => ({}));
            if (response.ok) status = "sent";
            else errorCode = String(discordMessage?.code ?? response.status);
        } catch (error) {
            errorCode = "network_error";
            console.error("Discord announcement network error:", error);
        }

        results.push({ guild_id: target.guild_id, channel_id: target.channel_id, status, error_code: errorCode });
        try {
            await serviceRest("discord_announcement_log", {
                method: "POST",
                headers: { Prefer: "return=minimal" },
                body: JSON.stringify({
                    guild_id: target.guild_id, channel_id: target.channel_id,
                    title: title || "📢 Announcement", message, mentioned_everyone: wantsEveryone,
                    discord_message_id: discordMessage?.id ?? null, status, error_code: errorCode, sent_by: userId,
                }),
            });
        } catch (error) {
            console.error("Discord announcement audit write failed:", error);
        }
    }

    const sentCount = results.filter((item) => item.status === "sent").length;
    const failedCount = results.length - sentCount;
    return json({
        sent: sentCount > 0, sent_count: sentCount, failed_count: failedCount,
        total_targets: targets.length, skipped_count: targets.length - eligibleTargets.length,
        results,
    }, sentCount > 0 ? 200 : 502);
});

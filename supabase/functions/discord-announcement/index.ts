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

    const guildId = String(body?.guild_id ?? "").trim();
    const channelId = String(body?.channel_id ?? "").trim();
    const title = String(body?.title ?? "📢 Announcement").trim();
    const message = String(body?.message ?? "").trim();
    const wantsEveryone = body?.mention_everyone === true;

    if (!/^\d{17,20}$/.test(guildId) || !/^\d{17,20}$/.test(channelId)) return json({ error: "Invalid Discord server or channel ID" }, 400);
    if (!message || message.length > 1800) return json({ error: "Message is required (maximum 1,800 characters)" }, 400);
    if (title.length > 100) return json({ error: "Title must be 100 characters or fewer" }, 400);

    let settings: any[];
    try {
        settings = await serviceRest(
            `discord_guild_settings?select=guild_id,guild_name,announcement_channel_id,announcements_enabled,allow_everyone&guild_id=eq.${guildId}&limit=1`,
        );
    } catch (error) {
        console.error("Discord settings lookup failed:", error);
        return json({ error: "Unable to load Discord server configuration" }, 500);
    }

    const config = settings?.[0] ?? null;
    if (config && !config.announcements_enabled) return json({ error: "Announcements are disabled for this server" }, 403);

    // Only channels with an active /subscribe entry can receive President announcements.
    let activeSubscription: any[];
    try {
        activeSubscription = await serviceRest(
            `discord_reservation_subscriptions?select=channel_id&guild_id=eq.${guildId}&channel_id=eq.${channelId}&limit=1`,
        );
    } catch (error) {
        console.error("Discord subscription lookup failed:", error);
        return json({ error: "Unable to verify the subscribed channel" }, 500);
    }
    if (!Array.isArray(activeSubscription) || activeSubscription.length === 0) {
        return json({ error: "This channel is not actively subscribed to Reservation notifications" }, 403);
    }

    if (wantsEveryone && !config?.allow_everyone) {
        return json({ error: "@everyone is disabled by this server's configuration" }, 403);
    }

    const payload = {
        // Discord only reliably generates notifications for mentions in message content.
        // Keep the actual announcement in the embed, and place @everyone in content.
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

    let discordMessage: any;
    let status: "sent" | "failed" = "failed";
    let errorCode: string | null = null;
    try {
        const response = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
            method: "POST",
            headers: {
                Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });
        discordMessage = await response.json().catch(() => ({}));
        if (!response.ok) {
            errorCode = String(discordMessage?.code ?? response.status);
            console.error("Discord announcement send failed:", response.status, errorCode);
        } else {
            status = "sent";
        }
    } catch (error) {
        errorCode = "network_error";
        console.error("Discord announcement network error:", error);
    }

    try {
        await serviceRest("discord_announcement_log", {
            method: "POST",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({
                guild_id: guildId,
                channel_id: channelId,
                title: title || "📢 Announcement",
                message,
                mentioned_everyone: wantsEveryone,
                discord_message_id: discordMessage?.id ?? null,
                status,
                error_code: errorCode,
                sent_by: userId,
            }),
        });
    } catch (error) {
        // Do not misreport a Discord delivery as failed if only the audit write failed.
        console.error("Discord announcement audit write failed:", error);
    }

    if (status !== "sent") {
        return json({
            error: "Discord could not send the announcement. Check the bot's channel permissions.",
            discord_code: errorCode,
        }, 502);
    }

    return json({
        sent: true,
        guild_id: guildId,
        guild_name: config?.guild_name ?? guildId,
        channel_id: channelId,
        mentioned_everyone: wantsEveryone,
        message_id: discordMessage.id,
    });
});

import { checkDiscordChannelPermissions } from "../_shared/discord-permissions.ts";
/*
 * 3475 SOURCE OWNERSHIP
 * Copyright (c) 2026 Ferdinan | https://3475.web.id
 * Proprietary source code. All rights reserved.
 *
 * President-only management API for multi-server Discord announcements.
 * Deploy: supabase functions deploy discord-guild-settings
 * Required secret: DISCORD_BOT_TOKEN
 */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN") ?? "";
const DISCORD_API = "https://discord.com/api/v10";
const ADMIN_EMAILS = new Set(["president", "demon", "phoenix"].map((name) => name + "@3475-staff.internal"));
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
async function presidentId(auth: string | null): Promise<string | null> {
  if (!auth || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: auth, apikey: SUPABASE_ANON_KEY } });
    if (!r.ok) return null;
    const user = await r.json();
    const email = String(user?.email ?? "").trim().toLowerCase();
    return ADMIN_EMAILS.has(email) && typeof user?.id === "string" ? user.id : null;
  } catch { return null; }
}
async function db(path: string, init: RequestInit = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const raw = await r.text();
  let data: any = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!r.ok) throw new Error(`database_${r.status}`);
  return data;
}
async function discord(path: string) {
  const r = await fetch(`${DISCORD_API}${path}`, { headers: { Authorization: `Bot ${BOT_TOKEN}` } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`discord_${r.status}`);
  return data;
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);
  const userId = await presidentId(req.headers.get("Authorization"));
  if (!userId) return reply({ error: "president_only" }, 403);
  if (!SERVICE_KEY || !BOT_TOKEN) return reply({ error: "service_not_configured" }, 503);
  let input: any;
  try { input = await req.json(); } catch { return reply({ error: "invalid_json" }, 400); }
  const action = String(input?.action ?? "");
  try {
    if (action === "list") {
      const [rows, subscriptionRows, notificationSettings] = await Promise.all([
        db("discord_guild_settings?select=guild_id,guild_name,announcement_channel_id,announcements_enabled,allow_everyone,updated_at&order=created_at.desc"),
        db("discord_reservation_subscriptions?select=id,guild_id,channel_id,channel_name,alliance,subscribed_by,created_at,updated_at&order=created_at.desc"),
        db("discord_notification_settings?select=enabled&setting_key=eq.new_reservation_request&limit=1"),
      ]);
      const guilds = Array.isArray(rows) ? rows : [];
      const subscriptions = Array.isArray(subscriptionRows) ? subscriptionRows : [];
      const knownNames = new Map(guilds.map((guild: any) => [String(guild.guild_id), String(guild.guild_name ?? "")]));
      const unknownGuildIds = [...new Set(subscriptions
        .map((item: any) => String(item.guild_id ?? ""))
        .filter((id: string) => id && !knownNames.has(id)))];
      await Promise.all(unknownGuildIds.map(async (guildId) => {
        try {
          const guild = await discord(`/guilds/${guildId}?with_counts=false`);
          knownNames.set(guildId, String(guild?.name ?? ""));
        } catch (error) {
          console.warn("Unable to resolve subscribed Discord server name:", guildId, error);
        }
      }));
      const enrichedSubscriptions = subscriptions.map((item: any) => ({
        ...item,
        guild_name: knownNames.get(String(item.guild_id)) || String(item.guild_id),
        channel_name: String(item.channel_name ?? "").trim() || String(item.channel_id),
      }));
      const newReservationNotificationsEnabled = Array.isArray(notificationSettings)
        ? notificationSettings[0]?.enabled !== false
        : true;
      return reply({ guilds, subscriptions: enrichedSubscriptions, new_reservation_notifications_enabled: newReservationNotificationsEnabled });
    }
    if (action === "set_new_reservation_notifications") {
      if (typeof input?.enabled !== "boolean") return reply({ error: "invalid_enabled_value" }, 400);
      await db("discord_notification_settings?on_conflict=setting_key", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({
          setting_key: "new_reservation_request",
          enabled: input.enabled,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        }),
      });
      return reply({ saved: true, enabled: input.enabled });
    }
    if (action === "save") {
      const guildId = String(input?.guild_id ?? "").trim();
      const channelId = String(input?.channel_id ?? "").trim();
      const guildName = String(input?.guild_name ?? "").trim().slice(0, 100);
      if (!/^\d{17,20}$/.test(guildId) || !/^\d{17,20}$/.test(channelId) || !guildName) {
        return reply({ error: "invalid_guild_or_channel" }, 400);
      }
      // Verify channel ownership/type and effective bot permissions before saving.
      const channel = await discord(`/channels/${channelId}`);
      if (String(channel?.guild_id ?? "") !== guildId || ![0, 5].includes(Number(channel?.type))) {
        return reply({ error: "channel_mismatch_or_unsupported" }, 400);
      }
      const permissionCheck = await checkDiscordChannelPermissions(BOT_TOKEN, guildId, channelId, input?.allow_everyone === true);
      if (!permissionCheck.allowed) {
        return reply({ error: "bot_channel_permissions_missing", missing_permissions: permissionCheck.missing }, 400);
      }
      await db("discord_guild_settings?on_conflict=guild_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({
          guild_id: guildId,
          guild_name: guildName,
          announcement_channel_id: channelId,
          announcements_enabled: input?.announcements_enabled !== false,
          allow_everyone: input?.allow_everyone === true,
          configured_by: userId,
          updated_at: new Date().toISOString(),
        }),
      });
      return reply({ saved: true, guild_id: guildId });
    }
    if (action === "delete") {
      const guildId = String(input?.guild_id ?? "").trim();
      if (!/^\d{17,20}$/.test(guildId)) return reply({ error: "invalid_guild_id" }, 400);
      await db(`discord_guild_settings?guild_id=eq.${guildId}`, { method: "DELETE" });
      return reply({ deleted: true });
    }
    if (action === "queue_dashboard") {
      const statuses = ["pending", "processing", "sent", "failed"];
      const [counts, queue, activity] = await Promise.all([
        Promise.all(statuses.map(async (status) => {
          const response = await fetch(`${SUPABASE_URL}/rest/v1/discord_announcement_retry_queue?select=id&status=eq.${status}`, {
            method: "HEAD",
            headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: "count=exact" },
          });
          if (!response.ok) throw new Error(`database_${response.status}`);
          const range = response.headers.get("content-range") || "";
          const total = Number(range.split("/").pop());
          return { status, count: Number.isFinite(total) ? total : 0 };
        })),
        db("discord_announcement_retry_queue?select=id,guild_id,channel_id,title,status,attempts,max_attempts,next_attempt_at,locked_until,last_error,created_at,updated_at&order=created_at.desc&limit=30"),
        db("discord_announcement_log?select=id,guild_id,channel_id,title,status,error_code,created_at,discord_message_id&order=created_at.desc&limit=20"),
      ]);
      return reply({ counts, queue: queue ?? [], activity: activity ?? [] });
    }
    if (action === "retry_queue_item") {
      const id = String(input?.id ?? "").trim();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
        return reply({ error: "invalid_queue_id" }, 400);
      }
      const rows = await db(`discord_announcement_retry_queue?select=id,guild_id,channel_id,mentioned_everyone,status,attempts,max_attempts& id=eq.${id}&limit=1`.replace("& id=", "&id="));
      const item = Array.isArray(rows) ? rows[0] : null;
      if (!item || item.status !== "failed") return reply({ error: "queue_item_not_retryable" }, 409);
      const settingsRows = await db(`discord_guild_settings?select=announcements_enabled,allow_everyone&guild_id=eq.${item.guild_id}&limit=1`);
      const settings = Array.isArray(settingsRows) ? settingsRows[0] : null;
      if (!settings || settings.announcements_enabled !== true) return reply({ error: "announcements_disabled" }, 409);
      if (item.mentioned_everyone && settings.allow_everyone !== true) return reply({ error: "mention_everyone_disabled" }, 409);
      const permissions = await checkDiscordChannelPermissions(BOT_TOKEN, item.guild_id, item.channel_id, item.mentioned_everyone === true);
      if (!permissions.allowed) return reply({ error: "bot_channel_permissions_missing", missing_permissions: permissions.missing }, 409);
      await db(`discord_announcement_retry_queue?id=eq.${id}&status=eq.failed`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          status: "pending", attempts: 0, next_attempt_at: new Date().toISOString(),
          locked_until: null, lock_token: null, last_error: null, updated_at: new Date().toISOString(),
        }),
      });
      return reply({ retried: true, id });
    }
    if (action === "history") {
      const guildId = String(input?.guild_id ?? "").trim();
      if (!/^\d{17,20}$/.test(guildId)) return reply({ error: "invalid_guild_id" }, 400);
      const rows = await db(`discord_announcement_log?select=id,title,message,mentioned_everyone,status,error_code,created_at,discord_message_id&guild_id=eq.${guildId}&order=created_at.desc&limit=30`);
      return reply({ history: rows ?? [] });
    }
    return reply({ error: "unknown_action" }, 400);
  } catch (error) {
    const code = error instanceof Error ? error.message : "unknown_error";
    console.error("Discord guild settings request failed:", code);
    if (code.startsWith("discord_404") || code.startsWith("discord_403")) return reply({ error: "bot_cannot_access_channel" }, 400);
    if (code.startsWith("discord_")) return reply({ error: "discord_validation_failed" }, 400);
    return reply({ error: "request_failed" }, 500);
  }
});

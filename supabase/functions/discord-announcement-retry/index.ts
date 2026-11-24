import { checkDiscordChannelPermissions } from "../_shared/discord-permissions.ts";
/*
 * 3475 SOURCE OWNERSHIP
 * Durable retry worker for transient Discord Announcement failures.
 * Invoked by Supabase Cron using DISCORD_ANNOUNCEMENT_QUEUE_SECRET.
 */
const API = "https://discord.com/api/v10";
const MAX_BATCH = 10;
const MAX_ATTEMPTS = 10;

function env(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error("Missing " + name + " secret");
  return value;
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
function authHeaders() {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  return { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" };
}
async function rest(path: string, init: RequestInit = {}) {
  const response = await fetch(env("SUPABASE_URL").replace(/\/$/, "") + "/rest/v1/" + path, {
    ...init, headers: { ...authHeaders(), ...(init.headers ?? {}) },
  });
  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : null;
  if (!response.ok) throw new Error("database_" + response.status);
  return data;
}
function retryDelay(attempt: number) {
  return Math.min(3600000, 30000 * (2 ** Math.max(0, attempt - 1)));
}
async function checkSettings(item: any) {
  const rows = await rest("discord_guild_settings?select=announcements_enabled,allow_everyone&guild_id=eq." + item.guild_id + "&limit=1");
  const setting = Array.isArray(rows) ? rows[0] : null;
  if (!setting || setting.announcements_enabled !== true) throw new Error("announcements_disabled");
  if (item.mentioned_everyone && !setting?.allow_everyone) throw new Error("mention_everyone_disabled");
}
async function deliver(item: any) {
  await checkSettings(item);
  const permissions = await checkDiscordChannelPermissions(
    env("DISCORD_BOT_TOKEN"), item.guild_id, item.channel_id, item.mentioned_everyone === true,
  );
  if (!permissions.allowed) throw new Error("missing_permissions");
  const response = await fetch(API + "/channels/" + item.channel_id + "/messages", {
    method: "POST",
    headers: { Authorization: "Bot " + env("DISCORD_BOT_TOKEN"), "Content-Type": "application/json" },
    body: JSON.stringify({
      content: item.mentioned_everyone ? "@everyone" : undefined,
      embeds: [{
        title: item.title, description: item.message, color: 0x5865F2,
        footer: { text: "State of 3475 • Reservation Portal" }, timestamp: new Date().toISOString(),
      }],
      allowed_mentions: { parse: item.mentioned_everyone ? ["everyone"] : [] },
      nonce: item.nonce, enforce_nonce: true,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json().catch(() => ({}));
  if (response.ok) return { messageId: String(data?.id ?? "") };
  if (response.status === 408 || response.status === 429 || response.status >= 500) {
    throw new Error("transient_http_" + response.status);
  }
  throw new Error("discord_http_" + response.status);
}
async function update(item: any, patch: Record<string, unknown>) {
  await rest("discord_announcement_retry_queue?id=eq." + item.id + "&lock_token=eq." + item.lock_token, {
    method: "PATCH", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ ...patch, lock_token: null, locked_until: null, updated_at: new Date().toISOString() }),
  });
}
Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const expected = env("DISCORD_ANNOUNCEMENT_QUEUE_SECRET");
  if (req.headers.get("Authorization") !== "Bearer " + expected) return json({ error: "unauthorized" }, 401);
  if (!Deno.env.get("DISCORD_BOT_TOKEN")) return json({ error: "missing_bot_token" }, 503);
  // A worker crash on the final allowed attempt must not leave an item
  // permanently locked in "processing". Mark exhausted stale leases terminal.
  try {
    const stale = await rest("discord_announcement_retry_queue?select=id,attempts,max_attempts&status=eq.processing&locked_until=lt." + encodeURIComponent(new Date().toISOString()) + "&limit=100");
    for (const item of Array.isArray(stale) ? stale : []) {
      if (Number(item.attempts) < Number(item.max_attempts)) continue;
      await rest("discord_announcement_retry_queue?id=eq." + item.id + "&status=eq.processing", {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          status: "failed", lock_token: null, locked_until: null,
          last_error: "retry_lease_expired_max_attempts", updated_at: new Date().toISOString(),
        }),
      });
    }
  } catch (error) {
    console.warn("[discord-announcement-retry] stale_lease_recovery_failed", error instanceof Error ? error.message : "unknown");
  }
  let items: any[];
  try {
    items = await rest("rpc/claim_discord_announcement_retries", {
      method: "POST", body: JSON.stringify({ p_limit: MAX_BATCH, p_lock_seconds: 90 }),
    });
  } catch (error) {
    console.error("[discord-announcement-retry] claim_failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "claim_failed" }, 500);
  }
  const outcomes: any[] = [];
  for (const item of Array.isArray(items) ? items : []) {
    try {
      const result = await deliver(item);
      await update(item, { status: "sent", discord_message_id: result.messageId, sent_at: new Date().toISOString(), last_error: null });
      outcomes.push({ id: item.id, status: "sent", attempt: item.attempts });
    } catch (error) {
      const reason = error instanceof Error
        ? (error.name === "TimeoutError" || error instanceof TypeError ? "network_error" : error.message)
        : "delivery_failed";
      const retryable = reason.startsWith("transient_http_") || reason === "network_error" ||
        /^discord_(408|429|5[0-9][0-9])$/.test(reason) || /^database_(429|5[0-9][0-9])$/.test(reason);
      const terminal = !retryable || Number(item.attempts) >= Math.min(MAX_ATTEMPTS, Number(item.max_attempts));
      await update(item, terminal
        ? { status: "failed", last_error: reason }
        : { status: "pending", next_attempt_at: new Date(Date.now() + retryDelay(Number(item.attempts))).toISOString(), last_error: reason });
      console.warn("[discord-announcement-retry] delivery_failed", {
        id: item.id, attempt: item.attempts, terminal, reason,
      });
      outcomes.push({ id: item.id, status: terminal ? "failed" : "retry_scheduled", attempt: item.attempts });
    }
  }
  const summary = outcomes.reduce((acc: Record<string, number>, item: any) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});
  console.info("[discord-announcement-retry] batch_complete", { processed: outcomes.length, summary });
  return json({ processed: outcomes.length, summary, outcomes });
});

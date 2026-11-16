/*
 * 3475 SOURCE OWNERSHIP
 * Copyright (c) 2026 Ferdinan | https://3475.web.id
 * Proprietary source code. All rights reserved.
 *
 * Polls configured Discord text channels through the Discord REST API.
 * Invoked by Supabase Cron; no persistent Gateway worker is required.
 */

const DISCORD_API = "https://discord.com/api/v10";
const DEFAULT_CHANNEL_ID = "1570961739846262876";
const ALLIANCES = new Set(["ARX", "IDN", "ZXC", "VNX", "CAT"]);
const MAX_MEMBERS = 100;
const BATCH_DELAY_MS = 1200;

type Member = { fid: string; nickname: string };
type Outcome = { fid: string; nickname: string; kind: string; detail?: string };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function env(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing ${name} secret`);
  return value;
}

function supabaseHeaders() {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

function supabaseUrl() {
  return env("SUPABASE_URL").replace(/\/$/, "");
}

async function stateRequest(method: string, query: string, body?: unknown) {
  const response = await fetch(
    `${supabaseUrl()}/rest/v1/discord_message_poll_state?${query}`,
    {
      method,
      headers: {
        ...supabaseHeaders(),
        Prefer: "return=representation",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
  );
  if (!response.ok) {
    throw new Error(`Poll state database error (${response.status}): ${(await response.text()).slice(0, 180)}`);
  }
  return response.json();
}

async function channelStateRequest(method: string, query: string, body?: unknown) {
  const response = await fetch(
    `${supabaseUrl()}/rest/v1/discord_message_poll_channels?${query}`,
    {
      method,
      headers: {
        ...supabaseHeaders(),
        Prefer: "return=representation",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
  );
  if (!response.ok) {
    throw new Error(`Channel poll state database error (${response.status}): ${(await response.text()).slice(0, 180)}`);
  }
  return response.json();
}

function configuredChannelIds(): string[] {
  const configured = Deno.env.get("DISCORD_CHANNEL_IDS")?.trim();
  const ids = (configured ? configured.split(",") : [DEFAULT_CHANNEL_ID])
    .map((id) => id.trim())
    .filter(Boolean);
  const unique = [...new Set(ids)];
  if (!unique.length || unique.some((id) => !/^\d{17,20}$/.test(id))) {
    throw new Error("DISCORD_CHANNEL_IDS must be a comma-separated list of valid Discord channel IDs");
  }
  return unique;
}

async function getChannelCursor(channelId: string): Promise<string> {
  const rows = await channelStateRequest(
    "GET",
    `select=last_message_id&channel_id=eq.${channelId}`,
  );
  if (Array.isArray(rows) && rows.length) {
    return String(rows[0]?.last_message_id ?? "");
  }
  await channelStateRequest("POST", "", {
    channel_id: channelId,
    last_message_id: null,
  });
  return "";
}

async function enqueueMessageCleanup(channelId: string, messageIds: string[], deleteAfter: string) {
  if (!messageIds.length) return;
  const response = await fetch(
    `${supabaseUrl()}/rest/v1/discord_message_cleanup_queue?on_conflict=message_id`,
    {
      method: "POST",
      headers: {
        ...supabaseHeaders(),
        Prefer: "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify(messageIds.map((messageId) => ({
        channel_id: channelId,
        message_id: messageId,
        delete_after: deleteAfter,
      }))),
    },
  );
  if (!response.ok) {
    throw new Error(`Unable to schedule Discord message cleanup (${response.status}): ${(await response.text()).slice(0, 180)}`);
  }
}

async function removeCleanupQueueItem(messageId: string) {
  const response = await fetch(
    `${supabaseUrl()}/rest/v1/discord_message_cleanup_queue?message_id=eq.${encodeURIComponent(messageId)}`,
    { method: "DELETE", headers: supabaseHeaders() },
  );
  if (!response.ok) {
    throw new Error(`Unable to remove Discord cleanup queue item (${response.status})`);
  }
}

async function cleanupDueMessages() {
  const now = new Date().toISOString();
  const query = new URLSearchParams({
    select: "channel_id,message_id",
    delete_after: `lte.${now}`,
    order: "delete_after.asc",
    limit: "100",
  });
  const response = await fetch(
    `${supabaseUrl()}/rest/v1/discord_message_cleanup_queue?${query}`,
    { headers: supabaseHeaders() },
  );
  if (!response.ok) {
    throw new Error(`Unable to load Discord cleanup queue (${response.status})`);
  }
  const due = await response.json();
  if (!Array.isArray(due)) return;

  for (const item of due) {
    const channelId = String(item.channel_id ?? "");
    const messageId = String(item.message_id ?? "");
    if (!channelId || !messageId) continue;
    try {
      const deletion = await fetch(
        `${DISCORD_API}/channels/${channelId}/messages/${messageId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bot ${env("DISCORD_BOT_TOKEN")}` },
        },
      );
      // A message that was already deleted manually is considered complete.
      if (deletion.status === 204 || deletion.status === 404) {
        await removeCleanupQueueItem(messageId);
      } else {
        console.error(`Discord message cleanup deferred for ${messageId}: HTTP ${deletion.status}`);
      }
    } catch (error) {
      console.error(`Discord message cleanup failed for ${messageId}:`, error instanceof Error ? error.message : String(error));
    }
  }
}

async function discordRequest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${DISCORD_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${env("DISCORD_BOT_TOKEN")}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 240);
    throw new Error(`Discord API error (${response.status}): ${detail}`);
  }
  return response.status === 204 ? null : response.json();
}

async function sendChannelMessage(channelId: string, content: string): Promise<string> {
  const message = await discordRequest(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      content: content.slice(0, 1950),
      allowed_mentions: { parse: [] },
    }),
  }) as any;
  return String(message?.id ?? "");
}

async function sendLongResult(channelId: string, lines: string[]): Promise<string[]> {
  const messageIds: string[] = [];
  let chunk = "";
  for (const line of lines) {
    const candidate = chunk ? `${chunk}\n${line}` : line;
    if (candidate.length > 1850 && chunk) {
      const id = await sendChannelMessage(channelId, chunk);
      if (id) messageIds.push(id);
      chunk = line.slice(0, 1850);
    } else {
      chunk = candidate;
    }
  }
  if (chunk) {
    const id = await sendChannelMessage(channelId, chunk);
    if (id) messageIds.push(id);
  }
  return messageIds;
}

async function loadAllianceMembers(alliance: string): Promise<Member[]> {
  const anonKey = env("SUPABASE_ANON_KEY");
  const members: Member[] = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const query = new URLSearchParams({
      select: "game_id,nickname",
      alliance: `eq.${alliance}`,
      order: "game_id.asc",
      limit: String(pageSize),
      offset: String(offset),
    });
    const response = await fetch(`${supabaseUrl()}/rest/v1/troops_power?${query}`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      throw new Error(`Unable to load alliance roster (${response.status}): ${(await response.text()).slice(0, 160)}`);
    }
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error("Invalid alliance roster response");

    for (const row of rows) {
      const fid = String(row?.game_id ?? "").trim();
      if (!/^[0-9]{4,20}$/.test(fid)) continue;
      if (!members.some((member) => member.fid === fid)) {
        members.push({ fid, nickname: String(row?.nickname ?? "").trim() });
      }
    }
    if (rows.length < pageSize || members.length >= MAX_MEMBERS) break;
  }
  return members.slice(0, MAX_MEMBERS);
}

async function redeemOne(fid: string, code: string): Promise<Outcome["kind"]> {
  const anonKey = env("SUPABASE_ANON_KEY");
  for (let attempt = 0; attempt <= 2; attempt++) {
    let response: Response;
    try {
      response = await fetch(`${supabaseUrl()}/functions/v1/redeem-giftcode`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ action: "redeem", fid, cdk: code }),
      });
    } catch {
      return "error";
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return "error";
    let data = result?.data && typeof result.data === "object" ? result.data : {};
    // Some upstream responses wrap the actual result one level deeper.
    // Upstream payloads may contain a `data` array (often empty).
    // Only unwrap an object payload; never mistake that array for the result envelope.
    if (data.data && typeof data.data === "object" && !Array.isArray(data.data)) data = data.data;
    const message = String(data.msg ?? data.message ?? result?.error ?? "").trim().toUpperCase().replace(/[.]+$/, "");
    const errCode = Number(data.err_code);
    if (result?.ok === true && message === "SUCCESS") return "success";
    if (errCode === 40011 || message === "RECEIVED" || message === "SAME TYPE EXCHANGE") return "already";
    if (message.startsWith("CDK NOT FOUND") || message === "NOT FOUND") return "invalid";
    // Century Games identifies expired/not-yet-valid codes with err_code 40007.
    if (errCode === 40007 || message.startsWith("TIME ERROR")) return "expired";
    if (message === "USAGE LIMIT" || message === "USED") return "limit";
    if (message.startsWith("TIMEOUT")) {
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }
      return "timeout";
    }
    if (message.startsWith("USER INFO ERROR")) return "bad_fid";
    return "error";
  }
  return "timeout";
}

function resultLabel(kind: string) {
  switch (kind) {
    case "success": return "✅ Successful";
    case "already": return "ℹ️ Already claimed";
    case "invalid": return "❌ Invalid gift code";
    case "expired": return "⌛ Gift code expired";
    case "limit": return "⚠️ Usage limit reached";
    case "bad_fid": return "❌ Player ID not found";
    case "timeout": return "⚠️ Timed out; result not confirmed";
    case "skipped": return "⏭️ Skipped because the batch was stopped";
    default: return "❌ Failed";
  }
}

async function processCommand(channelId: string, allianceInput: string, code: string) {
  const alliance = allianceInput.trim().toUpperCase();
  if (!ALLIANCES.has(alliance)) {
    await sendChannelMessage(channelId, "❌ Alliance tidak valid. Gunakan ARX, IDN, ZXC, VNX, atau CAT.");
    return;
  }
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(code)) {
    await sendChannelMessage(channelId, "❌ Format gift code tidak valid (maksimal 40 karakter).");
    return;
  }

  const members = await loadAllianceMembers(alliance);
  if (!members.length) {
    await sendChannelMessage(channelId, `❌ Tidak ditemukan Player ID untuk alliance **${alliance}**.`);
    return;
  }

  const cleanupMessageIds: string[] = [];
  const progressMessageId = await sendChannelMessage(channelId, `🎁 **3475 REDEEM — ALLIANCE ${alliance}**\nGift Code: **${code}**\nMemproses ${members.length} player...`);
  if (progressMessageId) cleanupMessageIds.push(progressMessageId);
  const results: Outcome[] = [];

  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    const kind = await redeemOne(member.fid, code);
    results.push({ fid: member.fid, nickname: member.nickname, kind });

    if (kind === "invalid" || kind === "expired" || kind === "timeout" || kind === "error") {
      const skipped = members.slice(i + 1);
      for (const item of skipped) {
        results.push({
          fid: item.fid,
          nickname: item.nickname,
          kind: "skipped",
        });
      }
      break;
    }
    if (i < members.length - 1) await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
  }

  const successful = results.filter((item) => item.kind === "success").length;
  const already = results.filter((item) => item.kind === "already").length;
  const expired = results.filter((item) => item.kind === "expired").length;
  const invalid = results.filter((item) => item.kind === "invalid").length;
  const skipped = results.filter((item) => item.kind === "skipped").length;
  const failed = results.filter((item) => !["success", "already", "expired", "invalid", "skipped"].includes(item.kind)).length;
  const lines = [
    `🎁 **3475 REDEEM RESULTS — ${alliance}**`,
    `Gift Code: **${code}**`,
    `Total: **${results.length}** | Successful: **${successful}** | Already Claimed: **${already}** | Expired: **${expired}** | Invalid: **${invalid}** | Skipped: **${skipped}** | Failed: **${failed}**`,
    ...(members.length >= MAX_MEMBERS ? ["⚠️ Roster dibatasi maksimal 100 player per proses."] : []),
    ...results.map((item) => {
      const name = item.nickname ? `**${item.nickname.replace(/[\r\n]/g, " ").slice(0, 50)}**` : `FID ${item.fid}`;
      return `• ${name} (${item.fid}) — ${resultLabel(item.kind)}`;
    }),
  ];
  cleanupMessageIds.push(...await sendLongResult(channelId, lines));

  // Keep this command's bot messages for eight hours only when at least one
  // player was successfully redeemed. User messages are never queued.
  if (successful > 0 && cleanupMessageIds.length) {
    const deleteAfter = new Date(Date.now() + 8 * 60 * 60_000).toISOString();
    try {
      await enqueueMessageCleanup(channelId, cleanupMessageIds, deleteAfter);
    } catch (error) {
      // A cleanup scheduling failure must not change the redeem outcome.
      console.error("[discord-message-poller] unable to schedule result cleanup:", error instanceof Error ? error.message : String(error));
    }
  }
}

async function updateCursor(channelId: string, messageId: string) {
  await channelStateRequest("PATCH", `channel_id=eq.${channelId}`, {
    last_message_id: messageId,
    updated_at: new Date().toISOString(),
  });
}

Deno.serve(async (req) => {
  if (req.method === "GET") return json({ ok: true, service: "3475-discord-message-poller", channel_ids: configuredChannelIds() });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const expected = env("DISCORD_POLL_SECRET");
  const supplied = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!supplied || supplied !== expected) return json({ error: "unauthorized" }, 401);

  let locked = false;
  try {
    const now = new Date();
    const lockExpiry = new Date(now.getTime() + 5 * 60_000).toISOString();
    const lockFilter = `id=eq.1&or=(lock_until.is.null,lock_until.lt.${encodeURIComponent(now.toISOString())})`;
    const lockRows = await stateRequest("PATCH", lockFilter, { lock_until: lockExpiry });
    if (!Array.isArray(lockRows) || lockRows.length === 0) {
      return json({ ok: true, skipped: "already_running" });
    }
    locked = true;

    // Run due deletions on the same five-minute poll schedule.
    await cleanupDueMessages();

    const channelIds = configuredChannelIds();
    let scanned = 0;
    let commandProcessed = false;
    const initializedChannels: string[] = [];

    for (const channelId of channelIds) {
      const lastMessageId = await getChannelCursor(channelId);

      // Each newly configured channel gets its own baseline; older history is ignored.
      if (!lastMessageId) {
        const latest = await discordRequest(`/channels/${channelId}/messages?limit=1`) as any[];
        if (latest?.[0]?.id) await updateCursor(channelId, String(latest[0].id));
        initializedChannels.push(channelId);
        continue;
      }

      const messages = await discordRequest(
        `/channels/${channelId}/messages?after=${encodeURIComponent(lastMessageId)}&limit=100`,
      ) as any[];
      const ordered = (Array.isArray(messages) ? messages : []).sort((a, b) => {
        const left = BigInt(String(a.id));
        const right = BigInt(String(b.id));
        return left < right ? -1 : left > right ? 1 : 0;
      });

      for (const message of ordered) {
        scanned++;
        if (message.author?.bot || message.webhook_id) {
          await updateCursor(channelId, String(message.id));
          continue;
        }

        const content = String(message.content ?? "").trim();
        const command = content.match(/^\.redeem\s+([A-Za-z0-9_-]{2,12})\s+([A-Za-z0-9_-]{1,40})$/i);
        const looksLikeCommand = /^\.redeem(?:\s|$)/i.test(content);

        if (command) {
          try {
            await processCommand(channelId, command[1], command[2]);
          } catch (error) {
            console.error(`Redeem command failed in channel ${channelId}:`, error instanceof Error ? error.message : String(error));
            await sendChannelMessage(channelId, "❌ Proses redeem mengalami gangguan. Periksa log Supabase sebelum mengirim ulang perintah agar tidak terjadi redeem ganda.");
          }
          await updateCursor(channelId, String(message.id));
          commandProcessed = true;
          break;
        }
        if (looksLikeCommand) {
          await sendChannelMessage(channelId, "❌ Format salah. Gunakan: `.redeem ARX ABC123`");
          await updateCursor(channelId, String(message.id));
          commandProcessed = true;
          break;
        }
        await updateCursor(channelId, String(message.id));
      }
      // Process at most one alliance batch per Cron invocation.
      if (commandProcessed) break;
    }

    return json({
      ok: true,
      channels_checked: channelIds.length,
      initialized_channels: initializedChannels,
      scanned,
      command_processed: commandProcessed,
    });
  } catch (error) {
    console.error("[discord-message-poller]", error instanceof Error ? error.message : String(error));
    return json({ ok: false, error: "poll_failed", detail: error instanceof Error ? error.message : String(error) }, 500);
  } finally {
    if (locked) {
      try {
        await stateRequest("PATCH", "id=eq.1", { lock_until: null });
      } catch (error) {
        console.error("Unable to release Discord poll lock:", error);
      }
    }
  }
});

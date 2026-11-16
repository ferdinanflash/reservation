/*
 * 3475 SOURCE OWNERSHIP
 * Copyright (c) 2026 Ferdinan | https://3475.web.id
 * Proprietary source code. All rights reserved.
 *
 * Polls one dedicated Discord text channel through the Discord REST API.
 * Invoked by Supabase Cron; no persistent Gateway worker is required.
 */

const DISCORD_API = "https://discord.com/api/v10";
const CHANNEL_ID = "1570961739846262876";
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

async function sendChannelMessage(content: string) {
  await discordRequest(`/channels/${CHANNEL_ID}/messages`, {
    method: "POST",
    body: JSON.stringify({
      content: content.slice(0, 1950),
      allowed_mentions: { parse: [] },
    }),
  });
}

async function sendLongResult(lines: string[]) {
  let chunk = "";
  for (const line of lines) {
    const candidate = chunk ? `${chunk}\n${line}` : line;
    if (candidate.length > 1850 && chunk) {
      await sendChannelMessage(chunk);
      chunk = line.slice(0, 1850);
    } else {
      chunk = candidate;
    }
  }
  if (chunk) await sendChannelMessage(chunk);
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
    const response = await fetch(`${supabaseUrl()}/functions/v1/redeem-giftcode`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ action: "redeem", fid, cdk: code }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return "error";
    const data = result?.data && typeof result.data === "object" ? result.data : {};
    const message = String(data.msg ?? data.message ?? result?.error ?? "").trim().toUpperCase().replace(/[.]+$/, "");
    if (result?.ok === true && (message === "SUCCESS" || message === "SUCCESS")) return "success";
    if (Number(data.err_code) === 40011 || message === "RECEIVED" || message === "SAME TYPE EXCHANGE") return "already";
    if (message.startsWith("CDK NOT FOUND") || message === "NOT FOUND") return "invalid";
    if (message.startsWith("TIME ERROR")) return "expired";
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
    default: return "❌ Failed";
  }
}

async function processCommand(allianceInput: string, code: string) {
  const alliance = allianceInput.trim().toUpperCase();
  if (!ALLIANCES.has(alliance)) {
    await sendChannelMessage("❌ Alliance tidak valid. Gunakan ARX, IDN, ZXC, VNX, atau CAT.");
    return;
  }
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(code)) {
    await sendChannelMessage("❌ Format gift code tidak valid (maksimal 40 karakter).");
    return;
  }

  const members = await loadAllianceMembers(alliance);
  if (!members.length) {
    await sendChannelMessage(`❌ Tidak ditemukan Player ID untuk alliance **${alliance}**.`);
    return;
  }

  await sendChannelMessage(`🎁 **3475 REDEEM — ALLIANCE ${alliance}**\nGift Code: **${code}**\nMemproses ${members.length} player...`);
  const results: Outcome[] = [];

  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    const kind = await redeemOne(member.fid, code);
    results.push({ fid: member.fid, nickname: member.nickname, kind });

    if (kind === "invalid" || kind === "expired" || kind === "timeout") {
      const skipped = members.slice(i + 1);
      for (const item of skipped) {
        results.push({
          fid: item.fid,
          nickname: item.nickname,
          kind: "error",
          detail: "Skipped because the code is invalid, expired, or timed out.",
        });
      }
      break;
    }
    if (i < members.length - 1) await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
  }

  const successful = results.filter((item) => item.kind === "success").length;
  const already = results.filter((item) => item.kind === "already").length;
  const failed = results.length - successful - already;
  const lines = [
    `🎁 **3475 REDEEM RESULTS — ${alliance}**`,
    `Gift Code: **${code}**`,
    `Total: **${results.length}** | Successful: **${successful}** | Already Claimed: **${already}** | Failed: **${failed}**`,
    ...(members.length >= MAX_MEMBERS ? ["⚠️ Roster dibatasi maksimal 100 player per proses."] : []),
    ...results.map((item) => {
      const name = item.nickname ? `**${item.nickname.replace(/[\r\n]/g, " ").slice(0, 50)}**` : `FID ${item.fid}`;
      return `• ${name} (${item.fid}) — ${item.detail ?? resultLabel(item.kind)}`;
    }),
  ];
  await sendLongResult(lines);
}

async function updateCursor(messageId: string) {
  await stateRequest("PATCH", "id=eq.1", {
    last_message_id: messageId,
    updated_at: new Date().toISOString(),
  });
}

Deno.serve(async (req) => {
  if (req.method === "GET") return json({ ok: true, service: "3475-discord-message-poller", channel_id: CHANNEL_ID });
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

    const stateRows = await stateRequest("GET", "select=last_message_id&id=eq.1");
    const lastMessageId = String(stateRows?.[0]?.last_message_id ?? "");

    // On first run, establish a baseline and deliberately ignore old channel history.
    if (!lastMessageId) {
      const latest = await discordRequest(`/channels/${CHANNEL_ID}/messages?limit=1`) as any[];
      if (latest?.[0]?.id) await updateCursor(String(latest[0].id));
      return json({ ok: true, initialized: true, ignored_history: true });
    }

    const messages = await discordRequest(
      `/channels/${CHANNEL_ID}/messages?after=${encodeURIComponent(lastMessageId)}&limit=100`,
    ) as any[];
    const ordered = (Array.isArray(messages) ? messages : []).sort((a, b) => {
      const left = BigInt(String(a.id));
      const right = BigInt(String(b.id));
      return left < right ? -1 : left > right ? 1 : 0;
    });

    let scanned = 0;
    let commandProcessed = false;
    for (const message of ordered) {
      scanned++;
      if (message.author?.bot || message.webhook_id) {
        await updateCursor(String(message.id));
        continue;
      }

      const content = String(message.content ?? "").trim();
      const command = content.match(/^\.redeem\s+([A-Za-z0-9_-]{2,12})\s+([A-Za-z0-9_-]{1,40})$/i);
      const looksLikeCommand = /^\.redeem(?:\s|$)/i.test(content);

      if (command) {
        await processCommand(command[1], command[2]);
        await updateCursor(String(message.id));
        commandProcessed = true;
        break; // one redeem batch per cron invocation
      }
      if (looksLikeCommand) {
        await sendChannelMessage("❌ Format salah. Gunakan: `.redeem ARX ABC123`");
        await updateCursor(String(message.id));
        commandProcessed = true;
        break;
      }
      await updateCursor(String(message.id));
    }

    return json({ ok: true, scanned, command_processed: commandProcessed });
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

/*
 * 3475 SOURCE OWNERSHIP
 * Copyright (c) 2026 Ferdinan | https://3475.web.id
 * Proprietary source code. All rights reserved. Unauthorized reuse is prohibited.
 *
 * Discord interaction endpoint for public 3475 redeem commands.
 * Deploy: supabase functions deploy discord-interactions --no-verify-jwt
 */

const DISCORD_PUBLIC_KEY = "f78d1415e1c63c50cfc2595b21a35b2740d50fae3f06ec73241898145b883518";
const DISCORD_API = "https://discord.com/api/v10";
const ALLIANCES = new Set(["ARX", "IDN", "ZXC", "VNX", "CAT"]);
const BATCH_DELAY_MS = 1200;
const MAX_ALLIANCE_FIDS = 100;
const MAX_TIMEOUT_RETRIES = 2;

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

function hexToBytes(hex: string): Uint8Array {
    // Discord Ed25519 public keys are 32 bytes = 64 hexadecimal characters.
    if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error("Invalid Discord public key");
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return out;
}

async function verifyDiscordRequest(req: Request, rawBody: string): Promise<boolean> {
    const signature = req.headers.get("x-signature-ed25519") ?? "";
    const timestamp = req.headers.get("x-signature-timestamp") ?? "";
    if (!signature || !timestamp || !DISCORD_PUBLIC_KEY || !/^\d+$/.test(timestamp)) return false;

    // Reject stale signed payloads to reduce replay risk.
    const timestampAgeSeconds = Math.round(Date.now() / 1000 - Number(timestamp));
    if (Math.abs(timestampAgeSeconds) > 300) {
        console.error("Discord signature rejected: timestamp outside allowed window", {
            timestampAgeSeconds,
            bodyLength: rawBody.length,
        });
        return false;
    }

    try {
        const key = await crypto.subtle.importKey(
            "raw",
            hexToBytes(DISCORD_PUBLIC_KEY),
            { name: "Ed25519" },
            false,
            ["verify"],
        );
        if (!/^[0-9a-f]{128}$/i.test(signature)) {
            console.error("Discord signature rejected: malformed signature header", {
                signatureLength: signature.length,
                timestampAgeSeconds,
                bodyLength: rawBody.length,
            });
            return false;
        }
        const sig = Uint8Array.from(signature.match(/.{2}/g) ?? [], (byte) => parseInt(byte, 16));
        const verified = await crypto.subtle.verify(
            { name: "Ed25519" },
            key,
            sig,
            new TextEncoder().encode(timestamp + rawBody),
        );
        if (!verified) {
            console.error("Discord signature cryptographic mismatch", {
                signatureLength: signature.length,
                timestampAgeSeconds,
                bodyLength: rawBody.length,
            });
        }
        return verified;
    } catch (error) {
        console.error("Discord signature verification error:", error instanceof Error ? error.message : String(error));
        return false;
    }
}

function publicMessage(content: string) {
    return { type: 4, data: { content, allowed_mentions: { parse: [] } } };
}

function getCommandOptions(interaction: any): { subcommand: string; values: Record<string, unknown> } {
    const first = Array.isArray(interaction?.data?.options) ? interaction.data.options[0] : null;
    if (!first || !Array.isArray(first.options)) return { subcommand: "", values: {} };
    return {
        subcommand: String(first.name ?? ""),
        values: Object.fromEntries(first.options.map((option: any) => [option.name, option.value])),
    };
}

function supabaseConfig() {
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !anonKey) throw new Error("Supabase function configuration is missing");
    return { url: url.replace(/\/$/, ""), anonKey };
}

async function callRedeemFunction(action: "redeem", fid: string, cdk: string) {
    const { url, anonKey } = supabaseConfig();
    const response = await fetch(`${url}/functions/v1/redeem-giftcode`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "apikey": anonKey,
            "Authorization": `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ action, fid, cdk }),
    });
    const result = await response.json().catch(() => ({}));
    return { httpOk: response.ok, httpStatus: response.status, result };
}

async function loadPlayerNickname(fid: string): Promise<string> {
    const { url, anonKey } = supabaseConfig();
    const query = new URLSearchParams({
        select: "nickname",
        game_id: `eq.${fid}`,
        limit: "1",
    });
    const response = await fetch(`${url}/rest/v1/troops_power?${query}`, {
        headers: {
            "apikey": anonKey,
            "Authorization": `Bearer ${anonKey}`,
            "Accept": "application/json",
        },
    });
    if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`Unable to load player nickname (${response.status}): ${detail.slice(0, 120)}`);
    }
    const rows = await response.json();
    if (!Array.isArray(rows) || !rows.length) return "";
    return String(rows[0]?.nickname ?? "").trim();
}

async function loadAllianceMembers(alliance: string) {
    const { url, anonKey } = supabaseConfig();
    const members: Array<{ fid: string; nickname: string }> = [];
    const pageSize = 1000;

    for (let offset = 0; ; offset += pageSize) {
        const query = new URLSearchParams({
            select: "game_id,nickname",
            alliance: `eq.${alliance}`,
            order: "game_id.asc",
            limit: String(pageSize),
            offset: String(offset),
        });
        const response = await fetch(`${url}/rest/v1/troops_power?${query}`, {
            headers: {
                "apikey": anonKey,
                "Authorization": `Bearer ${anonKey}`,
                "Accept": "application/json",
            },
        });
        if (!response.ok) {
            const detail = await response.text().catch(() => "");
            throw new Error(`Unable to load alliance roster (${response.status}): ${detail.slice(0, 160)}`);
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

        if (rows.length < pageSize || members.length >= MAX_ALLIANCE_FIDS) break;
    }

    return members.slice(0, MAX_ALLIANCE_FIDS);
}

function upstreamData(result: any) {
    return result?.data && typeof result.data === "object" ? result.data : {};
}

function upstreamMessage(result: any): string {
    const data = upstreamData(result);
    return String(data.msg ?? data.message ?? result?.error ?? "").trim();
}

function isUpstreamSuccess(result: any): boolean {
    const data = upstreamData(result);
    const msg = String(data.msg ?? "").trim().toUpperCase();
    return result?.ok === true &&
        (data.err_code === 0 || data.code === 0 || msg === "SUCCESS" || msg === "SUCCESS.");
}

function resultKind(result: any): "success" | "already" | "invalid" | "expired" | "limit" | "bad_fid" | "error" | "timeout" {
    if (result?.__httpOk === false) return "error";
    const msg = upstreamMessage(result).toUpperCase();
    if (isUpstreamSuccess(result)) return "success";
    if (msg.startsWith("USER INFO ERROR")) return "bad_fid";
    if (msg === "RECEIVED" || msg === "SAME TYPE EXCHANGE") return "already";
    if (msg.startsWith("CDK NOT FOUND") || msg === "NOT FOUND") return "invalid";
    if (msg.startsWith("TIME ERROR")) return "expired";
    if (msg === "USAGE LIMIT" || msg === "USED") return "limit";
    if (msg.startsWith("TIMEOUT")) return "timeout";
    return "error";
}

function resultLabel(kind: ReturnType<typeof resultKind>, result: any): string {
    switch (kind) {
        case "success": return "✅ Successful";
        case "already": return "ℹ️ Already claimed";
        case "invalid": return "❌ Invalid gift code";
        case "expired": return "⌛ Gift code expired";
        case "limit": return "⚠️ Usage limit reached";
        case "bad_fid": return "❌ Player ID not found";
        case "timeout": return "⚠️ Timed out; result not confirmed";
        default: {
            const detail = upstreamMessage(result).replace(/[\\r\\n]+/g, " ").slice(0, 100);
            const status = result?.__httpStatus ? ` (HTTP ${result.__httpStatus})` : "";
            return detail
                ? `❌ Failed: Redeem service error${status} — ${detail}`
                : `❌ Failed: Redeem service returned an unexpected response${status}. No recognized result was provided.`;
        }
    }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function redeemOne(fid: string, code: string) {
    for (let attempt = 0; attempt <= MAX_TIMEOUT_RETRIES; attempt++) {
        const response = await callRedeemFunction("redeem", fid, code);
        const result = {
            ...response.result,
            __httpOk: response.httpOk,
            __httpStatus: response.httpStatus,
        };
        const kind = resultKind(result);
        if (kind !== "timeout") return { kind, result };
        if (attempt < MAX_TIMEOUT_RETRIES) await sleep(2000);
    }
    return { kind: "timeout" as const, result: {} };
}

async function editOriginal(applicationId: string, token: string, content: string) {
    const response = await fetch(`${DISCORD_API}/webhooks/${applicationId}/${token}/messages/@original`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.slice(0, 1990), allowed_mentions: { parse: [] } }),
    });
    if (!response.ok) console.error("Discord original response update failed:", response.status);
}

async function sendPublicFollowup(applicationId: string, token: string, content: string) {
    const response = await fetch(`${DISCORD_API}/webhooks/${applicationId}/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.slice(0, 1990), allowed_mentions: { parse: [] } }),
    });
    if (!response.ok) console.error("Discord public follow-up failed:", response.status);
}

function splitPublicLines(lines: string[], maxLength = 1450): string[] {
    const chunks: string[] = [];
    let current = "";
    for (const line of lines) {
        const next = current ? `${current}\n${line}` : line;
        if (next.length > maxLength && current) {
            chunks.push(current);
            current = line.slice(0, maxLength);
        } else {
            current = next;
        }
    }
    if (current) chunks.push(current);
    return chunks;
}

async function publishResults(interaction: any, heading: string, rows: Array<{ fid: string; nickname?: string; kind: string; result?: any }>, note = "", code = "") {
    const success = rows.filter((row) => row.kind === "success").length;
    const already = rows.filter((row) => row.kind === "already").length;
    const failed = rows.length - success - already;
    const lines = rows.map((row) => {
        const name = row.nickname ? `**${row.nickname.replace(/[\r\n]/g, " ").slice(0, 50)}**` : `FID ${row.fid}`;
        return `• ${name} (${row.fid}) — ${resultLabel(row.kind as any, row.result)}`;
    });
    const header = [
        `🎁 **3475 REDEEM — ${heading}**`,
        `Redeem Code: **${code}**`,
        `Total: **${rows.length}** | Successful: **${success}** | Already Claimed: **${already}** | Failed: **${failed}**`,
        note,
    ].filter(Boolean).join("\n");

    const chunks = splitPublicLines(lines);
    await editOriginal(interaction.application_id, interaction.token, [header, chunks[0] ?? "No results."].join("\n"));
    for (let i = 1; i < chunks.length; i++) {
        await sendPublicFollowup(interaction.application_id, interaction.token, `**Redeem Results — Continued (${i + 1}/${chunks.length})**\n${chunks[i]}`);
    }
}

async function publishProgress(
    interaction: any,
    heading: string,
    code: string,
    completed: Array<{ fid: string; nickname?: string; kind: string; result?: any }>,
    total: number,
) {
    const success = completed.filter((row) => row.kind === "success").length;
    const already = completed.filter((row) => row.kind === "already").length;
    const failed = completed.length - success - already;
    const lines = completed.map((row) => {
        const name = row.nickname ? `**${row.nickname.replace(/[\\r\\n]/g, " ").slice(0, 50)}**` : `FID ${row.fid}`;
        return `• ${name} (${row.fid}) — ${resultLabel(row.kind as any, row.result)}`;
    });
    const header = [
        `🎁 **3475 REDEEM — ${heading}**`,
        `Redeem Code: **${code}**`,
        `Progress: **${completed.length}/${total}** | Successful: **${success}** | Already Claimed: **${already}** | Failed: **${failed}**`,
        "",
    ].join("\\n");
    const visibleLines = splitPublicLines(lines, 1500);
    const content = header + (visibleLines[0] ?? "Processing...");
    await editOriginal(interaction.application_id, interaction.token, content);
}

async function processRedeem(interaction: any) {
    const { subcommand, values } = getCommandOptions(interaction);
    const code = String(values.code ?? "").trim();
    let members: Array<{ fid: string; nickname: string }> = [];
    let heading = "";

    if (!code || code.length > 40) {
        await editOriginal(interaction.application_id, interaction.token, "❌ Gift code is required and must be no more than 40 characters.");
        return;
    }

    if (subcommand === "single") {
        const fid = String(values.fid ?? "").trim();
        if (!/^[0-9]{4,20}$/.test(fid)) {
            await editOriginal(interaction.application_id, interaction.token, "❌ Player ID must contain 4–20 digits.");
            return;
        }
        let nickname = "";
        try {
            nickname = await loadPlayerNickname(fid);
        } catch (error) {
            // A nickname lookup must never block an otherwise valid redeem.
            console.error("Unable to resolve single-player nickname:", error);
        }
        members = [{ fid, nickname }];
        heading = "SINGLE PLAYER";
    } else if (subcommand === "alliance") {
        const alliance = String(values.alliance ?? "").trim().toUpperCase();
        if (!ALLIANCES.has(alliance)) {
            await editOriginal(interaction.application_id, interaction.token, "❌ Invalid alliance. Choose ARX, IDN, ZXC, VNX, or CAT.");
            return;
        }
        members = await loadAllianceMembers(alliance);
        heading = `ALLIANCE ${alliance}`;
        if (!members.length) {
            await editOriginal(interaction.application_id, interaction.token, `❌ No Player IDs found for alliance **${alliance}**.`);
            return;
        }
    } else {
        await editOriginal(interaction.application_id, interaction.token, "❌ Unknown subcommand. Use /redeem single or /redeem alliance.");
        return;
    }

    const truncated = subcommand === "alliance" && members.length >= MAX_ALLIANCE_FIDS;
    const results: Array<{ fid: string; nickname?: string; kind: string; result?: any }> = [];
    await editOriginal(
        interaction.application_id,
        interaction.token,
        `🎁 **3475 REDEEM — ${heading}**\\nRedeem Code: **${code}**\\nStarting redeem for **${members.length}** player(s)...`,
    );
    for (let i = 0; i < members.length; i++) {
        const member = members[i];
        try {
            const outcome = await redeemOne(member.fid, code);
            results.push({ fid: member.fid, nickname: member.nickname, kind: outcome.kind, result: outcome.result });

            // Invalid/expired codes stop the remaining batch, matching website behavior.
            if (outcome.kind === "invalid" || outcome.kind === "expired") {
                for (const skipped of members.slice(i + 1)) {
                    results.push({ fid: skipped.fid, nickname: skipped.nickname, kind: "error", result: { msg: "Skipped: gift code is invalid or expired." } });
                }
                break;
            }
            if (outcome.kind === "timeout") {
                for (const skipped of members.slice(i + 1)) {
                    results.push({ fid: skipped.fid, nickname: skipped.nickname, kind: "error", result: { msg: "Skipped because the redeem service timed out." } });
                }
                break;
            }
        } catch (error) {
            console.error("Redeem failed for one FID:", error);
            results.push({
                fid: member.fid,
                nickname: member.nickname,
                kind: "error",
                result: { msg: "Could not connect to the redeem service. The request did not complete." },
            });
        }
        // Update the same public Discord message after every player is processed.
        await publishProgress(interaction, heading, code, results, members.length);
        if (i < members.length - 1) await sleep(BATCH_DELAY_MS);
    }

    const note = truncated ? `⚠️ The roster is limited to ${MAX_ALLIANCE_FIDS} members per run.` : "";
    await publishResults(interaction, heading, results, note, code);
}

Deno.serve(async (req) => {
    // Public health check: confirms the deployed function is reachable.
    if (req.method === "GET") {
        return json({ ok: true, service: "3475-discord-interactions" });
    }
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    const rawBody = await req.text();
    if (!(await verifyDiscordRequest(req, rawBody))) {
        console.error("Discord request rejected: signature verification failed", {
            hasSignature: Boolean(req.headers.get("x-signature-ed25519")),
            hasTimestamp: Boolean(req.headers.get("x-signature-timestamp")),
            publicKeyLength: DISCORD_PUBLIC_KEY.length,
        });
        return json({ error: "invalid_discord_signature" }, 401);
    }

    let interaction: any;
    try {
        interaction = JSON.parse(rawBody);
    } catch {
        return json({ error: "invalid_json" }, 400);
    }

    if (interaction.type === 1) return json({ type: 1 });
    if (interaction.type !== 2 || interaction.data?.name !== "redeem") {
        return json(publicMessage("Unknown command."));
    }
    if (!interaction.application_id || !interaction.token) {
        return json(publicMessage("❌ Incomplete Discord interaction."));
    }

    // Public deferred response: intentionally no EPHEMERAL flag.
    EdgeRuntime.waitUntil(processRedeem(interaction).catch(async (error) => {
        console.error("Discord redeem processing failed:", error);
        await editOriginal(interaction.application_id, interaction.token, "⚠️ The 3475 redeem service encountered an error.");
    }));
    return json({ type: 5 });
});

/*
 * 3475 SOURCE OWNERSHIP
 * Copyright (c) 2026 Ferdinan | https://3475.web.id
 * Proprietary source code. All rights reserved. Unauthorized reuse is prohibited.
 *
 * Discord interaction endpoint for the 3475 bot.
 * Deploy with: supabase functions deploy discord-interactions --no-verify-jwt
 */

const DISCORD_PUBLIC_KEY = Deno.env.get("DISCORD_PUBLIC_KEY") ??
    "f78d1415e1c63c50cfc2595b21a35b2740d50fae3f06ec73241898145b883518";
const DISCORD_API = "https://discord.com/api/v10";
const COMMAND_NAME = "redeem";

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

function hexToBytes(hex: string): Uint8Array {
    if (!/^[0-9a-f]{128}$/i.test(hex)) throw new Error("Invalid Discord public key");
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return out;
}

function fromHex(hex: string): Uint8Array {
    if (!/^[0-9a-f]{128}$/i.test(hex)) throw new Error("Invalid signature");
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return out;
}

async function verifyDiscordRequest(req: Request, rawBody: string): Promise<boolean> {
    const signature = req.headers.get("x-signature-ed25519") ?? "";
    const timestamp = req.headers.get("x-signature-timestamp") ?? "";
    if (!signature || !timestamp || !DISCORD_PUBLIC_KEY) return false;

    try {
        const key = await crypto.subtle.importKey(
            "raw",
            hexToBytes(DISCORD_PUBLIC_KEY),
            { name: "Ed25519" },
            false,
            ["verify"],
        );
        return await crypto.subtle.verify(
            { name: "Ed25519" },
            key,
            fromHex(signature),
            new TextEncoder().encode(timestamp + rawBody),
        );
    } catch {
        return false;
    }
}

function publicMessage(content: string) {
    return { type: 4, data: { content, allowed_mentions: { parse: [] } } };
}

function getOptions(interaction: any): Record<string, unknown> {
    const options = interaction?.data?.options;
    if (!Array.isArray(options)) return {};
    return Object.fromEntries(options.map((option: any) => [option.name, option.value]));
}

async function callRedeemFunction(action: "login" | "redeem", fid: string, cdk?: string) {
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !anonKey) throw new Error("Supabase function configuration is missing");

    const response = await fetch(`${url.replace(/\/$/, "")}/functions/v1/redeem-giftcode`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "apikey": anonKey,
            "Authorization": `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ action, fid, ...(cdk ? { cdk } : {}) }),
    });

    const result = await response.json().catch(() => ({}));
    return { httpOk: response.ok, result };
}

function upstreamMessage(payload: any): string {
    return String(payload?.data?.msg ?? payload?.data?.message ?? payload?.error ?? "").trim();
}

function isUpstreamSuccess(payload: any): boolean {
    const data = payload?.data;
    const msg = String(data?.msg ?? "").trim().toUpperCase();
    return payload?.ok === true && (data?.err_code === 0 || data?.code === 0 || msg === "SUCCESS" || msg === "SUCCESS.");
}

async function finishInteraction(applicationId: string, interactionToken: string, content: string) {
    const url = `${DISCORD_API}/webhooks/${applicationId}/${interactionToken}/messages/@original`;
    const response = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    });
    if (!response.ok) {
        const detail = await response.text().catch(() => "");
        console.error("Discord response update failed:", response.status, detail.slice(0, 300));
    }
}

async function processRedeem(interaction: any) {
    const { fid: rawFid, code: rawCode } = getOptions(interaction);
    const fid = String(rawFid ?? "").trim();
    const code = String(rawCode ?? "").trim();
    let message: string;

    if (!/^[0-9]{4,20}$/.test(fid)) {
        message = "❌ **Redeem gagal:** Player ID harus berupa 4–20 digit angka.";
    } else if (!code || code.length > 40) {
        message = "❌ **Redeem gagal:** Gift Code wajib diisi dan maksimal 40 karakter.";
    } else {
        try {
            const login = await callRedeemFunction("login", fid);
            const loginData = login.result?.data;
            if (!login.httpOk || login.result?.ok !== true) {
                message = `❌ **Redeem gagal untuk Player ID ${fid}.** Tidak dapat menghubungi layanan validasi akun.`;
            } else if (String(loginData?.msg ?? "").toUpperCase().startsWith("USER INFO ERROR")) {
                message = `❌ **Redeem gagal:** Player ID ${fid} tidak ditemukan.`;
            } else {
                const redeem = await callRedeemFunction("redeem", fid, code);
                const upstream = redeem.result;
                if (redeem.httpOk && isUpstreamSuccess(upstream)) {
                    message = [
                        "🎉 **3475 — REDEEM BERHASIL!**",
                        "",
                        `**Player ID:** ${fid}`,
                        `**Gift Code:** ${code}`,
                        "**State:** 3475",
                        "",
                        "Gift Code berhasil diklaim melalui 3475 Discord Bot.",
                    ].join("\n");
                } else {
                    const reason = upstreamMessage(upstream) || upstream?.error || "Layanan redeem tidak memberikan konfirmasi berhasil.";
                    message = `❌ **Redeem tidak berhasil.**\n**Player ID:** ${fid}\n**Gift Code:** ${code}\n**Keterangan:** ${String(reason).slice(0, 250)}`;
                }
            }
        } catch (error) {
            console.error("Discord redeem processing failed:", error);
            message = `⚠️ **Redeem belum dapat diproses.**\n**Player ID:** ${fid}\n**Gift Code:** ${code}\nTerjadi gangguan pada layanan 3475. Silakan coba lagi nanti.`;
        }
    }

    await finishInteraction(interaction.application_id, interaction.token, message);
}

Deno.serve(async (req) => {
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    const rawBody = await req.text();
    if (!(await verifyDiscordRequest(req, rawBody))) {
        return json({ error: "invalid_discord_signature" }, 401);
    }

    let interaction: any;
    try {
        interaction = JSON.parse(rawBody);
    } catch {
        return json({ error: "invalid_json" }, 400);
    }

    // Discord PING handshake.
    if (interaction.type === 1) return json({ type: 1 });

    // Only acknowledge the registered /redeem command. All outcomes are public.
    if (interaction.type !== 2 || interaction.data?.name !== COMMAND_NAME) {
        return json(publicMessage("Perintah tidak dikenal."));
    }

    if (!interaction.application_id || !interaction.token) {
        return json(publicMessage("❌ Interaksi Discord tidak lengkap."));
    }

    // Defer immediately to meet Discord's 3-second acknowledgement deadline.
    // No EPHEMERAL flag is set: the final result is always public in this channel.
    EdgeRuntime.waitUntil(processRedeem(interaction));
    return json({ type: 5 });
});

// ================= REDEEM GIFT CODE (Edge Function) =================
// Proxies the "Redeem Code" modal (index.html / js/app-extras.js) to
// Century Games' own Whiteout Survival gift-code API. Two reasons this has
// to run server-side instead of calling the API straight from the browser:
//
// 1. CORS: the upstream API only answers requests whose Origin/Referer is
//    wos-giftcode.centurygame.com (it's meant to be called from that page
//    only). A `fetch()` from 3475.web.id would be blocked by the browser
//    before it ever sees a response.
// 2. Every request must be signed: sign = md5(sorted "key=value&..." of all
//    other params, alphabetically, + a shared secret) appended to the
//    payload. Keeping that secret out of the shipped JS bundle means it
//    can't be lifted from view-source and reused to spam the upstream API
//    from somewhere else.
//
// Deploy:
//   supabase functions deploy redeem-giftcode
// (default JWT verification is fine to leave ON — the anon key the
// frontend already uses via getSupabase().functions.invoke() satisfies it,
// same as every other Supabase call this app makes.)
//
// Optional secret override (defaults to the value below if unset):
//   supabase secrets set GIFT_CODE_SIGN_SECRET=...
//
// Client contract (see js/app-extras.js):
//   POST body: { action: "login", fid: "123456789" }
//     -> checks a Player ID exists and returns their nickname.
//   POST body: { action: "redeem", fid: "123456789", cdk: "SOMECODE" }
//     -> redeems the code for that Player ID.
// Response shape returned to the client in both cases:
//   { ok: boolean, status: number, data: <upstream JSON response> }
//   `ok`/`status` describe whether the call to Century Games itself
//   succeeded (HTTP-level) — the *redeem result* (success / already used /
//   invalid code / etc.) lives inside `data`, which js/app-extras.js
//   interprets. If Century Games ever changes their response shape, `data`
//   still comes through untouched so the frontend mapping can be adjusted
//   without redeploying this function.

import md5 from "npm:md5@2.3.0";

const GIFT_CODE_SIGN_SECRET = Deno.env.get("GIFT_CODE_SIGN_SECRET") || "tB87#kPtkxqOS2";
const KINGDOM_ID = "3475"; // same alliance/State id as REDEEM_STATE_ID in app-extras.js
const LOGIN_URL = "https://wos-giftcode-api.centurygame.com/api/player";
const REDEEM_URL = "https://wos-giftcode-api.centurygame.com/api/gift_code";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
}

// Builds "key1=val1&key2=val2..." with keys sorted alphabetically (this
// exact ordering is what Century Games' own JS signs, confirmed against a
// real captured request), then appends the secret and MD5-hashes it.
function sign(params: Record<string, string>): string {
    const qs = Object.keys(params)
        .sort()
        .map((k) => `${k}=${params[k]}`)
        .join("&");
    return md5(qs + GIFT_CODE_SIGN_SECRET);
}

async function callUpstream(url: string, params: Record<string, string>) {
    const signed = { ...params, sign: sign(params) };
    const body = Object.entries(signed)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join("&");

    const res = await fetch(url, {
        method: "POST",
        headers: {
            "content-type": "application/x-www-form-urlencoded",
            accept: "application/json, text/plain, */*",
            "accept-language": "en-US,en;q=0.9",
            referer: "https://wos-giftcode.centurygame.com/",
            origin: "https://wos-giftcode.centurygame.com",
            "user-agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-site",
        },
        body,
    });

    let data: unknown;
    try {
        data = await res.json();
    } catch {
        data = { raw: await res.text().catch(() => "") };
    }
    return { ok: res.ok, status: res.status, data };
}

function isValidFid(fid: unknown): fid is string {
    return typeof fid === "string" && /^[0-9]{4,20}$/.test(fid);
}

function isValidCdk(cdk: unknown): cdk is string {
    return typeof cdk === "string" && cdk.trim().length > 0 && cdk.trim().length <= 40;
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: CORS_HEADERS });
    }
    if (req.method !== "POST") {
        return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
    }

    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return jsonResponse({ ok: false, error: "invalid_json" }, 400);
    }

    const { action, fid, cdk } = body;
    const time = String(Math.floor(Date.now() / 1000)); // Century Games expects Unix seconds, not milliseconds

    if (!isValidFid(fid)) {
        return jsonResponse({ ok: false, error: "invalid_fid" }, 400);
    }

    if (action === "login") {
        const result = await callUpstream(LOGIN_URL, { fid, time });
        return jsonResponse(result);
    }

    if (action === "redeem") {
        if (!isValidCdk(cdk)) {
            return jsonResponse({ ok: false, error: "invalid_cdk" }, 400);
        }
        const result = await callUpstream(REDEEM_URL, {
            fid,
            cdk: (cdk as string).trim(),
            kid: KINGDOM_ID,
            time,
        });
        return jsonResponse(result);
    }

    return jsonResponse({ ok: false, error: "unknown_action" }, 400);
});

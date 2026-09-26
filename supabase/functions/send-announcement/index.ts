// ================= SEND ANNOUNCEMENT (Edge Function) =================
// Triggered directly by the President Panel's "Announcement" feature
// (js/app-auth.js -> sendAnnouncement()), NOT by a Database Webhook like
// send-push-notification. This broadcasts one push notification to every
// device that currently has notifications enabled, instead of only the
// device(s) watching one specific reservation.
//
// Deploy:
// supabase functions deploy send-announcement
// (Leave default JWT verification ON — unlike send-push-notification, this
// function is reachable straight from the browser, so it must reject the
// anon key and only accept a real signed-in session. Since President Login
// (js/app-auth.js -> submitStaffLogin) refuses to sign in any username
// except the President's, any authenticated session here IS the President.)
//
// Required secrets (shared with send-push-notification — set once):
// supabase secrets set VAPID_PUBLIC_KEY=...
// supabase secrets set VAPID_PRIVATE_KEY=...
// supabase secrets set VAPID_SUBJECT=mailto:you@example.com
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are already injected
// automatically for every Edge Function — no need to set them.)
//
// Client contract (see js/app-auth.js -> sendAnnouncement()):
//   POST body: { title?: string, body: string }
//   Response: { sent: number, removed_stale: number }

import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const DEFAULT_TITLE = "\u{1F4E2} Announcement";
const MAX_TITLE_LENGTH = 80;
const MAX_BODY_LENGTH = 500;

// Required because — unlike send-push-notification, which is only ever
// called server-to-server by a Supabase Database Webhook — this function is
// called directly from the browser (js/app-auth.js -> sendAnnouncement()).
// Without these headers the browser's CORS preflight (OPTIONS) fails before
// the real POST is ever sent, and the client just sees a generic network
// error ("Failed to send announcement") with nothing useful in the logs
// beyond the boot of that rejected OPTIONS request.
const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
    });
}

type SubscriptionRow = { id: string; endpoint: string; subscription: unknown };

// Confirms the incoming request carries a real signed-in session (a
// President), not just the anon key every visitor's browser sends by
// default. GoTrue's /auth/v1/user endpoint only resolves a user for a real
// session token — the anon key itself has no subject/user behind it and is
// rejected here.
async function getAuthenticatedUserId(authHeader: string | null): Promise<string | null> {
    if (!authHeader) return null;
    try {
        const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: {
                Authorization: authHeader,
                apikey: SUPABASE_SERVICE_ROLE_KEY
            }
        });
        if (!response.ok) return null;
        const user = await response.json();
        return user?.id ?? null;
    } catch (error) {
        console.error("Failed to verify session:", error);
        return null;
    }
}

async function fetchAllSubscriptions(): Promise<SubscriptionRow[]> {
    const url = `${SUPABASE_URL}/rest/v1/push_subscriptions?select=id,endpoint,subscription`;
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
    return (await response.json()) as SubscriptionRow[];
}

// A single device can hold several rows (one per reservation it tracks —
// see supabase_migration_push_subscriptions.sql), all sharing one `endpoint`.
// Group by endpoint so a broadcast never sends the same device duplicate
// copies of the same announcement.
function groupByEndpoint(rows: SubscriptionRow[]) {
    const map = new Map<string, { subscription: unknown; ids: string[] }>();
    for (const row of rows) {
        const existing = map.get(row.endpoint);
        if (existing) existing.ids.push(row.id);
        else map.set(row.endpoint, { subscription: row.subscription, ids: [row.id] });
    }
    return [...map.values()];
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

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: CORS_HEADERS });
    }
    if (req.method !== "POST") {
        return jsonResponse({ error: "method_not_allowed" }, 405);
    }

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
        console.error("VAPID configuration is incomplete. Required: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.");
        return jsonResponse({ error: "server_misconfigured" }, 500);
    }

    const userId = await getAuthenticatedUserId(req.headers.get("Authorization"));
    if (!userId) {
        return jsonResponse({ error: "forbidden", message: "President login required" }, 403);
    }

    let payload: any;
    try {
        payload = await req.json();
    } catch {
        return jsonResponse({ error: "invalid_json" }, 400);
    }

    const body = String(payload?.body ?? "").trim().slice(0, MAX_BODY_LENGTH);
    if (!body) {
        return jsonResponse({ error: "empty_message", message: "Announcement message is required" }, 400);
    }
    const title = String(payload?.title ?? "").trim().slice(0, MAX_TITLE_LENGTH) || DEFAULT_TITLE;

    const rows = await fetchAllSubscriptions();
    const subscribers = groupByEndpoint(rows);

    if (!subscribers.length) {
        return jsonResponse({ sent: 0, removed_stale: 0 });
    }

    const notificationPayload = JSON.stringify({
        type: "announcement",
        title,
        body
    });

    const staleIds: string[] = [];

    await Promise.all(subscribers.map(async (subscriber) => {
        try {
            await webpush.sendNotification(subscriber.subscription as any, notificationPayload);
        } catch (error: any) {
            // 404/410 = the browser/OS has invalidated this subscription
            // (uninstalled, expired, etc.) — safe to delete every row that
            // shared this endpoint.
            if (error?.statusCode === 404 || error?.statusCode === 410) {
                staleIds.push(...subscriber.ids);
            } else {
                console.error("Push send failed for an endpoint:", error?.body || error);
            }
        }
    }));

    await deleteStaleSubscriptions(staleIds);

    return jsonResponse({
        sent: subscribers.length - staleIds.length,
        removed_stale: staleIds.length
    });
});

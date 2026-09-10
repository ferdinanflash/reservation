// ================= SEND PUSH NOTIFICATION (Edge Function) =================
// Triggered by a Supabase Database Webhook on UPDATE of public.reservation_slots.
// This is the piece that lets a notification reach the guest's device even
// when the app/browser is fully closed: the browser's own push service
// (e.g. FCM for Chrome/Edge, Mozilla's for Firefox, Apple's for Safari)
// delivers the message and wakes the service worker's 'push' handler,
// completely independent of any tab being open.
//
// Deploy:
// supabase functions deploy send-push-notification --no-verify-jwt
//
// Required secrets (set once):
// supabase secrets set VAPID_PUBLIC_KEY=...
// supabase secrets set VAPID_PRIVATE_KEY=...
// supabase secrets set VAPID_SUBJECT=mailto:you@example.com
// supabase secrets set WEBHOOK_SECRET=<a random string you invent>
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are already injected
// automatically for every Edge Function — no need to set them.)
//
// Then, in the Supabase Dashboard: Database -> Webhooks -> Create a new
// webhook -> table "reservation_slots" -> event "Update" -> type "Supabase
// Edge Function" -> function "send-push-notification" -> add HTTP header
// "x-webhook-secret: <the same random string>". That header is what stops
// randoms on the internet from hitting this endpoint and spamming pushes,
// since --no-verify-jwt is required for database webhooks to be able to
// call it at all.

import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const FINAL_STATUSES = ["accepted", "approved", "rejected"];

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

function statusText(status: string) {
    const normalized = String(status || "").toLowerCase();
    if (normalized === "accepted" || normalized === "approved") return "Approved";
    if (normalized === "rejected") return "Rejected";
    return String(status || "Updated");
}

function buildNotification(status: string) {
    const normalized = String(status || "").toLowerCase();
    if (normalized === "accepted" || normalized === "approved") {
        return {
            title: "Reservation Approved \u{1F389}",
            body: "Your reservation has been approved. Please check the reservation schedule for the latest details."
        };
    }
    if (normalized === "rejected") {
        return {
            title: "Reservation Rejected",
            body: "Your reservation has been rejected. Please check the reservation details for the latest information."
        };
    }
    return {
        title: "Reservation Update",
        body: `Your reservation status is now ${statusText(status)}.`
    };
}

async function fetchSubscriptions(applicationId: string) {
    const url = `${SUPABASE_URL}/rest/v1/push_subscriptions`
        + `?application_id=eq.${encodeURIComponent(applicationId)}`
        + `&select=id,subscription`;

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
    return (await response.json()) as Array<{ id: string; subscription: unknown }>;
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
    if (req.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    if (!WEBHOOK_SECRET || req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
        return new Response("Forbidden", { status: 403 });
    }

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
        console.error("VAPID keys are not configured.");
        return new Response("Server misconfigured", { status: 500 });
    }

    let payload: any;
    try {
        payload = await req.json();
    } catch {
        return new Response("Invalid JSON", { status: 400 });
    }

    // Supabase Database Webhook payload shape:
    // { type: "UPDATE", table, schema, record, old_record }
    if (payload?.type !== "UPDATE" || !payload?.record) {
        return new Response("Ignored (not an UPDATE)", { status: 200 });
    }

    const record = payload.record;
    const oldRecord = payload.old_record ?? {};
    const newStatus = String(record.status ?? "").toLowerCase();
    const oldStatus = String(oldRecord.status ?? "").toLowerCase();

    if (newStatus === oldStatus || !FINAL_STATUSES.includes(newStatus)) {
        return new Response("Ignored (no notifiable status change)", { status: 200 });
    }

    const applicationId = String(record.id);
    const subscriptions = await fetchSubscriptions(applicationId);

    if (!subscriptions.length) {
        return new Response("No subscriptions for this application", { status: 200 });
    }

    const notification = buildNotification(record.status);
    const notificationPayload = JSON.stringify({
        title: notification.title,
        body: notification.body,
        application_id: applicationId,
        status: record.status
    });

    const staleIds: string[] = [];

    await Promise.all(subscriptions.map(async (row) => {
        try {
            await webpush.sendNotification(row.subscription as any, notificationPayload);
        } catch (error: any) {
            // 404/410 = the browser/OS has invalidated this subscription
            // (uninstalled, expired, etc.) — safe to delete it.
            if (error?.statusCode === 404 || error?.statusCode === 410) {
                staleIds.push(row.id);
            } else {
                console.error(`Push send failed for subscription ${row.id}:`, error?.body || error);
            }
        }
    }));

    await deleteStaleSubscriptions(staleIds);

    return new Response(JSON.stringify({
        sent: subscriptions.length - staleIds.length,
        removed_stale: staleIds.length
    }), { status: 200, headers: { "Content-Type": "application/json" } });
});

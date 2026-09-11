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
const WAITING_STATUSES = ["waiting", "pending"];

function normalizeStatus(status: unknown) {
    return String(status ?? "").trim().toLowerCase();
}

function statusText(status: string) {
    const normalized = normalizeStatus(status);
    if (normalized === "accepted" || normalized === "approved") return "Approved";
    if (normalized === "rejected") return "Rejected";
    if (normalized === "waiting" || normalized === "pending") return "Waiting";
    return String(status || "Updated");
}

// time_log is kept as JSONB and records the original submission as:
// { action: "created", detail: "HH:MM UTC", ... }.
// Reading it here lets us tell the applicant when an accepted reservation
// ended up in a different slot from the slot they originally requested.
function getTimeLog(record: any): any[] {
    let log = record?.time_log;
    if (typeof log === "string") {
        try { log = JSON.parse(log); } catch (_) { log = []; }
    }
    return Array.isArray(log) ? log : [];
}

function getOriginalTimeSlot(record: any, fallback = "") {
    const created = getTimeLog(record).find((entry) => String(entry?.action || "").toLowerCase() === "created");
    const detail = String(created?.detail || "");
    const match = detail.match(/\b([01]\d|2[0-3]):[0-5]\d\b/);
    return match ? match[0] : fallback;
}

function displayPlayerName(record: any) {
    const nickname = String(record?.nickname ?? "").trim();
    return nickname || "Player";
}

function buildNotification(record: any, oldRecord: any) {
    const status = normalizeStatus(record?.status);
    const oldStatus = normalizeStatus(oldRecord?.status);
    const player = displayPlayerName(record);
    const oldTime = String(oldRecord?.time_slot ?? "").trim();
    const newTime = String(record?.time_slot ?? "").trim();
    const originalTime = getOriginalTimeSlot(record, oldTime);

    // 1) A Waiting reservation was moved to another slot.
    if (
        WAITING_STATUSES.includes(status) &&
        WAITING_STATUSES.includes(oldStatus) &&
        oldTime &&
        newTime &&
        oldTime !== newTime
    ) {
        return {
            title: `${player} — Reservation Time Moved`,
            body: `Your reservation slot was moved from ${oldTime} UTC to ${newTime} UTC. Your reservation is still Waiting. ${newTime} UTC is the new slot assigned to your application.`
        };
    }

    // 2) Reservation accepted, but the final slot differs from the original
    //    slot submitted by the player.
    if (
        (status === "accepted" || status === "approved") &&
        newTime &&
        originalTime &&
        newTime !== originalTime
    ) {
        return {
            title: `${player} — Reservation Approved 🎉`,
            body: `Your reservation has been approved, but the time slot was changed from your original request (${originalTime} UTC) to ${newTime} UTC. Please use ${newTime} UTC as your confirmed slot.`
        };
    }

    // 3) Reservation rejected.
    if (status === "rejected") {
        return {
            title: `${player} — Reservation Rejected`,
            body: `Your reservation request has been rejected. Please check the reservation details for more information.`
        };
    }

    // Normal acceptance / other status changes.
    if (status === "accepted" || status === "approved") {
        return {
            title: `${player} — Reservation Approved 🎉`,
            body: newTime
                ? `Your reservation has been approved for ${newTime} UTC.`
                : "Your reservation has been approved. Please check the reservation schedule for the latest details."
        };
    }

    return {
        title: `${player} — Reservation Update`,
        body: `Your reservation status is now ${statusText(record?.status)}.`
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
    const newStatus = normalizeStatus(record.status);
    const oldStatus = normalizeStatus(oldRecord.status);
    const oldTime = String(oldRecord.time_slot ?? "").trim();
    const newTime = String(record.time_slot ?? "").trim();

    const statusChanged = newStatus !== oldStatus;
    const timeChanged = oldTime !== newTime;
    const waitingTimeMoved =
        WAITING_STATUSES.includes(newStatus) &&
        WAITING_STATUSES.includes(oldStatus) &&
        timeChanged;

    // Notify on final status changes OR a slot move while still Waiting.
    // This intentionally does not notify unrelated field edits.
    const shouldNotify =
        (statusChanged && FINAL_STATUSES.includes(newStatus)) ||
        waitingTimeMoved;

    if (!shouldNotify) {
        return new Response("Ignored (no notifiable reservation change)", { status: 200 });
    }

    const applicationId = String(record.id);
    const subscriptions = await fetchSubscriptions(applicationId);

    if (!subscriptions.length) {
        return new Response("No subscriptions for this application", { status: 200 });
    }

    const notification = buildNotification(record, oldRecord);
    const notificationPayload = JSON.stringify({
        title: notification.title,
        body: notification.body,
        application_id: applicationId,
        status: record.status,
        nickname: displayPlayerName(record),
        old_time_slot: oldTime || null,
        new_time_slot: newTime || null,
        original_time_slot: getOriginalTimeSlot(record, oldTime) || null
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

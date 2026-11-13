# Feature map: Notifications and announcements

## Source map

| Path | Responsibility |
|---|---|
| `js/app-notifications.js` | Browser permission/subscription lifecycle, saved application IDs, status monitoring and push registration |
| `js/app-auth.js` | President announcement UI and invokes `send-announcement` |
| `supabase/functions/send-announcement/index.ts` | Authenticated announcement dispatch using Web Push |
| `supabase/functions/send-push-notification/index.ts` | Database-webhook-triggered push when reservation row updates |
| `supabase_migration_push_subscriptions.sql` | Push subscription table, indexes and RLS policies |
| `supabase_migration_push_subscriptions_cleanup.sql` | Last-seen and single-subscription-per-device cleanup functions/triggers |
| `supabase_migration_guest_notifications.sql` | Guest notification/realtime behavior notes; no additional column required |
| `index.html`, `common.js` | Browser shell and Supabase client/public VAPID configuration |

## Data flow

### Player status notifications

Browser stores application IDs in localStorage and subscribes to reservation status changes. Push subscriptions are persisted in `public.push_subscriptions`, associated with application IDs. The backend function `send-push-notification` is documented as a Supabase Database Webhook target on UPDATE of `public.reservation_slots`; it validates `x-webhook-secret` and sends Web Push.

### President announcements

`js/app-auth.js` invokes `send-announcement`. The Edge Function validates the caller's Supabase auth token, reads push subscriptions with service-role access, sends notification payloads and removes expired/invalid subscriptions.

## Required server secrets

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `WEBHOOK_SECRET` for the reservation update webhook
- Supabase-provided `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

Only the public VAPID key belongs in browser configuration. Never put private VAPID or service-role credentials in frontend files or memory.

## Change-impact checklist

- [ ] Test permission denied, granted, unsupported browser and service-worker cases.
- [ ] Preserve localStorage migration/compatibility for saved application IDs.
- [ ] Check endpoint uniqueness and one-subscription-per-device cleanup behavior.
- [ ] Verify webhook URL, event type, secret header and payload shape in Supabase dashboard.
- [ ] Verify notification delivery and cleanup for expired endpoints.
- [ ] Check push SQL RLS policies and server-side service-role usage.

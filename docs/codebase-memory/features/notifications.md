# Feature map: Notifications and announcements

## Source map

| Path | Responsibility |
|---|---|
| `js/app-notifications.js` | Browser permission/subscription lifecycle, saved application IDs, status monitoring and push registration |
| `js/app-auth.js` | President announcement UI and invokes `send-announcement` |
| `supabase/functions/send-announcement/index.ts` | Authenticated announcement dispatch using Web Push |
| `supabase/functions/send-push-notification/index.ts` | Database-webhook-triggered Web Push plus IDN Alliance Discord routing when reservation row updates |
| `supabase_migration_push_subscriptions.sql` | Push subscription table, indexes and RLS policies |
| `supabase_migration_push_subscriptions_cleanup.sql` | Last-seen and single-subscription-per-device cleanup functions/triggers |
| `supabase_migration_guest_notifications.sql` | Guest notification/realtime behavior notes; no additional column required |
| `index.html`, `common.js` | Browser shell and Supabase client/public VAPID configuration |

## Data flow

### Player status notifications

Browser stores application IDs in localStorage and subscribes to reservation status changes. Push subscriptions are persisted in `public.push_subscriptions`, associated with application IDs. The backend function `send-push-notification` is a Supabase Database Webhook target on UPDATE of `public.reservation_slots`; it validates `x-webhook-secret` and sends Web Push. Discord routing is independent of the guest's Get Notification setting. On every notifiable reservation update, the function looks up `reservation_slots.game_id` in `public.troops_power` (`game_id`, `nickname`, `alliance`). Only a confirmed row whose alliance is `IDN` is routed to an exact `IDN` text/announcement channel in each enabled Discord guild configured in `public.discord_guild_settings`. Only a confirmed IDN alliance is sent to Discord. Missing Player ID/database row, empty alliance, non-IDN alliance, missing channel, or Discord delivery errors skip only the Discord leg. Get Notification controls browser push only; without a saved push subscription, Discord delivery still proceeds. No `@everyone` mention is used.

### President announcements

`js/app-auth.js` invokes `send-announcement`. The Edge Function validates the caller's Supabase auth token, reads push subscriptions with service-role access, sends notification payloads and removes expired/invalid subscriptions.

## Required server secrets

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `WEBHOOK_SECRET` for the reservation update webhook
- `DISCORD_BOT_TOKEN` for server-side IDN reservation notifications (same bot token used by the Discord announcement functions)
- Supabase-provided `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

Only the public VAPID key belongs in browser configuration. Never put private VAPID or service-role credentials in frontend files or memory.

## Change-impact checklist

- [ ] Test permission denied, granted, unsupported browser and service-worker cases.
- [ ] Preserve localStorage migration/compatibility for saved application IDs.
- [ ] Check endpoint uniqueness and one-subscription-per-device cleanup behavior.
- [ ] Verify webhook URL, event type, secret header and payload shape in Supabase dashboard.
- [ ] Verify notification delivery and cleanup for expired endpoints.
- [ ] Verify IDN routing with a Player ID found in `troops_power` and an exact `IDN` channel in an enabled configured guild.
- [ ] Verify missing Player ID/alliance and non-IDN alliance skip Discord without interrupting Web Push.
- [ ] Check push SQL RLS policies and server-side service-role usage.

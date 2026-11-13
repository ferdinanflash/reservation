# Feature map: Shared core and authentication

## Shared browser foundation

### `common.js`

Shared configuration/utilities used by the main app and other legacy portal pages:
- Supabase project URL and public anon key.
- Public Web Push VAPID key.
- Staff email-domain mapping and allowed admin username list.
- Username/email conversion and President username check.
- HTML escaping, nickname display sanitization, Supabase client initialization and clipboard helpers.

The Supabase anon key and public VAPID key are browser-visible public configuration. Never put service-role keys or private VAPID material here.

### `js/app-core.js`

- Shared app state (current position, reservation open state, applications, selected slot).
- Shared UI helpers and startup.
- Reads/writes `public.system_settings` to get/set open/closed state by position.
- Shared stat/furnace icon helpers and common UI contracts consumed by other scripts.

### `js/app-auth.js`

- President/staff login and auth-related UI.
- Reads/writes `public.footer_settings` for President/guild display values.
- Invokes `send-announcement` Edge Function for announcement delivery.

## Authentication boundary

The browser UI uses Supabase Auth and shared helper logic. The allowed username list controls which signed-in staff identities unlock client-side admin controls. This must not be treated as the complete security boundary: every sensitive write must also be protected by Supabase RLS/policies or server-side authorization. Verify actual live policies before changing admin access.

## Other shared consumers

`js/app-applications.js`, `js/app-schedule.js`, `js/app-waiting.js`, `js/app-bulk.js`, `js/app-extras.js`, `js/app-notifications.js`, `js/app-notes.js`, `js/app-svs-enemies.js`, and `js/app-svs-record.js` rely on the shared client/global helpers or shared app state.

## Change-impact checklist

- [ ] Check every page loading `common.js`, including separate `live/index.html` or legacy pages.
- [ ] Preserve globals expected by classic scripts.
- [ ] Keep public keys distinct from privileged secrets.
- [ ] Check Supabase Auth session behavior and database RLS separately from UI role checks.
- [ ] Check escaping for all user-controlled text inserted into HTML.

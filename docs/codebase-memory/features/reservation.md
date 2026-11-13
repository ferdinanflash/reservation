# Feature map: Reservation and President operations

## User-facing behavior

Players view available Minister positions/time slots and submit applications with game identity and resource details. President/admin users manage application status, schedule, capacity, moves, removals, notes and bulk actions. Waiting-list and Time Log behavior is part of this feature.

## Source map

| File | Responsibility |
|---|---|
| `index.html` | Reservation UI markup, modals, forms, schedule containers and script loading |
| `js/app-core.js` | Shared state, selected position, reservation open/close settings, startup and shared UI helpers |
| `js/app-schedule.js` | Loads `reservation_slots` by position and renders time slots/schedule |
| `js/app-applications.js` | Application submission, detail/edit UI, status acceptance and Time Log updates |
| `js/app-waiting.js` | Waiting list, move/reassign, reject and deletion flows |
| `js/app-bulk.js` | Multi-select and bulk status updates |
| `js/app-auth.js` | Admin-related UI and footer settings |
| `js/app-notifications.js` | Tracks saved application IDs and listens for status changes |
| `js/app-notes.js` | Loads/saves How To Use text by position and language |
| `common.js` | Shared Supabase client, auth helpers, HTML escaping and utilities |
| `lang.js` | Translation strings consumed by the modules |
| `style.css` | Responsive layout, tables, modals and theme-aware styles |

## Data and persistence

- Primary table: `public.reservation_slots`.
- Per-position open/closed setting: `public.system_settings`, keyed by current position in `js/app-core.js`.
- Instruction text: `public.how_to_use_notes`, queried by `position` and `language`.
- Related notification records: `public.push_subscriptions`.
- Footer identity: `public.footer_settings`.

Client operations observed:
- Read schedule rows filtered by `position`.
- Insert new application rows and return inserted `id`.
- Update resource/application fields, `status`, `time_slot`, and `time_log`.
- Delete rows in waiting/admin workflows.
- Bulk update includes an old-status filter to avoid overwriting a row changed concurrently.

## SQL/migrations in this repository

- `supabase_migration_additional_time_slots.sql` — adds/maintains additional preferred time-slot fields and an insert trigger/function.
- `supabase_migration_application_time_log.sql` — adds Time Log support, initializes it for existing rows, adds insert-time initialization, and creates `how_to_use_notes`.
- `supabase_migration_fire_crystal_shard.sql` — adds Fire Crystal Shard field support.
- `supabase_migration_guest_notifications.sql` — documents guest notification behavior; no new column is required.
- `supabase_migration_push_subscriptions.sql` and `supabase_migration_push_subscriptions_cleanup.sql` — push subscription persistence and cleanup behavior.

**Critical gap:** no base `reservation_slots` schema migration is present in this repository snapshot. The migrations assume the table already exists. Confirm its live schema and RLS policies before changing columns, constraints, triggers, or write behavior.

## Change-impact checklist

- [ ] Check `index.html` IDs/data attributes and modal markup.
- [ ] Trace caller and callee across core, schedule, applications, waiting and bulk modules.
- [ ] Preserve status/time move semantics and append Time Log entries where required.
- [ ] Check all 8 languages: EN, CN, ID, PH, TH, IT, RU, FR.
- [ ] Check desktop and mobile table/modal layout in all themes.
- [ ] Check RLS and live schema; do not assume frontend admin gating is security.
- [ ] If status changes notify players, inspect realtime and push flows.
- [ ] Verify additional time slot and Fire Crystal Shard migrations if relevant.

## Known coupling

- Classic scripts share globals; load order in `index.html` matters.
- `my_application_id` is stored in localStorage; notification module also supports a collection of saved application IDs.
- Application data is used by Recently Accepted UI and push notifications; changing field names may affect those consumers.

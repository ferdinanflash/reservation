# 3475 Codebase Memory — Index

**Repository:** `ferdinanflash/reservation`  
**Branch:** `main`  
**Baseline commit inspected:** `7b911f94acfedec5b4a477c0e7a7dc94344c4897`  
**Inspection date:** 2026-11-14  
**Authority:** live source at the inspected commit; this memory is a navigation aid, not a substitute for source verification.

## Project shape

A static/PWA web application served from GitHub Pages/custom domain, with browser JavaScript modules and Supabase for persistence, authentication, realtime and Edge Functions. The repository also contains SQL migration scripts, visual assets, documentation and GitHub Actions workflows.

## Entry points and load order

The main shell is `index.html`. Its deferred scripts are loaded in this order:

1. Supabase JS v2 CDN
2. `common.js`
3. `lang.js`
4. `js/app-core.js`
5. `js/app-auth.js`
6. `js/app-notes.js`
7. `js/app-schedule.js`
8. `js/app-applications.js`
9. `js/app-waiting.js`
10. `js/app-bulk.js`
11. `js/app-extras.js`
12. `js/app-notifications.js`
13. `js/app-svs-enemies.js`
14. `js/app-svs-record.js`
15. `fire-banner.js`
16. `opening-animation.js`

**Important:** this is a classic-script/global-function architecture, not a bundled ES-module graph. Preserve script order and global contracts unless deliberately refactoring.

## Feature maps

- [Reservation and President operations](features/reservation.md)
- [SvS Enemies / TAL Enemies](features/svs-enemies.md)
- [SvS Record](features/svs-record.md)
- [Redeem Code and Recently Accepted](features/redeem-and-extras.md)
- [Notifications and announcements](features/notifications.md)
- [Themes, translations and PWA](features/themes-translations-pwa.md)
- [Shared core and authentication](features/shared-core-auth.md)

## Architecture decisions and known issues

- [ADR-001: classic scripts and shared globals](decisions/ADR-001-classic-script-architecture.md)
- [ADR-002: read-only memory/MCP and source-of-truth policy](decisions/ADR-002-memory-trust-and-security.md)
- [Known issues and verification gaps](known-issues.md)

## Fast routing

| Request | Start with |
|---|---|
| Reservation submission/details | `js/app-applications.js` |
| Schedule/slot capacity | `js/app-schedule.js`, `js/app-core.js` |
| Waiting, move, reject, bulk actions | `js/app-waiting.js`, `js/app-bulk.js` |
| Login/admin and footer | `js/app-auth.js`, `common.js` |
| How To Use notes | `js/app-notes.js`, `supabase_migration_application_time_log.sql` |
| Enemy State data | `js/app-svs-enemies.js`, `supabase/functions/wosatlas-states/index.ts` |
| SvS history records | `js/app-svs-record.js`, `svs_record_migration.sql` |
| Redeem gift code | `js/app-extras.js`, `supabase/functions/redeem-giftcode/index.ts` |
| Push notifications | `js/app-notifications.js`, notification Edge Functions and push SQL migrations |
| Theme / language / PWA cache | `style.css`, `lang.js`, `index.html`, `sw.js` |

## Repository boundaries

External portals linked from the main menu are separate projects and are not implemented by this repository:

- `https://tal.3475.web.id`
- `https://transfer.3475.web.id`
- `https://events.3475.web.id`
- `https://calc.3475.web.id`

Do not modify those portals through this repository unless their source is separately connected.

## Database inventory confidence

Tables directly referenced by current frontend/backend source or included migrations include:

- `reservation_slots` — central reservation/application record.
- `system_settings` — per-position open/closed setting.
- `footer_settings` — President/guild footer information.
- `how_to_use_notes` — per-position/per-language instructional text.
- `push_subscriptions` — browser push subscriptions.
- `svs_enemies_settings` — configured enemy State list and menu label.
- `svs_enemy_cache` — persistent enemy State payload cache.
- `svs_records` — editable State 3475 SvS record history.
- `theme_settings` — shared seasonal theme selection.
- `troops_power` — queried by extras/redeem-related UI and deleted by gift-code backend when upstream confirms an invalid player ID.

The repository does **not** include an authoritative base-schema migration for every table (notably `reservation_slots`, `system_settings`, `footer_settings`, and `troops_power`). Their full columns, constraints, triggers, grants and RLS must be verified against the live Supabase schema before database changes. Do not infer them from client queries alone.

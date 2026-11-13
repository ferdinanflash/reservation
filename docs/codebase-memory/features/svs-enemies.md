# Feature map: SvS Enemies / TAL Enemies

## Entry points

- UI and behavior: `js/app-svs-enemies.js`.
- Main shell and feature containers: `index.html`.
- Translations/styles: `lang.js`, `style.css`.
- Backend proxy/cache: `supabase/functions/wosatlas-states/index.ts`.
- SQL: `supabase_migration_svs_enemies.sql`, `supabase_migration_svs_enemies_menu_label.sql`, `supabase_migration_svs_enemy_cache.sql`.

## Configuration and data

- `public.svs_enemies_settings`: singleton row `id='main'`; stores configured enemy State IDs and menu label fields.
- `public.svs_enemy_cache`: persistent cached payload per `kid`, with fetched/attempt metadata.
- Browser also uses localStorage for selected enemy States, menu label and last-good snapshots; in-memory caches and request concurrency controls are implemented in the frontend.
- External SvS history matrix source in current frontend: `https://data.wosnerds.com/data/svs-history/svs-history-3001-3500.json`.
- Public WoS Atlas source used by backend: `https://wosatlas.com/api/v1`.

## Frontend-to-backend actions observed

The frontend invokes Supabase Edge Function `wosatlas-states` for actions including:
- `player`
- `detail`
- `refresh`
- `power-leaderboard`
- `alliance`

The backend also implements:
- `player-extra`
- `player-search`
- default/legacy `summary`

Trace exact payload fields in `js/app-svs-enemies.js` and matching handler in the Edge Function before changing an action contract.

## Backend details

- Function reads `WOSATLAS_API_KEY` for legacy API host `https://api.wosatlas.com/v1`.
- Public-site integration uses `https://wosatlas.com/api/v1`, including cursor pagination for server/alliance/player data.
- Persistent cache REST access uses `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` server-side.
- Refresh is restricted to States configured in `svs_enemies_settings`.
- Backend has in-memory cache/retry logic in addition to Supabase persistent cache.

## Important endpoint warning

The Edge Function still contains a legacy `summary` handler targeting `https://api.wosatlas.com/v1/states/summary` and the handler is selected when action is omitted/defaulted to `summary`. Current frontend paths observed in the main SvS Enemies feature use explicit action values; nevertheless, do not accidentally call the default action or revive the retired endpoint. Confirm the live deployed function and secrets before changing this behavior.

## Change-impact checklist

- [ ] Preserve frontend action names and request/response shapes.
- [ ] Inspect both localStorage snapshot logic and Supabase persistent cache.
- [ ] Check cursor pagination, retry, deduplication and partial-failure behavior.
- [ ] Confirm enemy State IDs are sourced from the configured settings row.
- [ ] Review RLS and Edge Function service-role access.
- [ ] Check SvS/TAL label translations and all 8 languages.
- [ ] Check request concurrency, per-State refresh and stale-cache fallback.
- [ ] Verify the public history JSON source independently if history matrix behavior changes.

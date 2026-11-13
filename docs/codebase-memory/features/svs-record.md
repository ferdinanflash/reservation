# Feature map: SvS Record

## Source map

- Main UI and data operations: `js/app-svs-record.js`.
- Main page markup: `index.html`.
- Translations: `lang.js` (keys use the `svsr_...` namespace).
- Styling: `style.css`.
- Database migration: `svs_record_migration.sql`.

## Data sources

1. Editable State 3475 record history is stored in `public.svs_records`.
2. The client loads rows ordered by `played_at DESC`, then `created_at DESC`.
3. The page also fetches a public history JSON file from `https://data.wosnerds.com/data/svs-history/svs-history-3001-3500.json` for State 3475 history display.

## Database contract in migration

The migration defines `svs_records` with:
- `id` identity primary key
- `played_at` date
- `opponent_state` integer
- `prep_score` bigint
- `battle_score` bigint
- `result` text
- `notes` text
- `created_at` and `updated_at` timestamps

RLS allows public SELECT. Authenticated users are granted insert/update/delete by the policy named `President admins manage SvS records`; verify the exact policy predicate and current live DB policy before changing admin authorization.

## Realtime

The frontend subscribes to Postgres changes on `public.svs_records` and reloads the list.

## Change-impact checklist

- [ ] Preserve the distinction between external public history JSON and editable `svs_records`.
- [ ] Keep query sort order stable.
- [ ] Check CRUD validation and confirmation flows.
- [ ] Check President authorization and database policy; do not rely only on hidden UI controls.
- [ ] Check `svsr_...` translations across all 8 languages.
- [ ] Verify realtime refresh and error/empty states.

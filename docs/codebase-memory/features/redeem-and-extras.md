# Feature map: Redeem Code and extra panels

## Source map

- Client UI and logic: `js/app-extras.js`.
- Main modal/markup: `index.html`.
- Translations and UI styles: `lang.js`, `style.css`.
- Dedicated backend: `supabase/functions/redeem-giftcode/index.ts`.
- A root-level `supabase/functions/index.ts` also contains a gift-code implementation; inspect deployment configuration/history before treating it as the active deployed function. Avoid maintaining two divergent implementations.

## Redeem flow

- Browser calls `client.functions.invoke('redeem-giftcode', { body: payload })`.
- Edge Function validates player ID and gift code, signs requests server-side, and calls Century Games player/login and gift-code endpoints.
- Client interprets the returned `ok`, `status`, and upstream `data` fields.
- If upstream confirms a player ID is invalid, backend can delete that `game_id` from `public.troops_power` using the service-role client.

## Other extras observed

- Recently Accepted Reservation queries `public.reservation_slots` where status is `Accepted` and nickname is not null, selecting nickname, position, time slot, update timestamp, furnace level and resource/speedup values.
- Other extra UI queries `public.troops_power` for game IDs and alliance data.

## Security note

Gift-code signing material must be server-only and configured through Supabase secrets. Current source contains a fallback value for the signing secret; treat that as a security-review item and do not copy the value into docs, logs, client code or memory. Prefer removing hard-coded fallback material and requiring a configured secret after validating deployment.

## Change-impact checklist

- [ ] Preserve the client/server request and response contract.
- [ ] Confirm upstream response mapping for success, invalid code, already redeemed and player-not-found cases.
- [ ] Keep signing secret server-side; review fallback secret configuration.
- [ ] If `troops_power` deletion logic changes, confirm upstream invalid-player signal and exact row filter.
- [ ] If Recently Accepted fields change, inspect reservation schema and icon mapping in `js/app-core.js`.
- [ ] Check translations, modal layout and responsive behavior.

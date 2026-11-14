# Feature map: Redeem Code and extra panels

## Source map

- Client UI and logic: `js/app-extras.js`.
- Main modal/markup: `index.html`.
- Translations and UI styles: `lang.js`, `style.css`.
- Dedicated backend: `supabase/functions/redeem-giftcode/index.ts`.
- A root-level `supabase/functions/index.ts` also contains a gift-code implementation; inspect deployment configuration/history before treating it as the active deployed function. Avoid maintaining two divergent implementations.

## Redeem flow

- Browser calls `client.functions.invoke('redeem-giftcode', { body: payload })`.
- `supabase/functions/redeem-giftcode/index.ts` validates the player ID and gift code, creates a server-side signature, and calls Century Games player/login and gift-code endpoints.
- Client interprets the returned `ok`, `status`, and upstream `data` fields.
- If upstream confirms a player ID is invalid, backend can delete that `game_id` from `public.troops_power` using the service-role client.
- Signing investigation on 2026-11-14 inspected Century Games' browser bundle: keys are sorted, values are canonicalized (`encodeURIComponent`, or JSON for objects), the secret is appended, and the result is MD5-hashed. The user reported successful redemption after the signing work. **Important reconciliation:** the currently committed GitHub source fetched during this review still shows the older raw-value concatenation in `sign()`; compare the deployed Edge Function with GitHub source and commit the exact tested implementation before future deployments. Do not infer deployment state from this memory note.

## Discord redeem bot

- Slash-command endpoint: `supabase/functions/discord-interactions/index.ts`.
- Setup/runbook: `docs/DISCORD_BOT_REDEEM.md`.
- `/redeem single` handles one player ID; `/redeem alliance` loads alliance members from `public.troops_power` and processes them sequentially.
- The Discord endpoint verifies Ed25519 signatures itself and is deployed with `--no-verify-jwt`; the `redeem-giftcode` endpoint retains its normal JWT gateway verification.
- Both website and bot call the same `redeem-giftcode` Edge Function. The bot uses the Supabase anon key to invoke it; never expose service-role credentials or bot tokens.
- Runtime confirmation is separate: test `/redeem single` after changing signing behavior before claiming the bot path is verified.

## Other extras observed

- Recently Accepted Reservation queries `public.reservation_slots` where status is `Accepted` and nickname is not null, selecting nickname, position, time slot, update timestamp, furnace level and resource/speedup values.
- Other extra UI queries `public.troops_power` for game IDs and alliance data.

## Security note

Gift-code signing material must be server-only and configured through Supabase secrets. The currently fetched dedicated function source reads `GIFT_CODE_SIGN_SECRET` from the environment and rejects requests when it is absent; do not copy the secret into docs, logs, client code or memory. Reconcile the committed signing implementation with the tested deployed implementation before deployment.

## Change-impact checklist

- [ ] Preserve the client/server request and response contract.
- [ ] Confirm upstream response mapping for success, invalid code, already redeemed and player-not-found cases.
- [ ] Keep signing secret server-side; review fallback secret configuration.
- [ ] If `troops_power` deletion logic changes, confirm upstream invalid-player signal and exact row filter.
- [ ] If Recently Accepted fields change, inspect reservation schema and icon mapping in `js/app-core.js`.
- [ ] Check translations, modal layout and responsive behavior.

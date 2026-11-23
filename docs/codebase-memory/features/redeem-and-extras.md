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

- Slash-command endpoint: `supabase/functions/discord-interactions/index.ts`. It handles `/redeem single`, `/redeem alliance`, and admin-gated `/clear`; `/clear` requires the invoker's Manage Messages permission and deletes only messages authored by the bot in the invoking channel, including older-than-14-day messages individually.
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


## Discord text-channel polling (new)

- `supabase/functions/discord-message-poller/index.ts` polls the comma-separated `DISCORD_CHANNEL_IDS` Edge Function secret through Discord REST API; when unset it falls back to `1570961739846262876`. It does not require a persistent Gateway worker.
- Accepts `.redeem <ALLIANCE> <CODE>`; alliance is normalized to uppercase and validated against ARX, IDN, ZXC, VNX, CAT.
- Uses `public.discord_message_poll_state` (migration `supabase/migrations/20261116000000_discord_message_poll_state.sql`) for the global execution lock, and `public.discord_message_poll_channels` (migration `supabase/migrations/20261116010000_discord_message_poll_channels.sql`) for independent per-channel cursors.
- Requires Supabase Edge Function secrets `DISCORD_BOT_TOKEN`, `DISCORD_POLL_SECRET`, and optionally comma-separated `DISCORD_CHANNEL_IDS`; every configured channel needs View Channel / Read Message History / Send Messages and Message Content Intent enabled.
- Supabase Cron + pg_net + Vault invoke the poller every five minutes. First run seeds the cursor at the newest message and intentionally ignores prior channel history. Deploy independently with `.github/workflows/deploy-discord-message-poller.yml`; the existing slash-command deployment workflow is not changed.
- The poller reuses the existing `redeem-giftcode` Edge Function and does not modify the slash-command handler. It unwraps only object-shaped nested upstream payloads (not the upstream `data: []` array), classifies Century Games `TIME ERROR.` / `err_code: 40007` as expired, and retries network failures, request timeouts, HTTP 429/5xx, and unrecognized/transient responses up to three attempts per player. HTTP 429 honors `Retry-After` (capped at 15 seconds). After retries are exhausted, the player is marked Failed/Timed Out and processing continues; player-not-found and usage-limit outcomes also continue. Only confirmed invalid/expired gift codes stop the batch and mark remaining members skipped. Summaries show expired, invalid, skipped, and failed separately.
- When a text-channel alliance run has at least one successful redemption, the poller queues only that run's bot-authored progress/result message IDs in `public.discord_message_cleanup_queue` (migration `supabase/migrations/20261116020000_discord_message_cleanup_queue.sql`) for deletion eight hours after the batch finishes. The regular five-minute poller invocation deletes due messages; manually deleted messages are treated as complete, while other Discord deletion failures remain queued for retry. User-authored messages and runs with zero successful redemptions are not queued. Slash-command responses are unaffected.

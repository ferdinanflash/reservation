# 3475 Discord Bot — Redeem integration

This integration adds public `/redeem single` and `/redeem alliance` commands to the existing 3475 Supabase project. Both reuse the existing `redeem-giftcode` Edge Function and Century Games redemption flow used by the website.

## Public response policy

Every outcome is public in the channel where the command is used: success, invalid FID, invalid/expired/already-used code, and service errors. The interaction is deferred without Discord's EPHEMERAL flag, then its original response is edited. Long alliance results are split into additional public messages. FIDs and gift codes are included in public output as requested.

## Commands

### One player

```
/redeem single fid:<PLAYER_ID> code:<GIFT_CODE>
```

### Whole alliance

```
/redeem alliance alliance:<ARX|IDN|ZXC|VNX|CAT> code:<GIFT_CODE>
```

The alliance roster is read from `public.troops_power` using the `alliance` column and `game_id` values, matching the website's alliance quick-load behavior. Nicknames are included when available. Processing is sequential with a 1.2-second pause between members. Each player gets up to three attempts for network failures, request timeouts, HTTP 429/5xx responses, and unrecognized/transient upstream responses; HTTP 429 honors Retry-After (capped at 15 seconds). After retries are exhausted, that player is marked Failed/Timed Out and the bot continues with the next member. Player-not-found and usage-limit outcomes also do not stop the batch. Only a confirmed invalid or expired gift code stops the remaining batch, because the same code cannot succeed for the other members. Century Games `TIME ERROR.` / `err_code: 40007` is classified as expired. Remaining roster members are reported as skipped, not failed. One command processes at most 100 FIDs to keep the Discord interaction token within its usable lifetime.

## 1. Configure Supabase secrets

Generate a new high-entropy signing secret locally. Do not paste it into GitHub or chat:

```sh
supabase secrets set GIFT_CODE_SIGN_SECRET="YOUR_NEW_RANDOM_SECRET"
```

Ensure the project has its standard `SUPABASE_URL` and `SUPABASE_ANON_KEY` runtime variables. The function reads the alliance roster through the project's public anon key and existing table access policies. If `troops_power` does not permit anon SELECT for `game_id,nickname,alliance`, add a narrowly scoped, read-only policy or a dedicated server-side roster endpoint; do not expose the service-role key.

## 2. Configure Discord Interaction Endpoint

Deploy with JWT verification disabled because Discord authenticates requests using Ed25519 signatures:

```sh
supabase functions deploy discord-interactions --no-verify-jwt
```

Set the Discord Developer Portal **Interactions Endpoint URL** to:

```
https://pwqkpeykjyujhnreleax.supabase.co/functions/v1/discord-interactions
```

The function validates the raw request body using the Discord application's Public Key and rejects stale signed requests.

## 3. Deploy the redeem functions

After setting the new signing secret:

```sh
supabase functions deploy redeem-giftcode
```

The `discord-interactions` function calls the existing `redeem-giftcode` function using the public anon key. Do not put the Supabase service-role key in Discord, GitHub source, or browser code.


## Deploy the Edge Functions using GitHub Actions

1. In the GitHub repository, open **Settings → Secrets and variables → Actions**.
2. Add a repository secret named `SUPABASE_ACCESS_TOKEN`. Generate it from the Supabase account access-token page. Do not paste it into chat or commit it.
3. Open **Actions → Deploy 3475 Discord Redeem Functions → Run workflow**.
4. Confirm the workflow completes successfully. It deploys only `redeem-giftcode` and `discord-interactions`; it does not deploy or prune other functions.

The Discord endpoint is deployed with JWT verification disabled because it verifies Discord Ed25519 request signatures itself. The existing `redeem-giftcode` endpoint retains its normal JWT gateway verification.

## 4. Register slash commands

Use Node.js 20+ locally. Set the bot token only in your local shell; never commit it, send it in chat, or put it in browser code.

Linux/macOS:
```sh
export DISCORD_BOT_TOKEN="YOUR_BOT_TOKEN"
export DISCORD_APPLICATION_ID="1570932450849333450"
node scripts/register-discord-commands.mjs
```

PowerShell:
```powershell
$env:DISCORD_BOT_TOKEN="YOUR_BOT_TOKEN"
$env:DISCORD_APPLICATION_ID="1570932450849333450"
node scripts/register-discord-commands.mjs
```

For quicker testing, optionally set `DISCORD_GUILD_ID` to your server ID. Otherwise the command is registered globally.


## 5. Register commands through GitHub Actions (no token sharing)

For a mobile-friendly setup, add a repository Actions secret named `DISCORD_BOT_TOKEN` containing the bot token. Never paste it into a commit, issue, or chat. Optionally add a repository Actions variable named `DISCORD_GUILD_ID` containing your Discord server ID for immediate server-only registration.

Then open **GitHub → Actions → Register 3475 Discord Commands → Run workflow**. The workflow registers `/redeem single` and `/redeem alliance`.

If `DISCORD_GUILD_ID` is omitted, commands are registered globally and may take longer to appear.

## 6. Test

Try `/redeem single` first with a player and code you control. Then test `/redeem alliance` with a small alliance/code you control. Every result is public in the channel.

Never share bot tokens, Supabase service-role keys, or the new signing secret.


## 7. Read `.redeem` messages from multiple Discord channels (Supabase Cron)

The optional text-command listener polls one or more configured Discord text channels through the Discord REST API. It does not open a persistent Gateway connection and does not replace the existing slash commands.

Supported format:

```text
.redeem ARX ABC123
.redeem IDN XYZ789
```

Alliance names are normalized to uppercase. Supported alliances are ARX, IDN, ZXC, VNX, and CAT. The poller handles at most one redeem batch per Cron invocation, ignores bot/webhook messages, stores an independent message cursor for each channel, and caps each alliance run at 100 FIDs. When a text-channel alliance run has at least one successful redemption, the poller queues only the bot-authored progress and result messages from that run for deletion eight hours after the batch finishes. User messages and messages from runs with no successful redemptions are not queued. Due deletions are processed by the same five-minute poller schedule.

### Discord setup

1. In Discord Developer Portal, open the application → **Bot** → **Privileged Gateway Intents**.
2. Enable **Message Content Intent** and save. Discord also applies this intent to message content returned by the HTTP API.
3. For every channel you configure, ensure the bot has **View Channel**, **Read Message History**, and **Send Messages** permissions.
4. Copy each channel ID (Developer Mode → right-click channel → Copy Channel ID).

### Supabase secrets

Add these Edge Function secrets in Supabase → Project Settings → Edge Functions → Secrets:

- `DISCORD_BOT_TOKEN`: the bot token from Discord Developer Portal. Keep it secret.
- `DISCORD_POLL_SECRET`: a random secret used only to authenticate the scheduled poll request.
- `DISCORD_CHANNEL_IDS`: comma-separated channel IDs, for example `1570961739846262876,123456789012345678`. Include the existing channel ID if it should continue being monitored. If this setting is omitted, the poller falls back to the original channel `1570961739846262876`.

The project already supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. Never put the bot token or service-role key in GitHub source, SQL committed to the repository, or browser code.

### Deploy

Apply the migrations in order:

- `supabase/migrations/20261116000000_discord_message_poll_state.sql`
- `supabase/migrations/20261116010000_discord_message_poll_channels.sql`
- `supabase/migrations/20261116020000_discord_message_cleanup_queue.sql`

The second migration preserves the current channel cursor, so adding multi-channel support does not reset its message history.

Then run **GitHub → Actions → Deploy 3475 Discord Message Poller → Run workflow**. This separate workflow deploys only the `discord-message-poller` endpoint with JWT verification disabled; the endpoint validates its own `DISCORD_POLL_SECRET`. It deliberately does not redeploy the existing redeem backend or slash-command endpoint.

### Schedule every five minutes

The existing Cron job remains unchanged. It calls the poller every five minutes. Store the project URL and the exact same poll secret in Supabase Vault as described above. There is no need to create another Cron job when adding channels.

Each newly added channel gets its own baseline on its first poll; older messages in that channel are deliberately ignored. New messages are checked on the next five-minute poll, so command response latency can be up to about five minutes. The poller processes at most one alliance batch per Cron invocation to avoid overlapping long-running batches across channels.

### Test

After a new channel's first poll initializes its cursor, send a new command in that channel:

```text
.redeem ARX ABC123
```

Use a valid test gift code and be aware that the command redeems for the entire alliance roster. Do not test with a code unless you intend to redeem it for those players.

To disable polling, run:

```sql
select cron.unschedule('3475-discord-message-poller');
```

The existing `/redeem single` and `/redeem alliance` slash commands remain available independently.

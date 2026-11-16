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

The alliance roster is read from `public.troops_power` using the `alliance` column and `game_id` values, matching the website's alliance quick-load behavior. Nicknames are included when available. Processing is sequential with a 1.2-second pause between members and up to two timeout retries. Invalid/expired gift codes stop the remaining batch, matching website behavior. One command processes at most 100 FIDs to keep the Discord interaction token within its usable lifetime.

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


## 7. Read `.redeem` messages from one dedicated channel (Supabase Cron)

The optional text-command listener polls only Discord channel `1570961739846262876` using the Discord REST API. It does not open a persistent Gateway connection and does not replace the existing slash commands.

Supported format:

```text
.redeem ARX ABC123
.redeem IDN XYZ789
```

Alliance names are normalized to uppercase. Supported alliances are ARX, IDN, ZXC, VNX, and CAT. The poller handles one redeem batch per invocation, ignores bot/webhook messages, stores a message cursor, and caps each alliance run at 100 FIDs.

### Discord setup

1. In Discord Developer Portal, open the application → **Bot** → **Privileged Gateway Intents**.
2. Enable **Message Content Intent** and save. Discord also applies this intent to message content returned by the HTTP API.
3. Ensure the bot has **View Channel**, **Read Message History**, and **Send Messages** permissions in the dedicated channel.
4. Keep the channel ID fixed to the configured channel. The poller does not read other channels.

### Supabase secrets

Add these Edge Function secrets in Supabase → Project Settings → Edge Functions → Secrets:

- `DISCORD_BOT_TOKEN`: the bot token from Discord Developer Portal. Keep it secret.
- `DISCORD_POLL_SECRET`: a new random secret used only to authenticate the scheduled poll request.

The project already supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. Never put the bot token or service-role key in GitHub source, SQL committed to the repository, or browser code.

### Deploy

Apply the migration:

```text
supabase/migrations/20261116000000_discord_message_poll_state.sql
```

Then run the **Deploy 3475 Discord Redeem Functions** GitHub Actions workflow. It deploys the new `discord-message-poller` endpoint with JWT verification disabled; the endpoint validates its own `DISCORD_POLL_SECRET`.

### Schedule every minute

Enable the `pg_cron`, `pg_net`, and `vault` extensions in the Supabase Dashboard if they are not already enabled. In the SQL Editor, store the project URL and the exact same poll secret used above in Vault (replace the placeholder values locally; never commit them):

```sql
select vault.create_secret('https://pwqkpeykjyujhnreleax.supabase.co', 'discord_poller_project_url');
select vault.create_secret('REPLACE_WITH_THE_SAME_DISCORD_POLL_SECRET', 'discord_poller_secret');

select cron.schedule(
  '3475-discord-message-poller',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'discord_poller_project_url')
      || '/functions/v1/discord-message-poller',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'discord_poller_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  );
  $$
);
```

If either Vault secret name already exists, update that secret in the Vault UI instead of creating a duplicate. To inspect the job, run:

```sql
select jobid, jobname, schedule, active from cron.job
where jobname = '3475-discord-message-poller';
```

On its first run, the poller records the newest message as its starting point and deliberately ignores older channel history. New messages are checked on the next one-minute poll. A redeem batch can take longer than one polling interval; a database lock prevents overlapping poll runs.

### Test

After the first scheduled run initializes the cursor, send a test command in the dedicated channel:

```text
.redeem ARX ABC123
```

Use a valid test gift code and be aware that the command redeems for the entire alliance roster. Do not test with a code unless you intend to redeem it for those players.

To disable polling, run:

```sql
select cron.unschedule('3475-discord-message-poller');
```

The existing `/redeem single` and `/redeem alliance` slash commands remain available independently.

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

The alliance roster is read from `public.troops_power` using the `alliance` column and `game_id` values, matching the website's alliance quick-load behavior. Nicknames are included when available. Processing is sequential with a 1.2-second pause between members and timeout retries. Invalid/expired gift codes stop the remaining batch, matching website behavior. One command processes at most 500 FIDs to keep the Discord interaction token within its usable lifetime.

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

## 5. Test

Try `/redeem single` first with a player and code you control. Then test `/redeem alliance` with a small alliance/code you control. Every result is public in the channel.

Never share bot tokens, Supabase service-role keys, or the new signing secret.

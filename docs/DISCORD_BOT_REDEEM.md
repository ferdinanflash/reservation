# 3475 Discord Bot — Redeem integration

This integration adds a public `/redeem` command to the existing 3475 Supabase project. It reuses the existing `redeem-giftcode` Edge Function and the same Century Games redemption flow as the website.

## Public response policy

Every outcome is public in the channel where the command is used: success, invalid FID, invalid/expired/already-used code, and service errors. The interaction is deferred without Discord's EPHEMERAL flag, then its original response is edited. Do not add EPHEMERAL flags to this flow.

The command accepts FID and gift code as slash-command options. Discord controls how command arguments appear in the interaction UI; the bot's final result is explicitly public.

## 1. Configure Supabase secrets

Before deploying the updated `redeem-giftcode` function, set a newly generated, high-entropy signing secret. The old source fallback has been removed because it was present in repository history/source and must be treated as compromised.

Generate a new secret locally (do not paste it into GitHub or chat), then run:

```sh
supabase secrets set GIFT_CODE_SIGN_SECRET="YOUR_NEW_RANDOM_SECRET"
```

Also ensure the project has its standard `SUPABASE_URL` and `SUPABASE_ANON_KEY` runtime variables. Supabase supplies these to Edge Functions in supported deployments.

## 2. Configure the Discord Interaction Endpoint

Deploy the interaction function with JWT verification disabled because Discord authenticates requests using Ed25519 signatures:

```sh
supabase functions deploy discord-interactions --no-verify-jwt
```

Set the Discord Developer Portal **Interactions Endpoint URL** to:

```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/discord-interactions
```

The function verifies `X-Signature-Ed25519` and `X-Signature-Timestamp` against the raw request body using the application's public key. Discord's PING validation is supported.

## 3. Deploy the updated redeem function

After setting the new signing secret:

```sh
supabase functions deploy redeem-giftcode
```

Do not deploy before configuring the secret: the function intentionally fails closed when `GIFT_CODE_SIGN_SECRET` is missing.

## 4. Register the slash command

Use Node.js 20+ locally. Set the bot token only in your local shell; never commit it, send it in chat, or put it in browser code.

Linux/macOS:
```sh
export DISCORD_BOT_TOKEN="YOUR_BOT_TOKEN"
node scripts/register-discord-commands.mjs
```

PowerShell:
```powershell
$env:DISCORD_BOT_TOKEN="YOUR_BOT_TOKEN"
node scripts/register-discord-commands.mjs
```

By default the command is registered globally. For quicker testing, optionally set `DISCORD_GUILD_ID` to your server ID; then it is registered only in that server.

## 5. Test

In the invited server, run:

```
/redeem fid:<your-player-id> code:<gift-code>
```

The result is posted publicly in the same channel. Test first with a code/account you control. Never share bot tokens, Supabase service-role keys, or the new signing secret.

## Security notes

- The Discord interaction endpoint does not trust request JSON until the Ed25519 signature is verified.
- The interaction endpoint has no Bot Token and no Supabase service-role key.
- It calls the existing redeem Edge Function with the project's public anon key; the privileged signing secret remains server-side.
- FID and gift code are included in public result messages because the requested policy is fully public. Consider that before using this command in a public server.
- Do not log interaction tokens, bot tokens, FIDs, or gift codes.

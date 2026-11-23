# Discord multi-server announcements

The Reservation Portal supports one shared Discord bot serving multiple Discord servers (guilds). Every server has its own announcement channel, enable/disable setting, @everyone permission, and announcement history.

## Portal features

The President Panel contains two Discord actions:

- **Discord Servers** — add, edit, disable, remove, and review announcement history for each configured server.
- **Discord Announcement** — choose one configured server, compose a message, and optionally mention @everyone when that server explicitly permits it.

The President-managed announcement setup continues to use manually copied Discord Server IDs and Channel IDs. Reservation notification subscriptions can additionally be managed by server admins directly with Discord slash commands, without changing the President's announcement configuration. This avoids requiring an OAuth client secret or asking Presidents to authorize their personal Discord accounts. A future OAuth-based server picker can replace the manual ID fields without changing the bot's per-guild storage model.

## Security model

- Only Supabase Auth users whose email is one of the portal's configured President accounts (president, demon, or phoenix at the internal staff email domain) can manage servers or send Discord announcements. This is checked inside both Edge Functions; the browser's isAdmin flag is not trusted.
- Guild settings and announcement logs have RLS enabled and no browser-facing policies. Only trusted Edge Functions use the service-role key.
- The browser never receives the Discord bot token.
- A server's destination channel is read from server-side configuration; the announcement request cannot supply an arbitrary channel.
- Saving a server verifies that the bot can access the selected channel and that the channel belongs to the submitted guild.
- @everyone requires two independent approvals: allow_everyone = true for that guild, and the President explicitly checks the @everyone option for that message. Otherwise Discord receives allowed_mentions.parse = [].
- The log stores the server, channel, message, mention flag, sender, result, and Discord message ID (when successful).

## Apply database migration

Run supabase_migration_discord_multi_server_announcements.sql once in the Supabase SQL Editor. It creates:

- public.discord_guild_settings
- public.discord_announcement_log

Reservation notification subscriptions use the separate `public.discord_reservation_subscriptions` table, created by `supabase/migrations/20261123000000_discord_reservation_subscriptions.sql`. This table has RLS enabled and no browser-facing policies.

Do not add public or authenticated RLS policies to these tables.

## Configure secrets and deploy

Use the same existing bot token already used by the redeem bot. Do not commit it or paste it into the website:

    supabase secrets set DISCORD_BOT_TOKEN="YOUR_EXISTING_BOT_TOKEN"
    supabase functions deploy discord-guild-settings
    supabase functions deploy discord-announcement

Supabase injects SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY for Edge Functions. No OAuth client secret is required for this manual-ID setup.

## Add a Discord server

1. Invite the existing bot application to the target server if it is not already there.
2. In Discord, enable **User Settings → Advanced → Developer Mode**.
3. Copy the server ID (right-click the server icon/name → Copy Server ID).
4. Copy the announcement channel ID (right-click the channel → Copy Channel ID).
5. Sign in to the Reservation Portal as President and open **President Panel → Discord Servers**.
6. Enter the server name, server ID, and announcement channel ID. Enable announcements as needed.
7. Enable @everyone only if the server's administrators have explicitly approved it, and the bot has the **Mention @everyone, @here, and All Roles** permission in that channel.
8. Save. The API verifies the bot can access the channel and that it belongs to the supplied server.

The bot needs **View Channel**, **Send Messages**, and **Embed Links** in each destination channel. It needs the additional mention permission only when @everyone is enabled.

## Send an announcement

1. Open **President Panel → Discord Announcement**.
2. Choose one enabled server.
3. Enter an optional title and a message (up to 1,800 characters).
4. Optionally select @everyone if it is enabled for that server.
5. Send. The bot posts an embed to that server's configured channel.

The Discord message endpoint uses Discord's own permission checks and rate limits. Failed attempts are recorded with a coarse error code. The **History** action in Discord Servers displays the latest 30 attempts for that server.

## API request contracts

The browser calls /functions/v1/discord-guild-settings using the President's Supabase access token:

    { "action": "list" }

    {
      "action": "save",
      "guild_id": "123456789012345678",
      "guild_name": "Example Server",
      "channel_id": "234567890123456789",
      "announcements_enabled": true,
      "allow_everyone": false
    }

Other supported management actions are delete and history, each requiring a guild_id.

The browser sends announcements to /functions/v1/discord-announcement:

    {
      "guild_id": "123456789012345678",
      "title": "State Announcement",
      "message": "The announcement text",
      "mention_everyone": false
    }

## Existing bot features

The existing discord-interactions redeem endpoint and /redeem commands are unchanged. The existing Web Push send-announcement feature is also unchanged; Discord announcements are an additional, separate destination.

# Discord multi-server announcements

This adds a shared 3475 Discord bot announcement backend. One bot installation can serve multiple Discord guilds; each guild has an independent destination channel and independent @everyone permission.

## Current implementation scope

- `discord_guild_settings` stores one configuration per Discord server (guild).
- `discord_announcement_log` records successful and failed send attempts.
- `discord-announcement` sends an embed to the configured channel for exactly one selected guild.
- The endpoint requires a real Supabase Auth session (the portal's President login flow), uses the service role only server-side, and never exposes the bot token.
- @everyone is opt-in twice: the server configuration must allow it and the President must explicitly request it for that message. Without both, Discord receives `allowed_mentions.parse=[]`.

The configuration tables intentionally have no browser-facing RLS policies. Do not make them publicly readable or writable.

## Apply and deploy

1. Apply `supabase_migration_discord_multi_server_announcements.sql` in the Supabase SQL Editor.
2. Add the existing shared bot token as an Edge Function secret (never commit or paste it):

   ```sh
   supabase secrets set DISCORD_BOT_TOKEN="YOUR_EXISTING_BOT_TOKEN"
   ```

3. Deploy only the new function:

   ```sh
   supabase functions deploy discord-announcement
   ```

4. Invite the existing Discord application/bot to each target server. Grant only the permissions needed in the announcement channel: View Channel, Send Messages, and Embed Links. Grant Mention @everyone only where that server's administrators explicitly approve it.
5. Configure each server's guild ID and announcement channel ID. The initial foundation supports controlled server-side configuration; do not insert bot tokens or OAuth secrets into the database. The self-service OAuth/server-picker UI and secure configuration-management endpoint are a follow-up implementation step.

Example server-side SQL configuration (run only by the project owner after verifying the IDs):

```sql
insert into public.discord_guild_settings
    (guild_id, guild_name, announcement_channel_id, announcements_enabled, allow_everyone)
values
    ('123456789012345678', 'Example Server', '234567890123456789', true, false)
on conflict (guild_id) do update set
    guild_name = excluded.guild_name,
    announcement_channel_id = excluded.announcement_channel_id,
    announcements_enabled = excluded.announcements_enabled,
    allow_everyone = excluded.allow_everyone,
    updated_at = now();
```

## Request contract

POST to `/functions/v1/discord-announcement` with the signed-in President's Supabase access token:

```json
{
  "guild_id": "123456789012345678",
  "title": "State Announcement",
  "message": "The announcement text",
  "mention_everyone": false
}
```

A request cannot choose an arbitrary channel: the destination always comes from the selected guild's server-side configuration. A request with `mention_everyone: true` is rejected unless that guild has `allow_everyone = true`.

## Discord permission and rate-limit behavior

Discord must grant the bot Send Messages and Embed Links in the configured channel. To actually notify everyone, the bot additionally needs Mention @everyone, @here, and All Roles. Discord's API remains the authority on effective channel permissions. A failed send is recorded with a coarse Discord error code; the bot token and raw authorization headers are never logged.

The existing `discord-interactions` redeem endpoint and commands are unchanged. The existing Web Push `send-announcement` feature is also unchanged.

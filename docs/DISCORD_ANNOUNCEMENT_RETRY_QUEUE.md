# Discord Announcement Retry Queue (Stage 2.1)

Apply `supabase/migrations/20261125010000_discord_announcement_retry_queue.sql` before deploying the Edge Functions.

## Secrets

Set `DISCORD_ANNOUNCEMENT_QUEUE_SECRET` in Supabase Edge Function secrets to a new high-entropy value. Existing `DISCORD_BOT_TOKEN` and standard Supabase runtime secrets are reused. Never commit or paste secrets into SQL or GitHub.

## Schedule the worker

Store the same worker secret in Supabase Vault as `discord_announcement_queue_secret` (replace the placeholder locally; do not commit a real secret):

```sql
select vault.create_secret('REPLACE_WITH_THE_SAME_SECRET', 'discord_announcement_queue_secret');
```

Confirm pg_cron, pg_net, and Vault are enabled, then schedule every minute:

```sql
select cron.schedule(
  '3475-discord-announcement-retry',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://pwqkpeykjyujhnreleax.supabase.co/functions/v1/discord-announcement-retry',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'discord_announcement_queue_secret' limit 1)
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Deploy `discord-announcement-retry` with JWT verification disabled because it authenticates the request using `DISCORD_ANNOUNCEMENT_QUEUE_SECRET` itself. The migration deliberately does not schedule production delivery automatically. The operator must configure the Edge Function secret and Vault first.

## Behavior

- Immediate send retains up to four attempts.
- Only network/timeout/HTTP 408/429/5xx failures enter the queue; permanent permission and other 4xx errors are not blindly retried.
- Atomic claims use `FOR UPDATE SKIP LOCKED`, a lease token, and a 90-second lock.
- Exponential backoff is capped at one hour; maximum ten attempts.
- A persisted Discord nonce is reused with `enforce_nonce`.
- Server announcement settings are checked again before retry.
- The queue has no client-facing RLS policies; only service_role can access it.
- Migration and deployment do not send Discord messages.

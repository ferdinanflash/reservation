-- Queue only bot-authored Discord messages associated with successful
-- text-channel redeem runs. The poller deletes due messages on its next
-- five-minute invocation; user-authored messages are never stored here.

create table if not exists public.discord_message_cleanup_queue (
  message_id text primary key,
  channel_id text not null,
  delete_after timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists discord_message_cleanup_queue_delete_after_idx
  on public.discord_message_cleanup_queue (delete_after);

alter table public.discord_message_cleanup_queue enable row level security;

revoke all on table public.discord_message_cleanup_queue from public, anon, authenticated;
grant all on table public.discord_message_cleanup_queue to service_role;

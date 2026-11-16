-- Per-channel cursors for the 3475 Discord message poller.
-- Preserve the existing channel cursor so the current channel does not re-baseline.

create table if not exists public.discord_message_poll_channels (
  channel_id text primary key,
  last_message_id text,
  updated_at timestamptz not null default now()
);

alter table public.discord_message_poll_channels enable row level security;

insert into public.discord_message_poll_channels (channel_id, last_message_id, updated_at)
select '1570961739846262876', last_message_id, updated_at
from public.discord_message_poll_state
where id = 1
on conflict (channel_id) do nothing;

comment on table public.discord_message_poll_channels is
  'Private per-channel message cursors for the 3475 Discord text-channel redeem poller.';

-- 3475 Discord text-channel redeem poller state.
-- The table has no client-facing policies; the poller accesses it with the service-role key only.

create table if not exists public.discord_message_poll_state (
  id integer primary key check (id = 1),
  last_message_id text,
  lock_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.discord_message_poll_state enable row level security;

insert into public.discord_message_poll_state (id, last_message_id)
values (1, null)
on conflict (id) do nothing;

comment on table public.discord_message_poll_state is
  'Private cursor and execution lock for the 3475 Discord text-channel redeem poller.';

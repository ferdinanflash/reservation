-- Add an ownership token to the Discord poller lease.
-- The token prevents an expired invocation from clearing a newer invocation's lock.
alter table public.discord_message_poll_state
    add column if not exists lock_owner text;

comment on column public.discord_message_poll_state.lock_owner is
    'Unique owner token for the active Discord poller lease; only the matching owner may renew or release it.';

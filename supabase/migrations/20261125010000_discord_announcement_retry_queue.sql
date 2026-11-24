-- Durable retry queue for transient Discord Announcement delivery failures.
-- Service-role only: no browser/client policies are created.
create table if not exists public.discord_announcement_retry_queue (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null check (guild_id ~ '^[0-9]{17,20}$'),
  channel_id text not null check (channel_id ~ '^[0-9]{17,20}$'),
  title text not null check (char_length(title) <= 100),
  message text not null check (char_length(message) between 1 and 1800),
  mentioned_everyone boolean not null default false,
  sent_by uuid references auth.users(id) on delete set null,
  nonce text not null unique,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 10 check (max_attempts between 1 and 20),
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  lock_token uuid,
  last_error text,
  discord_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists discord_announcement_retry_due_idx
  on public.discord_announcement_retry_queue (next_attempt_at, created_at) where status = 'pending';
create index if not exists discord_announcement_retry_stale_lock_idx
  on public.discord_announcement_retry_queue (locked_until) where status = 'processing';
alter table public.discord_announcement_retry_queue enable row level security;
create or replace function public.claim_discord_announcement_retries(p_limit integer default 10, p_lock_seconds integer default 90)
returns setof public.discord_announcement_retry_queue
language plpgsql security definer set search_path = public
as $$
begin
  return query
  with candidates as (
    select q.id from public.discord_announcement_retry_queue q
    where ((q.status = 'pending' and q.next_attempt_at <= now())
      or (q.status = 'processing' and q.locked_until < now()))
      and q.attempts < q.max_attempts
    order by q.next_attempt_at, q.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 25))
  )
  update public.discord_announcement_retry_queue q
  set status = 'processing', attempts = q.attempts + 1,
      lock_token = gen_random_uuid(),
      locked_until = now() + make_interval(secs => greatest(30, least(coalesce(p_lock_seconds, 90), 300))),
      updated_at = now()
  from candidates c where q.id = c.id
  returning q.*;
end;
$$;
revoke all on function public.claim_discord_announcement_retries(integer, integer) from public, anon, authenticated;
grant execute on function public.claim_discord_announcement_retries(integer, integer) to service_role;
revoke all on table public.discord_announcement_retry_queue from anon, authenticated;
grant all on table public.discord_announcement_retry_queue to service_role;
comment on table public.discord_announcement_retry_queue is
  'Service-role-only retry queue for transient Discord Announcement failures. Reuses a stable nonce to reduce duplicates.';

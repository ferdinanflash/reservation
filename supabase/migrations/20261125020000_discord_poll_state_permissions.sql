-- Least-privilege hardening for private Discord poller state.
-- Both tables are accessed only by discord-message-poller using service_role.
-- RLS remains enabled with no client-facing policies.

revoke all on table public.discord_message_poll_state from public, anon, authenticated;
revoke all on table public.discord_message_poll_channels from public, anon, authenticated;
grant all on table public.discord_message_poll_state to service_role;
grant all on table public.discord_message_poll_channels to service_role;

-- Pin the SECURITY DEFINER function to trusted schemas only.
alter function public.claim_discord_announcement_retries(integer, integer)
  set search_path = pg_catalog, public;

revoke all on function public.claim_discord_announcement_retries(integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_discord_announcement_retries(integer, integer)
  to service_role;

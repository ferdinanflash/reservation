-- SvS Enemies: persistent cache of WoS Atlas data per State.
-- Run once in Supabase SQL Editor. Safe to re-run.
--
-- Why: the browser used to call wosatlas.com directly (~10 requests per State per
-- visitor) and tripped its rate limit. Now the edge function `wosatlas-states`
-- (action "refresh") fetches slowly, one State at a time, and stores the result
-- here. Browsers only read this table.
--
-- Everyone can read. Nobody but the service role (the edge function) can write,
-- because no INSERT/UPDATE policy exists.

CREATE TABLE IF NOT EXISTS public.svs_enemy_cache (
    kid          integer PRIMARY KEY,
    payload      jsonb,                         -- last GOOD result; kept when a refresh fails
    fetched_at   timestamptz,                   -- when payload was last updated successfully
    attempted_at timestamptz,                   -- last refresh attempt (used for throttling)
    last_error   text
);

ALTER TABLE public.svs_enemy_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "svs_enemy_cache_public_read" ON public.svs_enemy_cache;
CREATE POLICY "svs_enemy_cache_public_read"
ON public.svs_enemy_cache
FOR SELECT
TO anon, authenticated
USING (true);

-- ---------------------------------------------------------------------------
-- OPTIONAL: refresh every 15 minutes even when nobody has the page open.
-- Without this the cache is still refreshed lazily when a visitor opens the page
-- and the data is older than ~15 minutes. To enable, enable the pg_cron and
-- pg_net extensions (Database -> Extensions), fill in the two values, and run:
--
-- SELECT cron.schedule(
--   'svs-enemy-refresh',
--   '*/15 * * * *',
--   $$ SELECT net.http_post(
--        url     := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/wosatlas-states',
--        headers := '{"Content-Type":"application/json","Authorization":"Bearer YOUR_ANON_KEY"}'::jsonb,
--        body    := '{"action":"refresh"}'::jsonb
--      ) $$
-- );
-- ---------------------------------------------------------------------------

-- Serialize all Discord redeem workers globally and defer upstream rate-limited players.
ALTER TABLE public.discord_redeem_jobs
    ADD COLUMN IF NOT EXISTS next_run_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.discord_redeem_global_lock (
    id smallint PRIMARY KEY CHECK (id = 1),
    lock_token text,
    locked_until timestamptz
);

INSERT INTO public.discord_redeem_global_lock (id, lock_token, locked_until)
VALUES (1, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.discord_redeem_global_lock ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.discord_redeem_global_lock FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.discord_redeem_global_lock TO service_role;

CREATE OR REPLACE FUNCTION public.acquire_discord_redeem_global_lock(p_lock_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    UPDATE public.discord_redeem_global_lock
    SET lock_token = p_lock_token,
        locked_until = pg_catalog.now() + interval '5 minutes'
    WHERE id = 1
      AND (lock_token IS NULL OR locked_until IS NULL OR locked_until < pg_catalog.now());
    RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_discord_redeem_global_lock(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_discord_redeem_global_lock(text) TO service_role;

CREATE OR REPLACE FUNCTION public.release_discord_redeem_global_lock(p_lock_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    UPDATE public.discord_redeem_global_lock
    SET lock_token = NULL, locked_until = NULL
    WHERE id = 1 AND lock_token = p_lock_token;
    RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.release_discord_redeem_global_lock(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_discord_redeem_global_lock(text) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_discord_redeem_job(
    p_job_id uuid,
    p_lock_token text
)
RETURNS SETOF public.discord_redeem_jobs
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    UPDATE public.discord_redeem_jobs AS job
    SET
        status = 'processing',
        lock_token = p_lock_token,
        locked_until = pg_catalog.now() + interval '2 minutes',
        updated_at = pg_catalog.now()
    WHERE job.id = p_job_id
      AND job.expires_at > pg_catalog.now()
      AND job.next_run_at <= pg_catalog.now()
      AND (
          job.status = 'queued'
          OR (
              job.status = 'processing'
              AND (job.locked_until IS NULL OR job.locked_until < pg_catalog.now())
          )
      )
    RETURNING job.*;
$$;

REVOKE ALL ON FUNCTION public.claim_discord_redeem_job(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_discord_redeem_job(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.list_due_discord_redeem_jobs()
RETURNS TABLE(job_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT job.id
    FROM public.discord_redeem_jobs AS job
    WHERE job.expires_at > pg_catalog.now()
      AND job.next_run_at <= pg_catalog.now()
      AND (
          job.status = 'queued'
          OR (
              job.status = 'processing'
              AND (job.locked_until IS NULL OR job.locked_until < pg_catalog.now())
          )
      )
    ORDER BY job.created_at
    LIMIT 20;
$$;

REVOKE ALL ON FUNCTION public.list_due_discord_redeem_jobs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_due_discord_redeem_jobs() TO service_role;

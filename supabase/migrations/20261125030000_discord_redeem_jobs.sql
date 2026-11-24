-- Durable per-player redeem jobs prevent long alliance batches from being
-- terminated by the Edge Function wall-clock limit.
CREATE TABLE IF NOT EXISTS public.discord_redeem_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id text NOT NULL,
    interaction_token text,
    heading text NOT NULL,
    code text NOT NULL,
    members jsonb NOT NULL DEFAULT '[]'::jsonb,
    results jsonb NOT NULL DEFAULT '[]'::jsonb,
    next_index integer NOT NULL DEFAULT 0 CHECK (next_index >= 0),
    total integer NOT NULL CHECK (total > 0),
    note text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    lock_token text,
    locked_until timestamptz,
    last_error text,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS discord_redeem_jobs_status_lock_idx
    ON public.discord_redeem_jobs (status, locked_until, created_at);

ALTER TABLE public.discord_redeem_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.discord_redeem_jobs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.discord_redeem_jobs TO service_role;

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

-- Recovery scanner: finds queued jobs and processing jobs whose lease expired.
CREATE OR REPLACE FUNCTION public.list_due_discord_redeem_jobs()
RETURNS TABLE(job_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT job.id
    FROM public.discord_redeem_jobs AS job
    WHERE job.expires_at > pg_catalog.now()
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

-- Reuse the already-configured queue-worker secret from Vault. The Edge Function
-- validates it before accepting this internal recovery action.
SELECT cron.schedule(
    'discord-redeem-job-recovery-every-minute',
    '* * * * *',
    $job$
        SELECT net.http_post(
            url := 'https://pwqkpeykjyujhnreleax.supabase.co/functions/v1/discord-interactions',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || (
                    SELECT decrypted_secret
                    FROM vault.decrypted_secrets
                    WHERE name = 'discord_announcement_queue_secret'
                    LIMIT 1
                )
            ),
            body := '{"internal_action":"resume_due_redeem_jobs"}'::jsonb,
            timeout_milliseconds := 10000
        );
    $job$
);

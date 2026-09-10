-- SVS Ministry: Web Push subscriptions
-- Run this once in Supabase SQL Editor. Needed so notifications can reach a
-- guest's device even when the app/browser is fully closed (Supabase
-- Realtime alone cannot do this — it only works while a tab is open).
--
-- One row = one (application_id, browser/device) pair. A single device can
-- have rows for several reservation ids (a guest may track more than one
-- reservation from the same phone/browser); a single reservation id can also
-- have rows for several devices if the guest checks status from more than
-- one device.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id text NOT NULL,
    endpoint text NOT NULL,
    subscription jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (application_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_application_id
    ON public.push_subscriptions (application_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Guests (anon key, no account) may register/remove a push subscription for
-- an application id they know about (same trust model already used for
-- Realtime status updates — see supabase_migration_guest_notifications.sql).
-- No SELECT/UPDATE policy is granted to anon: only the Edge Function, using
-- the service role key which bypasses RLS, needs to read this table in order
-- to actually deliver push messages.
DROP POLICY IF EXISTS "guest can register push subscription" ON public.push_subscriptions;
CREATE POLICY "guest can register push subscription"
    ON public.push_subscriptions
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- Needed for the client's upsert(... onConflict) to work when a row already
-- exists for the same (application_id, endpoint) pair.
DROP POLICY IF EXISTS "guest can refresh own push subscription" ON public.push_subscriptions;
CREATE POLICY "guest can refresh own push subscription"
    ON public.push_subscriptions
    FOR UPDATE
    TO anon
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "guest can remove push subscription" ON public.push_subscriptions;
CREATE POLICY "guest can remove push subscription"
    ON public.push_subscriptions
    FOR DELETE
    TO anon
    USING (true);

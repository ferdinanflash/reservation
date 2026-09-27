-- SVS Ministry: keep push_subscriptions lean over time
-- Run this once in Supabase SQL Editor, AFTER supabase_migration_push_subscriptions.sql.
--
-- Finish SvS no longer deletes any push_subscriptions rows (see app-waiting.js).
-- Left on its own, that table would grow forever: every SvS season creates a
-- new application_id, and each device (browser endpoint) would pile up one
-- row per season it ever participated in. This migration adds two things:
--
--   1. One row per device: whenever a device gets a subscription row saved
--      (new application_id, same browser), any older row(s) for that same
--      endpoint are dropped automatically. A device only ever needs the most
--      recent mapping to know which application to notify it about.
--
--   2. 30-day auto-expiry: a daily job deletes any subscription that has not
--      been touched (re-saved) in 30 days -- i.e. a guest who has not
--      opened/used the app in a month. "Touched" is tracked by a new
--      last_seen_at column, updated automatically on every insert/update,
--      so an actively-returning guest is never deleted just because their
--      row is old.

-- ---------------------------------------------------------------------
-- 0. Track "last seen" separately from "first created"
-- ---------------------------------------------------------------------
ALTER TABLE public.push_subscriptions
    ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.touch_push_subscription_last_seen()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.last_seen_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_push_subscription_last_seen ON public.push_subscriptions;
CREATE TRIGGER trg_touch_push_subscription_last_seen
BEFORE INSERT OR UPDATE ON public.push_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.touch_push_subscription_last_seen();

-- ---------------------------------------------------------------------
-- 1. Keep only one row per device (endpoint)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.keep_single_push_subscription_per_device()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.push_subscriptions
    WHERE endpoint = NEW.endpoint
      AND id <> NEW.id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_keep_single_push_subscription_per_device ON public.push_subscriptions;
CREATE TRIGGER trg_keep_single_push_subscription_per_device
AFTER INSERT OR UPDATE ON public.push_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.keep_single_push_subscription_per_device();

-- ---------------------------------------------------------------------
-- 2. Daily auto-delete of subscriptions untouched for 30+ days
-- ---------------------------------------------------------------------
-- Requires the pg_cron extension. On Supabase this is normally a one-click
-- enable under Database -> Extensions (search "pg_cron"); the CREATE
-- EXTENSION below also works directly from the SQL Editor on most projects.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Re-runnable: drop any existing job with this name first so re-running this
-- migration doesn't create duplicate schedules.
DO $$
BEGIN
    PERFORM cron.unschedule('cleanup_stale_push_subscriptions');
EXCEPTION WHEN OTHERS THEN
    NULL; -- job didn't exist yet, nothing to remove
END;
$$;

SELECT cron.schedule(
    'cleanup_stale_push_subscriptions',
    '0 3 * * *', -- every day at 03:00 UTC
    $$DELETE FROM public.push_subscriptions WHERE last_seen_at < now() - interval '30 days';$$
);

-- ---------------------------------------------------------------------
-- Optional: run this manually any time to see what a cleanup would remove
-- without actually deleting anything yet:
--   SELECT * FROM public.push_subscriptions WHERE last_seen_at < now() - interval '30 days';
-- ---------------------------------------------------------------------

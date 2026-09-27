-- SVS Ministry: keep push_subscriptions lean over time
-- Run this once in Supabase SQL Editor, AFTER supabase_migration_push_subscriptions.sql.
--
-- IMPORTANT: if you already ran an EARLIER version of this file that
-- scheduled a 30-day pg_cron deletion job, undo that first (it would keep
-- deleting valid subscriptions and this file no longer recreates it):
--   SELECT cron.unschedule('cleanup_stale_push_subscriptions');
--
-- Finish SvS no longer deletes any push_subscriptions rows (see app-waiting.js).
-- Left on its own, that table would grow forever: every SvS season creates a
-- new application_id, and each device (browser endpoint) would pile up one
-- row per season it ever participated in. This migration keeps it lean with
-- ONE mechanism only:
--
--   One row per device: whenever a device gets a subscription row saved
--   (new application_id, same browser), any older row(s) for that same
--   endpoint are dropped automatically. A device only ever needs its most
--   recent mapping, and that single row keeps receiving announcements
--   indefinitely -- it is never deleted just for being old (see part 2).

-- ---------------------------------------------------------------------
-- 0. Track "last seen" (informational only -- not used to delete anything,
--    kept so you can eyeball how recently active each device's mapping is)
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
-- 2. Genuinely-dead subscriptions are already cleaned up elsewhere
-- ---------------------------------------------------------------------
-- NOT handled here on purpose. Both supabase/functions/send-announcement
-- and supabase/functions/send-push-notification already delete a row the
-- moment a push actually fails with 404/410 (browser/OS says the endpoint
-- is gone -- uninstalled, permission revoked, etc.). That is the correct
-- signal for "this device is really gone."
--
-- A time-based rule ("delete if untouched for 30 days") was considered and
-- deliberately left out: with only one row per device (trigger above), that
-- row IS the device's only way to receive announcements. A guest who hasn't
-- submitted a new application in 30+ days but still has the app/permission
-- installed would stop getting announcements for no real reason. Relying on
-- the reactive 404/410 cleanup above keeps every still-valid device
-- reachable indefinitely, and only drops ones that are actually gone.


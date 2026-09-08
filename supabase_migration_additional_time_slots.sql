-- SVS Ministry: Additional Preferred Time Slot feature
-- Run this once in Supabase SQL Editor before deploying the updated frontend.
--
-- Stores up to 3 backup time slots an applicant picked in case their main
-- selected time_slot is not available, e.g. '["01:00","02:30","14:00"]'.
-- Always a JSON array of "HH:MM" strings (UTC), defaults to an empty array.

ALTER TABLE public.reservation_slots
ADD COLUMN IF NOT EXISTS additional_time_slots jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Safety net: make sure the column is never left NULL, even if a client
-- inserts without sending it (mirrors the pattern already used for time_log).
CREATE OR REPLACE FUNCTION public.ensure_reservation_additional_slots_on_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.additional_time_slots IS NULL THEN
        NEW.additional_time_slots := '[]'::jsonb;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reservation_additional_slots_on_insert ON public.reservation_slots;
CREATE TRIGGER trg_reservation_additional_slots_on_insert
BEFORE INSERT ON public.reservation_slots
FOR EACH ROW
EXECUTE FUNCTION public.ensure_reservation_additional_slots_on_insert();

-- Backfill any existing rows created before this column existed.
UPDATE public.reservation_slots
SET additional_time_slots = '[]'::jsonb
WHERE additional_time_slots IS NULL;

-- Optional: if your project uses explicit column privileges, make sure the
-- authenticated/anon client can read/write this new JSONB column under the
-- same reservation_slots policies already used by this application.

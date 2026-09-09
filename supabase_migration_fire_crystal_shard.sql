-- SVS Ministry: Fire Crystal Shard field (Vice President D2)
-- Run this once in Supabase SQL Editor before deploying the updated frontend.
--
-- Stores the amount of Fire Crystal Shards an applicant has, shown/collected
-- only for the "Vice President D2" position (hidden for other positions via
-- POSITION_CONFIG.hiddenFields on the frontend). Defaults to 0, same pattern
-- as the existing fire_crystal / refined_fire_crystal columns.

ALTER TABLE public.reservation_slots
ADD COLUMN IF NOT EXISTS fire_crystal_shard integer NOT NULL DEFAULT 0;

-- Safety net: make sure the column is never left NULL, even if a client
-- inserts without sending it (mirrors the pattern already used for
-- additional_time_slots / time_log).
CREATE OR REPLACE FUNCTION public.ensure_reservation_fire_crystal_shard_on_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.fire_crystal_shard IS NULL THEN
        NEW.fire_crystal_shard := 0;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reservation_fire_crystal_shard_on_insert ON public.reservation_slots;
CREATE TRIGGER trg_reservation_fire_crystal_shard_on_insert
BEFORE INSERT ON public.reservation_slots
FOR EACH ROW
EXECUTE FUNCTION public.ensure_reservation_fire_crystal_shard_on_insert();

-- Backfill any existing rows created before this column existed.
UPDATE public.reservation_slots
SET fire_crystal_shard = 0
WHERE fire_crystal_shard IS NULL;

-- Optional: if your project uses explicit column privileges, make sure the
-- authenticated/anon client can read/write this new column under the same
-- reservation_slots policies already used by this application.

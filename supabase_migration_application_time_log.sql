-- SVS Ministry: persistent application time log
-- Run this once in Supabase SQL Editor before deploying the updated frontend.

ALTER TABLE public.reservation_slots
ADD COLUMN IF NOT EXISTS time_log jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Backfill the creation event for existing applications when created_at exists.
-- This block is safe even if an older database does not have created_at.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'reservation_slots'
          AND column_name = 'created_at'
    ) THEN
        EXECUTE $sql$
            UPDATE public.reservation_slots
            SET time_log = jsonb_build_array(
                jsonb_build_object(
                    'action', 'created',
                    'at', created_at,
                    'actor', 'Applicant',
                    'detail', time_slot || ' UTC'
                )
            )
            WHERE (time_log IS NULL OR time_log = '[]'::jsonb)
              AND created_at IS NOT NULL
        $sql$;
    END IF;
END $$;

-- Optional: if your project uses explicit column privileges, make sure the
-- authenticated client can read/write the new JSONB column under the same
-- reservation_slots policies already used by this application.

-- Safety net: applications created by any client are guaranteed to receive
-- a creation entry even if that client does not send time_log itself.
CREATE OR REPLACE FUNCTION public.ensure_reservation_time_log_on_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.time_log IS NULL OR NEW.time_log = '[]'::jsonb THEN
        NEW.time_log := jsonb_build_array(
            jsonb_build_object(
                'action', 'created',
                'at', now(),
                'actor', 'Applicant',
                'detail', COALESCE(NEW.time_slot, '') || ' UTC'
            )
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reservation_time_log_on_insert ON public.reservation_slots;
CREATE TRIGGER trg_reservation_time_log_on_insert
BEFORE INSERT ON public.reservation_slots
FOR EACH ROW
EXECUTE FUNCTION public.ensure_reservation_time_log_on_insert();

-- SVS Ministry: editable How to Use notes, stored per position + language.
CREATE TABLE IF NOT EXISTS public.how_to_use_notes (
    position text NOT NULL,
    language text NOT NULL,
    content text NOT NULL DEFAULT '',
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (position, language)
);

ALTER TABLE public.how_to_use_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "how_to_use_notes_public_read" ON public.how_to_use_notes;
CREATE POLICY "how_to_use_notes_public_read"
ON public.how_to_use_notes
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "how_to_use_notes_authenticated_write" ON public.how_to_use_notes;
CREATE POLICY "how_to_use_notes_authenticated_write"
ON public.how_to_use_notes
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "how_to_use_notes_authenticated_update" ON public.how_to_use_notes;
CREATE POLICY "how_to_use_notes_authenticated_update"
ON public.how_to_use_notes
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

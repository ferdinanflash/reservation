-- SVS Ministry: seasonal banner theme shared with ALL visitors.
-- Run this once in Supabase SQL Editor BEFORE deploying the updated frontend.
--
-- Previously the President's Theme Switcher only saved the chosen theme in the
-- President's own browser (localStorage), so nobody else ever saw it. The
-- choice now lives in this single-row table: every visitor reads it on load
-- and receives changes instantly through Supabase Realtime.
--
--   theme_override = 'auto'       -> follow the calendar (Halloween / Christmas)
--                    'halloween'  -> force Halloween for everyone
--                    'christmas'  -> force Christmas for everyone
--                    'none'       -> force the plain fire banner for everyone

CREATE TABLE IF NOT EXISTS public.theme_settings (
    id text PRIMARY KEY,
    theme_override text NOT NULL DEFAULT 'auto'
        CHECK (theme_override IN ('auto', 'halloween', 'christmas', 'none')),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- The one row the app reads/writes.
INSERT INTO public.theme_settings (id, theme_override)
VALUES ('main', 'auto')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.theme_settings ENABLE ROW LEVEL SECURITY;

-- Everyone (guests included) must be able to READ the current theme.
DROP POLICY IF EXISTS "theme_settings_public_read" ON public.theme_settings;
CREATE POLICY "theme_settings_public_read"
ON public.theme_settings
FOR SELECT
TO anon, authenticated
USING (true);

-- Only logged-in staff can change it (same pattern as how_to_use_notes).
DROP POLICY IF EXISTS "theme_settings_authenticated_write" ON public.theme_settings;
CREATE POLICY "theme_settings_authenticated_write"
ON public.theme_settings
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "theme_settings_authenticated_update" ON public.theme_settings;
CREATE POLICY "theme_settings_authenticated_update"
ON public.theme_settings
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Enable Realtime so open pages switch theme instantly (safe to re-run).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'theme_settings'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.theme_settings;
    END IF;
END $$;

-- SVS Ministry: enemy State IDs shown on the SvS Enemies menu.
-- Run once in Supabase SQL Editor. Safe to re-run.
--
-- enemy_kids = comma-separated State IDs (e.g. '3480,3491,3502').
-- Everyone can read; only authenticated staff (President login) can write.

CREATE TABLE IF NOT EXISTS public.svs_enemies_settings (
    id text PRIMARY KEY,
    enemy_kids text NOT NULL DEFAULT '',
    updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.svs_enemies_settings (id, enemy_kids)
VALUES ('main', '')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.svs_enemies_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "svs_enemies_public_read" ON public.svs_enemies_settings;
CREATE POLICY "svs_enemies_public_read"
ON public.svs_enemies_settings
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "svs_enemies_authenticated_write" ON public.svs_enemies_settings;
CREATE POLICY "svs_enemies_authenticated_write"
ON public.svs_enemies_settings
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "svs_enemies_authenticated_update" ON public.svs_enemies_settings;
CREATE POLICY "svs_enemies_authenticated_update"
ON public.svs_enemies_settings
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'svs_enemies_settings'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.svs_enemies_settings;
    END IF;
END $$;

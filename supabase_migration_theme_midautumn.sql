-- SVS Ministry: allow the new 'midautumn' (Mid-Autumn Festival) seasonal theme (this also keeps 'cny' and 'eid')
-- in theme_settings.
-- Run this once in Supabase SQL Editor (safe to re-run) BEFORE the President
-- uses the "Mid-Autumn Festival" option in the Theme Switcher.
--
-- Why: the table's CHECK constraint only allows the theme names known when it
-- was last updated ('auto', 'halloween', 'christmas', 'valentine', 'cny', 'eid', 'none'),
-- so saving 'midautumn' would be rejected by the database. This drops that old check
-- (whatever its name is) and adds the new one. Existing data and policies are
-- untouched.

DO $$
DECLARE
    c record;
BEGIN
    FOR c IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE nsp.nspname = 'public'
          AND rel.relname = 'theme_settings'
          AND con.contype = 'c'
          AND pg_get_constraintdef(con.oid) ILIKE '%theme_override%'
    LOOP
        EXECUTE format('ALTER TABLE public.theme_settings DROP CONSTRAINT %I', c.conname);
    END LOOP;
END $$;

ALTER TABLE public.theme_settings
    ADD CONSTRAINT theme_settings_theme_override_check
    CHECK (theme_override IN ('auto', 'halloween', 'christmas', 'valentine', 'cny', 'eid', 'midautumn', 'none'));

-- Add the Blue Fire theme to the shared President Theme Switcher.
-- Run this once in Supabase SQL Editor after the existing theme_settings migration.
-- Blue Fire is manual-only; it is never selected by calendar auto mode.

ALTER TABLE public.theme_settings
    DROP CONSTRAINT IF EXISTS theme_settings_theme_override_check;

ALTER TABLE public.theme_settings
    ADD CONSTRAINT theme_settings_theme_override_check
    CHECK (theme_override IN (
        'auto', 'halloween', 'christmas', 'valentine', 'cny', 'eid',
        'midautumn', 'bluefire', 'none'
    ));

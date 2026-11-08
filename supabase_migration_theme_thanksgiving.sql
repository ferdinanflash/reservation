
-- Add the Thanksgiving theme to the shared President Theme Switcher.
-- Run this once in Supabase SQL Editor (after the earlier theme migrations).
-- Thanksgiving is also automatic in calendar auto mode (3 - 30 November).
-- This keeps every existing theme value and only adds 'thanksgiving'.

ALTER TABLE public.theme_settings
    DROP CONSTRAINT IF EXISTS theme_settings_theme_override_check;

ALTER TABLE public.theme_settings
    ADD CONSTRAINT theme_settings_theme_override_check
    CHECK (theme_override IN (
        'auto', 'halloween', 'christmas', 'valentine', 'cny', 'eid',
        'midautumn', 'bluefire', 'thanksgiving', 'none'
    ));

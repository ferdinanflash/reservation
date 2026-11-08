-- Optional: store main-menu button label preference (svs | tal).
-- Safe to re-run. Without this column the UI still works via localStorage.

ALTER TABLE public.svs_enemies_settings
    ADD COLUMN IF NOT EXISTS menu_label text NOT NULL DEFAULT 'svs';

-- Allow only the two display modes we support
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'svs_enemies_settings_menu_label_check'
    ) THEN
        ALTER TABLE public.svs_enemies_settings
            ADD CONSTRAINT svs_enemies_settings_menu_label_check
            CHECK (menu_label IN ('svs', 'tal'));
    END IF;
END $$;

-- Global switch for New Reservation Request Discord notifications.
-- Other reservation notifications and per-server announcement settings are independent.
CREATE TABLE IF NOT EXISTS public.discord_notification_settings (
    setting_key text PRIMARY KEY CHECK (setting_key = 'new_reservation_request'),
    enabled boolean NOT NULL DEFAULT true,
    updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.discord_notification_settings (setting_key, enabled)
VALUES ('new_reservation_request', true)
ON CONFLICT (setting_key) DO NOTHING;

ALTER TABLE public.discord_notification_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.discord_notification_settings FROM anon, authenticated;
GRANT ALL ON TABLE public.discord_notification_settings TO service_role;

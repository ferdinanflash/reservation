-- 3475 SOURCE OWNERSHIP | Copyright (c) 2026 Ferdinan | https://3475.web.id
-- Self-service Discord Reservation notification subscriptions.
-- Apply once in the Supabase SQL Editor before deploying the updated Edge Functions.

CREATE TABLE IF NOT EXISTS public.discord_reservation_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id text NOT NULL CHECK (guild_id ~ '^[0-9]{17,20}$'),
    channel_id text NOT NULL CHECK (channel_id ~ '^[0-9]{17,20}$'),
    channel_name text NOT NULL DEFAULT '',
    alliance text NOT NULL CHECK (alliance IN ('ARX', 'IDN', 'ZXC', 'VNX', 'CAT')),
    subscribed_by text NOT NULL CHECK (subscribed_by ~ '^[0-9]{17,20}$'),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT discord_reservation_subscriptions_unique UNIQUE (guild_id, channel_id, alliance)
);

CREATE INDEX IF NOT EXISTS discord_reservation_subscriptions_alliance_idx
    ON public.discord_reservation_subscriptions (alliance, created_at);

CREATE INDEX IF NOT EXISTS discord_reservation_subscriptions_channel_idx
    ON public.discord_reservation_subscriptions (guild_id, channel_id);

ALTER TABLE public.discord_reservation_subscriptions ENABLE ROW LEVEL SECURITY;

-- Only trusted Edge Functions using SUPABASE_SERVICE_ROLE_KEY can access subscriptions.
REVOKE ALL ON public.discord_reservation_subscriptions FROM anon, authenticated;
GRANT ALL ON public.discord_reservation_subscriptions TO service_role;

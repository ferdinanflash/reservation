-- 3475 SOURCE OWNERSHIP | Copyright (c) 2026 Ferdinan | https://3475.web.id
-- Discord multi-server announcement configuration.
-- Apply once in the Supabase SQL Editor before deploying discord-announcement.

CREATE TABLE IF NOT EXISTS public.discord_guild_settings (
    guild_id text PRIMARY KEY CHECK (guild_id ~ '^[0-9]{17,20}$'),
    guild_name text NOT NULL DEFAULT '',
    announcement_channel_id text NOT NULL CHECK (announcement_channel_id ~ '^[0-9]{17,20}$'),
    announcements_enabled boolean NOT NULL DEFAULT true,
    allow_everyone boolean NOT NULL DEFAULT false,
    configured_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.discord_announcement_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id text NOT NULL REFERENCES public.discord_guild_settings(guild_id) ON DELETE CASCADE,
    channel_id text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    mentioned_everyone boolean NOT NULL DEFAULT false,
    discord_message_id text,
    status text NOT NULL CHECK (status IN ('sent', 'failed')),
    error_code text,
    sent_by uuid,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS discord_announcement_log_guild_created_idx
    ON public.discord_announcement_log (guild_id, created_at DESC);

ALTER TABLE public.discord_guild_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discord_announcement_log ENABLE ROW LEVEL SECURITY;

-- Deliberately create no anon/authenticated policies. Only trusted Edge
-- Functions using SUPABASE_SERVICE_ROLE_KEY may read or mutate these tables.
REVOKE ALL ON public.discord_guild_settings FROM anon, authenticated;
REVOKE ALL ON public.discord_announcement_log FROM anon, authenticated;
GRANT ALL ON public.discord_guild_settings TO service_role;
GRANT ALL ON public.discord_announcement_log TO service_role;

ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS certificate_bg_url text;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS default_certificate_bg_url text;
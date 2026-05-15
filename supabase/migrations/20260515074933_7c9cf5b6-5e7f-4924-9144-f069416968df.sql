ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarded boolean NOT NULL DEFAULT false;
-- Mark existing staff as onboarded (only new hires going forward need it)
UPDATE public.profiles SET onboarded = true WHERE onboarded = false;
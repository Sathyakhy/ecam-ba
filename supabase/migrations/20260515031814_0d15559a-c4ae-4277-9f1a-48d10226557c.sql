CREATE TABLE public.app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  app_name TEXT NOT NULL DEFAULT 'Department OS',
  tagline TEXT NOT NULL DEFAULT 'Internal workspace',
  hero_title TEXT NOT NULL DEFAULT 'Onboarding, learning, and team operations.',
  hero_description TEXT NOT NULL DEFAULT 'A single internal workspace to onboard new staff, run training, track tasks and keep your department coordinated.',
  logo_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = 1)
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone read settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "admin update settings" ON public.app_settings FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "admin insert settings" ON public.app_settings FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TRIGGER app_settings_updated BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.app_settings (id) VALUES (1);
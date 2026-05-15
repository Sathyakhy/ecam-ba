CREATE TABLE public.positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  department text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read positions" ON public.positions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin manage positions" ON public.positions
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER positions_updated_at
  BEFORE UPDATE ON public.positions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Seed from existing job titles in profiles
INSERT INTO public.positions (name, department)
SELECT DISTINCT job_title, MAX(department)
FROM public.profiles
WHERE job_title IS NOT NULL AND job_title <> ''
GROUP BY job_title
ON CONFLICT (name) DO NOTHING;
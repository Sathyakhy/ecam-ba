CREATE TABLE IF NOT EXISTS public.onboarding_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  plan_id uuid,
  completed_at timestamptz NOT NULL DEFAULT now(),
  completed_by uuid,
  summary text,
  snapshot jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS onboarding_history_profile_idx
  ON public.onboarding_history(profile_id, completed_at DESC);

ALTER TABLE public.onboarding_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read onb_history"
  ON public.onboarding_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "admin manage onb_history"
  ON public.onboarding_history FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
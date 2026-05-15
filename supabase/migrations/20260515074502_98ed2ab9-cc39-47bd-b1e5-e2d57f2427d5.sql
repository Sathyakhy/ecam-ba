
-- Plans (one per intern)
CREATE TABLE public.onboarding_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE,
  welcome_message text NOT NULL DEFAULT 'Welcome to the team!',
  intern_position text,
  senior_name text,
  supervisor_name text,
  point_of_contact text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.onboarding_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.onboarding_plans(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.onboarding_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.onboarding_plans(id) ON DELETE CASCADE,
  area text NOT NULL,
  description text,
  rating_30 numeric,
  rating_60 numeric,
  rating_90 numeric,
  comment text,
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.onboarding_expectations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.onboarding_plans(id) ON DELETE CASCADE,
  area text NOT NULL,
  value_30 text,
  value_60 text,
  value_90 text,
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.onboarding_reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.onboarding_plans(id) ON DELETE CASCADE,
  checkpoint int NOT NULL CHECK (checkpoint IN (30,60,90)),
  question text NOT NULL,
  answer text,
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.onboarding_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.onboarding_plans(id) ON DELETE CASCADE,
  checkpoint int NOT NULL CHECK (checkpoint IN (30,60,90)),
  status text NOT NULL DEFAULT 'pending',
  note text,
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(plan_id, checkpoint)
);

-- updated_at triggers
CREATE TRIGGER trg_onb_plans_updated BEFORE UPDATE ON public.onboarding_plans FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_onb_sections_updated BEFORE UPDATE ON public.onboarding_sections FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_onb_evals_updated BEFORE UPDATE ON public.onboarding_evaluations FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_onb_expect_updated BEFORE UPDATE ON public.onboarding_expectations FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_onb_reflect_updated BEFORE UPDATE ON public.onboarding_reflections FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_onb_prog_updated BEFORE UPDATE ON public.onboarding_progress FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- RLS
ALTER TABLE public.onboarding_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_expectations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated user
CREATE POLICY "auth read onb_plans" ON public.onboarding_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read onb_sections" ON public.onboarding_sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read onb_evals" ON public.onboarding_evaluations FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read onb_expect" ON public.onboarding_expectations FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read onb_reflect" ON public.onboarding_reflections FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read onb_prog" ON public.onboarding_progress FOR SELECT TO authenticated USING (true);

-- Admin manage all
CREATE POLICY "admin manage onb_plans" ON public.onboarding_plans FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "admin manage onb_sections" ON public.onboarding_sections FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "admin manage onb_evals" ON public.onboarding_evaluations FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "admin manage onb_expect" ON public.onboarding_expectations FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "admin manage onb_reflect" ON public.onboarding_reflections FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "admin manage onb_prog" ON public.onboarding_progress FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));

-- Intern can update their own reflection answers
CREATE POLICY "intern update own reflection" ON public.onboarding_reflections
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.onboarding_plans p WHERE p.id = plan_id AND p.profile_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.onboarding_plans p WHERE p.id = plan_id AND p.profile_id = auth.uid()));

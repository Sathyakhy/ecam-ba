-- 1. assignee_id on onboarding_plans
ALTER TABLE public.onboarding_plans
  ADD COLUMN IF NOT EXISTS assignee_id uuid;

-- 2. helper: walk manager_id / mentor_id chain upward from the intern
CREATE OR REPLACE FUNCTION public.is_in_management_chain(_viewer_id uuid, _intern_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  to_visit uuid[] := ARRAY[_intern_id];
  visited uuid[] := ARRAY[]::uuid[];
  cur uuid;
BEGIN
  IF _viewer_id IS NULL OR _intern_id IS NULL THEN
    RETURN false;
  END IF;
  WHILE array_length(to_visit, 1) > 0 LOOP
    cur := to_visit[1];
    to_visit := to_visit[2:];
    IF cur = ANY(visited) THEN CONTINUE; END IF;
    visited := visited || cur;
    SELECT manager_id, mentor_id INTO rec FROM public.profiles WHERE id = cur;
    IF rec.manager_id IS NOT NULL THEN
      IF rec.manager_id = _viewer_id THEN RETURN true; END IF;
      to_visit := to_visit || rec.manager_id;
    END IF;
    IF rec.mentor_id IS NOT NULL THEN
      IF rec.mentor_id = _viewer_id THEN RETURN true; END IF;
      to_visit := to_visit || rec.mentor_id;
    END IF;
  END LOOP;
  RETURN false;
END;
$$;

-- helper to check view rights against a plan_id (used by child tables)
CREATE OR REPLACE FUNCTION public.can_view_onb_plan(_viewer_id uuid, _plan_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.onboarding_plans p
    WHERE p.id = _plan_id
      AND (
        p.profile_id = _viewer_id
        OR p.assignee_id = _viewer_id
        OR private.has_role(_viewer_id, 'admin'::app_role)
        OR public.is_in_management_chain(_viewer_id, p.profile_id)
      )
  );
$$;

-- 3. tighten RLS on onboarding_plans
DROP POLICY IF EXISTS "auth read onb_plans" ON public.onboarding_plans;
CREATE POLICY "view onb_plans restricted"
ON public.onboarding_plans FOR SELECT TO authenticated
USING (
  profile_id = auth.uid()
  OR assignee_id = auth.uid()
  OR private.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_in_management_chain(auth.uid(), profile_id)
);

-- 4. tighten RLS on child tables
DROP POLICY IF EXISTS "auth read onb_sections" ON public.onboarding_sections;
CREATE POLICY "view onb_sections restricted"
ON public.onboarding_sections FOR SELECT TO authenticated
USING (public.can_view_onb_plan(auth.uid(), plan_id));

DROP POLICY IF EXISTS "auth read onb_evals" ON public.onboarding_evaluations;
CREATE POLICY "view onb_evals restricted"
ON public.onboarding_evaluations FOR SELECT TO authenticated
USING (public.can_view_onb_plan(auth.uid(), plan_id));

DROP POLICY IF EXISTS "auth read onb_expect" ON public.onboarding_expectations;
CREATE POLICY "view onb_expect restricted"
ON public.onboarding_expectations FOR SELECT TO authenticated
USING (public.can_view_onb_plan(auth.uid(), plan_id));

DROP POLICY IF EXISTS "auth read onb_reflect" ON public.onboarding_reflections;
CREATE POLICY "view onb_reflect restricted"
ON public.onboarding_reflections FOR SELECT TO authenticated
USING (public.can_view_onb_plan(auth.uid(), plan_id));

DROP POLICY IF EXISTS "auth read onb_prog" ON public.onboarding_progress;
CREATE POLICY "view onb_prog restricted"
ON public.onboarding_progress FOR SELECT TO authenticated
USING (public.can_view_onb_plan(auth.uid(), plan_id));

DROP POLICY IF EXISTS "auth read onb_history" ON public.onboarding_history;
CREATE POLICY "view onb_history restricted"
ON public.onboarding_history FOR SELECT TO authenticated
USING (
  profile_id = auth.uid()
  OR private.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_in_management_chain(auth.uid(), profile_id)
  OR (plan_id IS NOT NULL AND public.can_view_onb_plan(auth.uid(), plan_id))
);

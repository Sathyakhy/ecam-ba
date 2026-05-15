-- Move helpers into private schema
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.is_in_management_chain(_viewer_id uuid, _intern_id uuid)
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

CREATE OR REPLACE FUNCTION private.can_view_onb_plan(_viewer_id uuid, _plan_id uuid)
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
        OR private.is_in_management_chain(_viewer_id, p.profile_id)
      )
  );
$$;

REVOKE ALL ON FUNCTION private.is_in_management_chain(uuid, uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION private.can_view_onb_plan(uuid, uuid) FROM public, anon, authenticated;

-- Repoint policies to private.* helpers
DROP POLICY IF EXISTS "view onb_plans restricted" ON public.onboarding_plans;
CREATE POLICY "view onb_plans restricted"
ON public.onboarding_plans FOR SELECT TO authenticated
USING (
  profile_id = auth.uid()
  OR assignee_id = auth.uid()
  OR private.has_role(auth.uid(), 'admin'::app_role)
  OR private.is_in_management_chain(auth.uid(), profile_id)
);

DROP POLICY IF EXISTS "view onb_sections restricted" ON public.onboarding_sections;
CREATE POLICY "view onb_sections restricted"
ON public.onboarding_sections FOR SELECT TO authenticated
USING (private.can_view_onb_plan(auth.uid(), plan_id));

DROP POLICY IF EXISTS "view onb_evals restricted" ON public.onboarding_evaluations;
CREATE POLICY "view onb_evals restricted"
ON public.onboarding_evaluations FOR SELECT TO authenticated
USING (private.can_view_onb_plan(auth.uid(), plan_id));

DROP POLICY IF EXISTS "view onb_expect restricted" ON public.onboarding_expectations;
CREATE POLICY "view onb_expect restricted"
ON public.onboarding_expectations FOR SELECT TO authenticated
USING (private.can_view_onb_plan(auth.uid(), plan_id));

DROP POLICY IF EXISTS "view onb_reflect restricted" ON public.onboarding_reflections;
CREATE POLICY "view onb_reflect restricted"
ON public.onboarding_reflections FOR SELECT TO authenticated
USING (private.can_view_onb_plan(auth.uid(), plan_id));

DROP POLICY IF EXISTS "view onb_prog restricted" ON public.onboarding_progress;
CREATE POLICY "view onb_prog restricted"
ON public.onboarding_progress FOR SELECT TO authenticated
USING (private.can_view_onb_plan(auth.uid(), plan_id));

DROP POLICY IF EXISTS "view onb_history restricted" ON public.onboarding_history;
CREATE POLICY "view onb_history restricted"
ON public.onboarding_history FOR SELECT TO authenticated
USING (
  profile_id = auth.uid()
  OR private.has_role(auth.uid(), 'admin'::app_role)
  OR private.is_in_management_chain(auth.uid(), profile_id)
  OR (plan_id IS NOT NULL AND private.can_view_onb_plan(auth.uid(), plan_id))
);

-- Drop the now-unused public copies
DROP FUNCTION IF EXISTS public.can_view_onb_plan(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_in_management_chain(uuid, uuid);

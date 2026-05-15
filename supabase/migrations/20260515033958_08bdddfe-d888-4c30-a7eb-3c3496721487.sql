CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(UUID, public.app_role) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "admin write profiles" ON public.profiles;
DROP POLICY IF EXISTS "auth read own role" ON public.user_roles;
DROP POLICY IF EXISTS "admin manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "admin manage onboarding" ON public.onboarding_tasks;
DROP POLICY IF EXISTS "admin manage materials" ON public.training_materials;
DROP POLICY IF EXISTS "auth read assignments" ON public.training_assignments;
DROP POLICY IF EXISTS "admin manage assignments" ON public.training_assignments;
DROP POLICY IF EXISTS "admin manage kb" ON public.knowledge_articles;
DROP POLICY IF EXISTS "admin manage tasks" ON public.tasks;
DROP POLICY IF EXISTS "admin manage announcements" ON public.announcements;
DROP POLICY IF EXISTS "admin update settings" ON public.app_settings;
DROP POLICY IF EXISTS "admin insert settings" ON public.app_settings;

CREATE POLICY "admin write profiles" ON public.profiles FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "auth read own role" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manage onboarding" ON public.onboarding_tasks FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manage materials" ON public.training_materials FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "auth read assignments" ON public.training_assignments FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manage assignments" ON public.training_assignments FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manage kb" ON public.knowledge_articles FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manage tasks" ON public.tasks FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manage announcements" ON public.announcements FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update settings" ON public.app_settings FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin insert settings" ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'));
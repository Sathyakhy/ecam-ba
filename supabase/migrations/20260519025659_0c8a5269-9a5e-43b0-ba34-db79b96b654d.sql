
-- Helper: a user can edit a given module if they have admin or a system role
-- with access_level='edit' whose modules array contains the module key.
CREATE OR REPLACE FUNCTION private.can_edit_module(_user_id uuid, _module text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    private.has_role(_user_id, 'admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.user_system_roles usr
      JOIN public.system_roles sr ON sr.id = usr.role_id
      WHERE usr.user_id = _user_id
        AND sr.access_level = 'edit'
        AND _module = ANY(sr.modules)
    )
$$;

-- announcements (module: announcements)
DROP POLICY IF EXISTS "module edit announcements" ON public.announcements;
CREATE POLICY "module edit announcements" ON public.announcements
  AS PERMISSIVE FOR ALL TO authenticated
  USING (private.can_edit_module(auth.uid(), 'announcements'))
  WITH CHECK (private.can_edit_module(auth.uid(), 'announcements'));

-- app_settings (module: settings)
DROP POLICY IF EXISTS "module edit app_settings update" ON public.app_settings;
CREATE POLICY "module edit app_settings update" ON public.app_settings
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (private.can_edit_module(auth.uid(), 'settings'))
  WITH CHECK (private.can_edit_module(auth.uid(), 'settings'));
DROP POLICY IF EXISTS "module edit app_settings insert" ON public.app_settings;
CREATE POLICY "module edit app_settings insert" ON public.app_settings
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (private.can_edit_module(auth.uid(), 'settings'));

-- knowledge_articles (module: learning)
DROP POLICY IF EXISTS "module edit kb" ON public.knowledge_articles;
CREATE POLICY "module edit kb" ON public.knowledge_articles
  AS PERMISSIVE FOR ALL TO authenticated
  USING (private.can_edit_module(auth.uid(), 'learning'))
  WITH CHECK (private.can_edit_module(auth.uid(), 'learning'));

-- training_assignments (module: learning)
DROP POLICY IF EXISTS "module edit training" ON public.training_assignments;
CREATE POLICY "module edit training" ON public.training_assignments
  AS PERMISSIVE FOR ALL TO authenticated
  USING (private.can_edit_module(auth.uid(), 'learning'))
  WITH CHECK (private.can_edit_module(auth.uid(), 'learning'));

-- positions (module: positions)
DROP POLICY IF EXISTS "module edit positions" ON public.positions;
CREATE POLICY "module edit positions" ON public.positions
  AS PERMISSIVE FOR ALL TO authenticated
  USING (private.can_edit_module(auth.uid(), 'positions'))
  WITH CHECK (private.can_edit_module(auth.uid(), 'positions'));

-- project_roles_catalog, task_modes, task_priorities, task_statuses (module: project-config)
DROP POLICY IF EXISTS "module edit project_roles_catalog" ON public.project_roles_catalog;
CREATE POLICY "module edit project_roles_catalog" ON public.project_roles_catalog
  AS PERMISSIVE FOR ALL TO authenticated
  USING (private.can_edit_module(auth.uid(), 'project-config'))
  WITH CHECK (private.can_edit_module(auth.uid(), 'project-config'));

DROP POLICY IF EXISTS "module edit task_modes" ON public.task_modes;
CREATE POLICY "module edit task_modes" ON public.task_modes
  AS PERMISSIVE FOR ALL TO authenticated
  USING (private.can_edit_module(auth.uid(), 'project-config'))
  WITH CHECK (private.can_edit_module(auth.uid(), 'project-config'));

DROP POLICY IF EXISTS "module edit task_priorities" ON public.task_priorities;
CREATE POLICY "module edit task_priorities" ON public.task_priorities
  AS PERMISSIVE FOR ALL TO authenticated
  USING (private.can_edit_module(auth.uid(), 'project-config'))
  WITH CHECK (private.can_edit_module(auth.uid(), 'project-config'));

DROP POLICY IF EXISTS "module edit task_statuses" ON public.task_statuses;
CREATE POLICY "module edit task_statuses" ON public.task_statuses
  AS PERMISSIVE FOR ALL TO authenticated
  USING (private.can_edit_module(auth.uid(), 'project-config'))
  WITH CHECK (private.can_edit_module(auth.uid(), 'project-config'));

-- onboarding tables (module: onboarding)
DROP POLICY IF EXISTS "module edit onb_plans" ON public.onboarding_plans;
CREATE POLICY "module edit onb_plans" ON public.onboarding_plans
  AS PERMISSIVE FOR ALL TO authenticated
  USING (private.can_edit_module(auth.uid(), 'onboarding'))
  WITH CHECK (private.can_edit_module(auth.uid(), 'onboarding'));

DROP POLICY IF EXISTS "module edit onb_sections" ON public.onboarding_sections;
CREATE POLICY "module edit onb_sections" ON public.onboarding_sections
  AS PERMISSIVE FOR ALL TO authenticated
  USING (private.can_edit_module(auth.uid(), 'onboarding'))
  WITH CHECK (private.can_edit_module(auth.uid(), 'onboarding'));

DROP POLICY IF EXISTS "module edit onb_progress" ON public.onboarding_progress;
CREATE POLICY "module edit onb_progress" ON public.onboarding_progress
  AS PERMISSIVE FOR ALL TO authenticated
  USING (private.can_edit_module(auth.uid(), 'onboarding'))
  WITH CHECK (private.can_edit_module(auth.uid(), 'onboarding'));

DROP POLICY IF EXISTS "module edit onb_expect" ON public.onboarding_expectations;
CREATE POLICY "module edit onb_expect" ON public.onboarding_expectations
  AS PERMISSIVE FOR ALL TO authenticated
  USING (private.can_edit_module(auth.uid(), 'onboarding'))
  WITH CHECK (private.can_edit_module(auth.uid(), 'onboarding'));

DROP POLICY IF EXISTS "module edit onb_evals" ON public.onboarding_evaluations;
CREATE POLICY "module edit onb_evals" ON public.onboarding_evaluations
  AS PERMISSIVE FOR ALL TO authenticated
  USING (private.can_edit_module(auth.uid(), 'onboarding'))
  WITH CHECK (private.can_edit_module(auth.uid(), 'onboarding'));

DROP POLICY IF EXISTS "module edit onb_reflect" ON public.onboarding_reflections;
CREATE POLICY "module edit onb_reflect" ON public.onboarding_reflections
  AS PERMISSIVE FOR ALL TO authenticated
  USING (private.can_edit_module(auth.uid(), 'onboarding'))
  WITH CHECK (private.can_edit_module(auth.uid(), 'onboarding'));

DROP POLICY IF EXISTS "module edit onb_history" ON public.onboarding_history;
CREATE POLICY "module edit onb_history" ON public.onboarding_history
  AS PERMISSIVE FOR ALL TO authenticated
  USING (private.can_edit_module(auth.uid(), 'onboarding'))
  WITH CHECK (private.can_edit_module(auth.uid(), 'onboarding'));

DROP POLICY IF EXISTS "module edit onboarding_tasks" ON public.onboarding_tasks;
CREATE POLICY "module edit onboarding_tasks" ON public.onboarding_tasks
  AS PERMISSIVE FOR ALL TO authenticated
  USING (private.can_edit_module(auth.uid(), 'onboarding'))
  WITH CHECK (private.can_edit_module(auth.uid(), 'onboarding'));

-- profiles (module: staff) — module-edit users can update profiles
DROP POLICY IF EXISTS "module edit profiles" ON public.profiles;
CREATE POLICY "module edit profiles" ON public.profiles
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (private.can_edit_module(auth.uid(), 'staff'))
  WITH CHECK (private.can_edit_module(auth.uid(), 'staff'));

-- projects (module: projects) — module-edit users can manage any project
DROP POLICY IF EXISTS "module edit projects update" ON public.projects;
CREATE POLICY "module edit projects update" ON public.projects
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (private.can_edit_module(auth.uid(), 'projects'))
  WITH CHECK (private.can_edit_module(auth.uid(), 'projects'));

DROP POLICY IF EXISTS "module edit projects delete" ON public.projects;
CREATE POLICY "module edit projects delete" ON public.projects
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (private.can_edit_module(auth.uid(), 'projects'));

-- Extend can_manage_project so module-edit 'projects' users count as managers
CREATE OR REPLACE FUNCTION private.can_manage_project(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    private.has_role(_user_id, 'admin'::app_role)
    OR private.can_edit_module(_user_id, 'projects')
    OR EXISTS (SELECT 1 FROM public.projects WHERE id = _project_id AND owner_id = _user_id)
    OR EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = _project_id AND profile_id = _user_id AND role IN ('owner','manager')
    )
$$;

-- tasks (module: tasks) — module-edit users can manage all tasks
DROP POLICY IF EXISTS "module edit tasks" ON public.tasks;
CREATE POLICY "module edit tasks" ON public.tasks
  AS PERMISSIVE FOR ALL TO authenticated
  USING (private.can_edit_module(auth.uid(), 'tasks'))
  WITH CHECK (private.can_edit_module(auth.uid(), 'tasks'));

-- customers (module: staff doesn't fit; treat as projects module for CRM-like access)
-- Skipping customers/products/vendors unless a dedicated module is added.

-- system_roles + user_system_roles (module: admin) — already covered by has_role admin via system role
-- private.has_role already includes admin module mapping, so existing admin policies cover this.

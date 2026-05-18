
-- Projects
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'planning', -- planning, active, on_hold, completed, archived
  priority text NOT NULL DEFAULT 'normal', -- low, normal, high, urgent
  start_date date,
  due_date date,
  owner_id uuid NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_owner ON public.projects(owner_id);
CREATE INDEX idx_projects_status ON public.projects(status);

-- Members
CREATE TABLE public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member', -- owner, manager, member
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, profile_id)
);

CREATE INDEX idx_project_members_project ON public.project_members(project_id);
CREATE INDEX idx_project_members_profile ON public.project_members(profile_id);

-- Milestones
CREATE TABLE public.project_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  due_date date,
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  status text NOT NULL DEFAULT 'pending', -- pending, in_progress, completed
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_milestones_project ON public.project_milestones(project_id);

-- Status updates (history feed)
CREATE TABLE public.project_status_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  status text, -- optional new status snapshot
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_status_updates_project ON public.project_status_updates(project_id, created_at DESC);

-- updated_at triggers
CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_milestones_updated_at BEFORE UPDATE ON public.project_milestones
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Helper: is member of project
CREATE OR REPLACE FUNCTION private.is_project_member(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = _project_id AND profile_id = _user_id
  )
$$;

GRANT EXECUTE ON FUNCTION private.is_project_member(uuid, uuid) TO authenticated;

-- Helper: is owner or admin
CREATE OR REPLACE FUNCTION private.can_manage_project(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    private.has_role(_user_id, 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.projects WHERE id = _project_id AND owner_id = _user_id)
    OR EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = _project_id AND profile_id = _user_id AND role IN ('owner','manager')
    )
$$;

GRANT EXECUTE ON FUNCTION private.can_manage_project(uuid, uuid) TO authenticated;

-- RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_status_updates ENABLE ROW LEVEL SECURITY;

-- projects: all auth read; any auth create (must be creator+owner=self); managers/admin update/delete
CREATE POLICY "auth read projects" ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth create projects" ON public.projects FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND owner_id = auth.uid());
CREATE POLICY "manage update projects" ON public.projects FOR UPDATE TO authenticated
  USING (private.can_manage_project(auth.uid(), id))
  WITH CHECK (private.can_manage_project(auth.uid(), id));
CREATE POLICY "manage delete projects" ON public.projects FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

-- project_members: all auth read; managers/admin manage
CREATE POLICY "auth read project_members" ON public.project_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage project_members" ON public.project_members FOR ALL TO authenticated
  USING (private.can_manage_project(auth.uid(), project_id))
  WITH CHECK (private.can_manage_project(auth.uid(), project_id));

-- milestones: all auth read; managers/admin create/delete; members update progress
CREATE POLICY "auth read milestones" ON public.project_milestones FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage insert milestones" ON public.project_milestones FOR INSERT TO authenticated
  WITH CHECK (private.can_manage_project(auth.uid(), project_id));
CREATE POLICY "manage delete milestones" ON public.project_milestones FOR DELETE TO authenticated
  USING (private.can_manage_project(auth.uid(), project_id));
CREATE POLICY "members update milestones" ON public.project_milestones FOR UPDATE TO authenticated
  USING (
    private.can_manage_project(auth.uid(), project_id)
    OR private.is_project_member(auth.uid(), project_id)
  )
  WITH CHECK (
    private.can_manage_project(auth.uid(), project_id)
    OR private.is_project_member(auth.uid(), project_id)
  );

-- status updates: all auth read; any auth member or manager can post; author or manager can delete
CREATE POLICY "auth read status_updates" ON public.project_status_updates FOR SELECT TO authenticated USING (true);
CREATE POLICY "post status_updates" ON public.project_status_updates FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (
      private.is_project_member(auth.uid(), project_id)
      OR private.can_manage_project(auth.uid(), project_id)
    )
  );
CREATE POLICY "delete own status_updates" ON public.project_status_updates FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR private.can_manage_project(auth.uid(), project_id));

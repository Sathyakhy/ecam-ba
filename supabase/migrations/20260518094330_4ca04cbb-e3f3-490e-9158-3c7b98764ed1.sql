-- 1) Baseline + actuals + task mode on project_tasks
ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS baseline_start date,
  ADD COLUMN IF NOT EXISTS baseline_finish date,
  ADD COLUMN IF NOT EXISTS actual_start date,
  ADD COLUMN IF NOT EXISTS task_mode text NOT NULL DEFAULT 'auto';

-- 2) Soft delete columns
ALTER TABLE public.projects           ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.project_tasks      ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.project_milestones ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_projects_deleted_at           ON public.projects(deleted_at);
CREATE INDEX IF NOT EXISTS idx_project_tasks_deleted_at      ON public.project_tasks(deleted_at);
CREATE INDEX IF NOT EXISTS idx_project_milestones_deleted_at ON public.project_milestones(deleted_at);

-- 3) Configurable task priorities
CREATE TABLE IF NOT EXISTS public.task_priorities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  color text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.task_priorities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read task_priorities"
  ON public.task_priorities FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage task_priorities"
  ON public.task_priorities FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_task_priorities_updated_at
  BEFORE UPDATE ON public.task_priorities
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.task_priorities (key, label, sort_order) VALUES
  ('low','Low',1),('normal','Normal',2),('high','High',3),('urgent','Urgent',4)
  ON CONFLICT (key) DO NOTHING;

-- 4) Configurable task modes
CREATE TABLE IF NOT EXISTS public.task_modes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.task_modes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read task_modes"
  ON public.task_modes FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage task_modes"
  ON public.task_modes FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_task_modes_updated_at
  BEFORE UPDATE ON public.task_modes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.task_modes (key, label, sort_order) VALUES
  ('auto','Auto scheduled',1),('manual','Manually scheduled',2)
  ON CONFLICT (key) DO NOTHING;

-- 5) Saved views for Projects list
CREATE TABLE IF NOT EXISTS public.project_saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_shared boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.project_saved_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own or shared views"
  ON public.project_saved_views FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_shared = true);
CREATE POLICY "manage own views"
  ON public.project_saved_views FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_project_saved_views_updated_at
  BEFORE UPDATE ON public.project_saved_views
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
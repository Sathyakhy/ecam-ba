
ALTER TABLE public.project_milestones
  ADD COLUMN IF NOT EXISTS phase text,
  ADD COLUMN IF NOT EXISTS remark text;

CREATE TABLE IF NOT EXISTS public.project_milestone_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  milestone_id uuid NOT NULL REFERENCES public.project_milestones(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  remark text,
  due_date date,
  status text NOT NULL DEFAULT 'pending',
  progress integer NOT NULL DEFAULT 0,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pmi_milestone ON public.project_milestone_items(milestone_id);
CREATE INDEX IF NOT EXISTS idx_pmi_project ON public.project_milestone_items(project_id);

ALTER TABLE public.project_milestone_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth read milestone_items" ON public.project_milestone_items;
CREATE POLICY "auth read milestone_items" ON public.project_milestone_items
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "manage insert milestone_items" ON public.project_milestone_items;
CREATE POLICY "manage insert milestone_items" ON public.project_milestone_items
  FOR INSERT TO authenticated WITH CHECK (
    private.can_manage_project(auth.uid(), project_id) OR private.is_project_member(auth.uid(), project_id)
  );

DROP POLICY IF EXISTS "members update milestone_items" ON public.project_milestone_items;
CREATE POLICY "members update milestone_items" ON public.project_milestone_items
  FOR UPDATE TO authenticated USING (
    private.can_manage_project(auth.uid(), project_id) OR private.is_project_member(auth.uid(), project_id)
  ) WITH CHECK (
    private.can_manage_project(auth.uid(), project_id) OR private.is_project_member(auth.uid(), project_id)
  );

DROP POLICY IF EXISTS "manage delete milestone_items" ON public.project_milestone_items;
CREATE POLICY "manage delete milestone_items" ON public.project_milestone_items
  FOR DELETE TO authenticated USING (
    private.can_manage_project(auth.uid(), project_id)
  );

DROP TRIGGER IF EXISTS set_updated_at_pmi ON public.project_milestone_items;
CREATE TRIGGER set_updated_at_pmi BEFORE UPDATE ON public.project_milestone_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

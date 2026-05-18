
-- ============ Customers ============
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_email text,
  contact_phone text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read customers" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth create customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "admin or creator update customers" ON public.customers FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role) OR created_by = auth.uid())
  WITH CHECK (private.has_role(auth.uid(),'admin'::app_role) OR created_by = auth.uid());
CREATE POLICY "admin delete customers" ON public.customers FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER tg_customers_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ Projects additions ============
ALTER TABLE public.projects
  ADD COLUMN customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN manager_id uuid;

-- ============ Project tasks ============
CREATE TABLE public.project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  parent_task_id uuid REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'todo',
  priority text NOT NULL DEFAULT 'normal',
  due_date date,
  start_date date,
  assignee_id uuid,
  created_by uuid NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_project_tasks_project ON public.project_tasks(project_id);
CREATE INDEX idx_project_tasks_parent ON public.project_tasks(parent_task_id);
CREATE INDEX idx_project_tasks_assignee ON public.project_tasks(assignee_id);
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read project_tasks" ON public.project_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "members create project_tasks" ON public.project_tasks FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND (
    private.can_manage_project(auth.uid(), project_id) OR private.is_project_member(auth.uid(), project_id)
  ));
CREATE POLICY "update project_tasks" ON public.project_tasks FOR UPDATE TO authenticated
  USING (private.can_manage_project(auth.uid(), project_id) OR private.is_project_member(auth.uid(), project_id) OR assignee_id = auth.uid())
  WITH CHECK (private.can_manage_project(auth.uid(), project_id) OR private.is_project_member(auth.uid(), project_id) OR assignee_id = auth.uid());
CREATE POLICY "delete project_tasks" ON public.project_tasks FOR DELETE TO authenticated
  USING (private.can_manage_project(auth.uid(), project_id) OR created_by = auth.uid());
CREATE TRIGGER tg_project_tasks_updated_at BEFORE UPDATE ON public.project_tasks
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ Task comments ============
CREATE TABLE public.project_task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  author_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_task_comments_task ON public.project_task_comments(task_id);
ALTER TABLE public.project_task_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read task_comments" ON public.project_task_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "post task_comments" ON public.project_task_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND (
    private.can_manage_project(auth.uid(), project_id) OR private.is_project_member(auth.uid(), project_id)
  ));
CREATE POLICY "delete own task_comments" ON public.project_task_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR private.can_manage_project(auth.uid(), project_id));

-- ============ Task attachments ============
CREATE TABLE public.project_task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  uploader_id uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_task_attachments_task ON public.project_task_attachments(task_id);
ALTER TABLE public.project_task_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read task_attachments" ON public.project_task_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "add task_attachments" ON public.project_task_attachments FOR INSERT TO authenticated
  WITH CHECK (uploader_id = auth.uid() AND (
    private.can_manage_project(auth.uid(), project_id) OR private.is_project_member(auth.uid(), project_id)
  ));
CREATE POLICY "delete task_attachments" ON public.project_task_attachments FOR DELETE TO authenticated
  USING (uploader_id = auth.uid() OR private.can_manage_project(auth.uid(), project_id));

-- ============ Activity log ============
CREATE TABLE public.project_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  summary text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_project_activity_project ON public.project_activity(project_id, created_at DESC);
ALTER TABLE public.project_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read project_activity" ON public.project_activity FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert project_activity" ON public.project_activity FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- ============ Activity triggers ============
CREATE OR REPLACE FUNCTION public.tg_log_project_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_project uuid;
  v_action text;
  v_entity text := TG_ARGV[0];
  v_summary text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_project := COALESCE((to_jsonb(OLD)->>'project_id')::uuid, OLD.id);
    v_action := 'deleted';
    v_summary := COALESCE(to_jsonb(OLD)->>'title', to_jsonb(OLD)->>'name', v_entity);
  ELSIF TG_OP = 'INSERT' THEN
    v_project := COALESCE((to_jsonb(NEW)->>'project_id')::uuid, NEW.id);
    v_action := 'created';
    v_summary := COALESCE(to_jsonb(NEW)->>'title', to_jsonb(NEW)->>'name', v_entity);
  ELSE
    v_project := COALESCE((to_jsonb(NEW)->>'project_id')::uuid, NEW.id);
    -- only log status change for tasks/milestones/projects to avoid noise
    IF v_entity IN ('task','milestone','project') THEN
      IF (to_jsonb(OLD)->>'status') IS DISTINCT FROM (to_jsonb(NEW)->>'status') THEN
        v_action := 'status_changed';
        v_summary := COALESCE(to_jsonb(NEW)->>'title', to_jsonb(NEW)->>'name', v_entity)
          || ': ' || COALESCE(to_jsonb(OLD)->>'status','?')
          || ' → ' || COALESCE(to_jsonb(NEW)->>'status','?');
      ELSE
        RETURN NEW;
      END IF;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.project_activity (project_id, actor_id, action, entity_type, entity_id, summary)
  VALUES (v_project, v_actor, v_action, v_entity,
    CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END,
    v_summary);

  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER tg_activity_project AFTER INSERT OR UPDATE OR DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.tg_log_project_activity('project');
CREATE TRIGGER tg_activity_milestone AFTER INSERT OR UPDATE OR DELETE ON public.project_milestones
  FOR EACH ROW EXECUTE FUNCTION public.tg_log_project_activity('milestone');
CREATE TRIGGER tg_activity_task AFTER INSERT OR UPDATE OR DELETE ON public.project_tasks
  FOR EACH ROW EXECUTE FUNCTION public.tg_log_project_activity('task');
CREATE TRIGGER tg_activity_member AFTER INSERT OR DELETE ON public.project_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_log_project_activity('member');
CREATE TRIGGER tg_activity_comment AFTER INSERT ON public.project_task_comments
  FOR EACH ROW EXECUTE FUNCTION public.tg_log_project_activity('comment');

-- ============ Storage bucket for attachments ============
INSERT INTO storage.buckets (id, name, public) VALUES ('project-attachments','project-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "auth read project attachments" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'project-attachments');
CREATE POLICY "members upload project attachments" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-attachments'
    AND private.is_project_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
    OR (bucket_id = 'project-attachments'
        AND private.can_manage_project(auth.uid(), ((storage.foldername(name))[1])::uuid))
  );
CREATE POLICY "uploader or manager delete attachments" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'project-attachments'
    AND (owner = auth.uid()
      OR private.can_manage_project(auth.uid(), ((storage.foldername(name))[1])::uuid))
  );

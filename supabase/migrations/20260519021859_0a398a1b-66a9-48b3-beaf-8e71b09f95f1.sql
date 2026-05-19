
-- #5 Project-level attachments
CREATE TABLE public.project_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  uploader_id uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_project_attachments_project ON public.project_attachments(project_id);
ALTER TABLE public.project_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read project_attachments" ON public.project_attachments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "add project_attachments" ON public.project_attachments
  FOR INSERT TO authenticated
  WITH CHECK (uploader_id = auth.uid()
    AND (private.can_manage_project(auth.uid(), project_id) OR private.is_project_member(auth.uid(), project_id)));

CREATE POLICY "delete project_attachments" ON public.project_attachments
  FOR DELETE TO authenticated
  USING (uploader_id = auth.uid() OR private.can_manage_project(auth.uid(), project_id));

-- #17 Project templates
CREATE TABLE public.project_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_by uuid NOT NULL,
  source_project_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.project_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read project_templates" ON public.project_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth create project_templates" ON public.project_templates
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "owner or admin update project_templates" ON public.project_templates
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (created_by = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "owner or admin delete project_templates" ON public.project_templates
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_project_templates_updated_at
  BEFORE UPDATE ON public.project_templates
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

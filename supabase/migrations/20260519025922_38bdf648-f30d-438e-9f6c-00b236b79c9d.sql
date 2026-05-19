
-- Audit log table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid,
  actor_email text,
  module text NOT NULL,
  table_name text NOT NULL,
  action text NOT NULL CHECK (action IN ('insert','update','delete')),
  record_id text,
  summary text,
  changed_fields text[] NOT NULL DEFAULT '{}',
  old_data jsonb,
  new_data jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_occurred_at ON public.audit_logs (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON public.audit_logs (module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON public.audit_logs (table_name);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin read audit_logs" ON public.audit_logs;
CREATE POLICY "admin read audit_logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

-- Generic trigger function. Pass module name as TG_ARGV[0].
CREATE OR REPLACE FUNCTION public.tg_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_email text;
  v_module text := COALESCE(TG_ARGV[0], TG_TABLE_NAME);
  v_action text := lower(TG_OP);
  v_old jsonb;
  v_new jsonb;
  v_rec_id text;
  v_summary text;
  v_changed text[] := '{}';
  k text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW);
    v_rec_id := COALESCE(v_new->>'id', '');
    v_summary := COALESCE(v_new->>'title', v_new->>'name', v_new->>'full_name', v_new->>'label', TG_TABLE_NAME);
  ELSIF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_rec_id := COALESCE(v_new->>'id', v_old->>'id', '');
    v_summary := COALESCE(v_new->>'title', v_new->>'name', v_new->>'full_name', v_new->>'label', TG_TABLE_NAME);
    FOR k IN SELECT jsonb_object_keys(v_new) LOOP
      IF k NOT IN ('updated_at') AND (v_old->k) IS DISTINCT FROM (v_new->k) THEN
        v_changed := array_append(v_changed, k);
      END IF;
    END LOOP;
    IF array_length(v_changed,1) IS NULL THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_rec_id := COALESCE(v_old->>'id', '');
    v_summary := COALESCE(v_old->>'title', v_old->>'name', v_old->>'full_name', v_old->>'label', TG_TABLE_NAME);
  END IF;

  IF v_actor IS NOT NULL THEN
    SELECT email INTO v_email FROM public.profiles WHERE id = v_actor;
  END IF;

  INSERT INTO public.audit_logs (actor_id, actor_email, module, table_name, action, record_id, summary, changed_fields, old_data, new_data)
  VALUES (v_actor, v_email, v_module, TG_TABLE_NAME, v_action, NULLIF(v_rec_id,''), v_summary, v_changed, v_old, v_new);

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- Helper to attach trigger
DO $$
DECLARE
  spec record;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('projects','projects'),
      ('project_tasks','tasks'),
      ('project_milestones','projects'),
      ('project_milestone_items','projects'),
      ('project_members','projects'),
      ('project_managers','projects'),
      ('project_status_updates','projects'),
      ('project_templates','projects'),
      ('project_roles_catalog','project-config'),
      ('task_modes','project-config'),
      ('announcements','announcements'),
      ('knowledge_articles','learning'),
      ('positions','positions'),
      ('profiles','staff'),
      ('onboarding_plans','onboarding'),
      ('onboarding_sections','onboarding'),
      ('onboarding_progress','onboarding'),
      ('onboarding_expectations','onboarding'),
      ('onboarding_evaluations','onboarding'),
      ('onboarding_reflections','onboarding'),
      ('onboarding_tasks','onboarding'),
      ('system_roles','admin'),
      ('user_system_roles','admin'),
      ('user_roles','admin'),
      ('app_settings','settings'),
      ('customers','customers'),
      ('customer_contacts','customers'),
      ('products','products')
    ) AS t(tbl, modname)
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=spec.tbl) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I', spec.tbl, spec.tbl);
      EXECUTE format(
        'CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_audit_log(%L)',
        spec.tbl, spec.tbl, spec.modname
      );
    END IF;
  END LOOP;
END $$;

-- Try task_statuses/task_priorities/vendors if present
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['task_statuses','task_priorities','vendors','vendor_contacts'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I', t, t);
      EXECUTE format(
        'CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_audit_log(%L)',
        t, t, 'project-config'
      );
    END IF;
  END LOOP;
END $$;

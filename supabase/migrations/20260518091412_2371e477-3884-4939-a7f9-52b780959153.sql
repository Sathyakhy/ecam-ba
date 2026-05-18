
-- 1. Multi-PIC on project_tasks
ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS pic_orgs text[] NOT NULL DEFAULT '{}';

UPDATE public.project_tasks
  SET pic_orgs = ARRAY[pic_org]
  WHERE pic_org IS NOT NULL
    AND (pic_orgs IS NULL OR array_length(pic_orgs, 1) IS NULL);

-- 2. Configurable task statuses
CREATE TABLE IF NOT EXISTS public.task_statuses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read task_statuses"
  ON public.task_statuses FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "admin manage task_statuses"
  ON public.task_statuses FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER tg_task_statuses_updated_at
  BEFORE UPDATE ON public.task_statuses
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.task_statuses (key, label, sort_order) VALUES
  ('todo', 'To do', 10),
  ('in_progress', 'In progress', 20),
  ('done', 'Done', 30),
  ('blocked', 'Blocked', 40)
ON CONFLICT (key) DO NOTHING;

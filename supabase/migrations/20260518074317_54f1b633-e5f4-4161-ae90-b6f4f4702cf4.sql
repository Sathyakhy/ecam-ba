ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS predecessor_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];
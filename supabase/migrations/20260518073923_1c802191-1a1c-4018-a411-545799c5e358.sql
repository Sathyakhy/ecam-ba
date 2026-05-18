ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS module text,
  ADD COLUMN IF NOT EXISTS site text,
  ADD COLUMN IF NOT EXISTS man_days numeric,
  ADD COLUMN IF NOT EXISTS actual_completion_date date,
  ADD COLUMN IF NOT EXISTS remark text;
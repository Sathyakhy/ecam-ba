
ALTER TABLE public.project_roles_catalog
  ADD COLUMN IF NOT EXISTS access_level text NOT NULL DEFAULT 'edit'
  CHECK (access_level IN ('view','edit'));

ALTER TABLE public.system_roles
  ADD COLUMN IF NOT EXISTS access_level text NOT NULL DEFAULT 'edit'
  CHECK (access_level IN ('view','edit'));

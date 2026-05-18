
ALTER TABLE public.project_members
  ALTER COLUMN profile_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'ecam',
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS customer_id uuid,
  ADD COLUMN IF NOT EXISTS customer_contact_id uuid,
  ADD COLUMN IF NOT EXISTS vendor_id uuid,
  ADD COLUMN IF NOT EXISTS vendor_contact_id uuid;

ALTER TABLE public.project_members
  DROP CONSTRAINT IF EXISTS project_members_kind_check;
ALTER TABLE public.project_members
  ADD CONSTRAINT project_members_kind_check
  CHECK (kind IN ('ecam','customer','vendor','manual'));

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mentor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS profiles_mentor_id_idx ON public.profiles(mentor_id);
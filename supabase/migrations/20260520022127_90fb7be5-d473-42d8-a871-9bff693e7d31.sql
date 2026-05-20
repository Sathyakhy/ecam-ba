ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS auto_assign_new_joiners boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.tg_auto_assign_courses()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.course_assignments (course_id, profile_id, assigned_by, status)
  SELECT c.id, NEW.id, NULL, 'assigned'
  FROM public.courses c
  WHERE c.auto_assign_new_joiners = true
    AND c.published = true
    AND NOT EXISTS (
      SELECT 1 FROM public.course_assignments a
      WHERE a.course_id = c.id AND a.profile_id = NEW.id
    );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_assign_courses ON public.profiles;
CREATE TRIGGER trg_auto_assign_courses
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.tg_auto_assign_courses();
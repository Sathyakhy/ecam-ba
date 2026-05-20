
-- ============ DROP OLD ============
DROP TRIGGER IF EXISTS auto_assign_courses_on_profile ON public.profiles;
DROP FUNCTION IF EXISTS public.tg_auto_assign_courses() CASCADE;

DROP TABLE IF EXISTS public.course_certificates CASCADE;
DROP TABLE IF EXISTS public.course_quiz_attempts CASCADE;
DROP TABLE IF EXISTS public.course_quiz_options CASCADE;
DROP TABLE IF EXISTS public.course_quiz_questions CASCADE;
DROP TABLE IF EXISTS public.course_lesson_progress CASCADE;
DROP TABLE IF EXISTS public.course_lessons CASCADE;
DROP TABLE IF EXISTS public.course_assignments CASCADE;
DROP TABLE IF EXISTS public.courses CASCADE;

-- Drop helper if exists
DROP FUNCTION IF EXISTS private.owns_assignment(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS private.is_course_assignee(uuid, uuid) CASCADE;

-- ============ CATEGORIES ============
CREATE TABLE public.course_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============ COURSES ============
CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category_id uuid REFERENCES public.course_categories(id) ON DELETE SET NULL,
  cover_url text,
  certificate_bg_url text,
  passing_score integer NOT NULL DEFAULT 70,
  completion_criteria text NOT NULL DEFAULT 'pass_quiz', -- 'all_lessons' | 'pass_quiz' | 'both'
  published boolean NOT NULL DEFAULT false,
  auto_assign_new_joiners boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============ PREREQUISITES ============
CREATE TABLE public.course_prerequisites (
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  prerequisite_course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  PRIMARY KEY (course_id, prerequisite_course_id),
  CHECK (course_id <> prerequisite_course_id)
);

-- ============ MODULES ============
CREATE TABLE public.course_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============ LESSONS ============
CREATE TABLE public.course_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.course_modules(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  material_type text NOT NULL DEFAULT 'text', -- video | pdf | image | link | text | file
  url text,
  content text,
  duration_seconds integer,
  downloadable boolean NOT NULL DEFAULT false,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============ QUIZ ============
CREATE TABLE public.course_quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  question text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.course_quiz_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.course_quiz_questions(id) ON DELETE CASCADE,
  label text NOT NULL,
  is_correct boolean NOT NULL DEFAULT false,
  order_index integer NOT NULL DEFAULT 0
);

-- ============ LEARNING GROUPS ============
CREATE TABLE public.learning_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.learning_group_members (
  group_id uuid NOT NULL REFERENCES public.learning_groups(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, profile_id)
);

-- ============ ENROLLMENTS ============
CREATE TABLE public.course_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_by uuid,
  status text NOT NULL DEFAULT 'enrolled', -- enrolled | in_progress | completed | failed
  source text NOT NULL DEFAULT 'manual', -- manual | auto | group | department | position
  due_date date,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  UNIQUE (course_id, profile_id)
);

CREATE INDEX ON public.course_enrollments(profile_id);
CREATE INDEX ON public.course_enrollments(course_id);

-- ============ PROGRESS ============
CREATE TABLE public.course_lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.course_enrollments(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, lesson_id)
);

CREATE TABLE public.course_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.course_enrollments(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  passed boolean NOT NULL DEFAULT false,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.course_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL UNIQUE REFERENCES public.course_enrollments(id) ON DELETE CASCADE,
  certificate_no text NOT NULL UNIQUE,
  issued_at timestamptz NOT NULL DEFAULT now()
);

-- ============ HELPER ============
CREATE OR REPLACE FUNCTION private.owns_enrollment(_user_id uuid, _enrollment_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.course_enrollments e WHERE e.id = _enrollment_id AND e.profile_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION private.is_course_enrollee(_user_id uuid, _course_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.course_enrollments e WHERE e.course_id = _course_id AND e.profile_id = _user_id)
$$;

-- ============ RLS ============
ALTER TABLE public.course_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_prerequisites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_quiz_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_certificates ENABLE ROW LEVEL SECURITY;

-- Categories
CREATE POLICY "read categories" ON public.course_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage categories" ON public.course_categories FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.can_edit_module(auth.uid(),'learning'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.can_edit_module(auth.uid(),'learning'));

-- Courses
CREATE POLICY "read published courses" ON public.courses FOR SELECT TO authenticated
  USING (published OR private.has_role(auth.uid(),'admin') OR private.can_edit_module(auth.uid(),'learning') OR private.is_course_enrollee(auth.uid(), id));
CREATE POLICY "admin manage courses" ON public.courses FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.can_edit_module(auth.uid(),'learning'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.can_edit_module(auth.uid(),'learning'));

-- Prerequisites
CREATE POLICY "read prerequisites" ON public.course_prerequisites FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage prerequisites" ON public.course_prerequisites FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.can_edit_module(auth.uid(),'learning'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.can_edit_module(auth.uid(),'learning'));

-- Modules
CREATE POLICY "read modules of accessible course" ON public.course_modules FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.can_edit_module(auth.uid(),'learning') OR private.is_course_enrollee(auth.uid(),course_id) OR EXISTS(SELECT 1 FROM public.courses c WHERE c.id=course_id AND c.published));
CREATE POLICY "admin manage modules" ON public.course_modules FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.can_edit_module(auth.uid(),'learning'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.can_edit_module(auth.uid(),'learning'));

-- Lessons
CREATE POLICY "read lessons of accessible course" ON public.course_lessons FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.can_edit_module(auth.uid(),'learning') OR private.is_course_enrollee(auth.uid(),course_id) OR EXISTS(SELECT 1 FROM public.courses c WHERE c.id=course_id AND c.published));
CREATE POLICY "admin manage lessons" ON public.course_lessons FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.can_edit_module(auth.uid(),'learning'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.can_edit_module(auth.uid(),'learning'));

-- Quiz questions
CREATE POLICY "read quiz of accessible course" ON public.course_quiz_questions FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.can_edit_module(auth.uid(),'learning') OR private.is_course_enrollee(auth.uid(),course_id));
CREATE POLICY "admin manage quiz" ON public.course_quiz_questions FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.can_edit_module(auth.uid(),'learning'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.can_edit_module(auth.uid(),'learning'));

-- Quiz options
CREATE POLICY "read quiz options" ON public.course_quiz_options FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.course_quiz_questions q WHERE q.id=question_id AND (private.has_role(auth.uid(),'admin') OR private.can_edit_module(auth.uid(),'learning') OR private.is_course_enrollee(auth.uid(),q.course_id))));
CREATE POLICY "admin manage quiz options" ON public.course_quiz_options FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.can_edit_module(auth.uid(),'learning'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.can_edit_module(auth.uid(),'learning'));

-- Learning groups
CREATE POLICY "read groups" ON public.learning_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage groups" ON public.learning_groups FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.can_edit_module(auth.uid(),'learning'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.can_edit_module(auth.uid(),'learning'));

CREATE POLICY "read group members" ON public.learning_group_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage group members" ON public.learning_group_members FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.can_edit_module(auth.uid(),'learning'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.can_edit_module(auth.uid(),'learning'));

-- Enrollments
CREATE POLICY "read own or admin enrollments" ON public.course_enrollments FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR private.has_role(auth.uid(),'admin') OR private.can_edit_module(auth.uid(),'learning'));
CREATE POLICY "admin manage enrollments" ON public.course_enrollments FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.can_edit_module(auth.uid(),'learning'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.can_edit_module(auth.uid(),'learning'));
CREATE POLICY "learner update own enrollment" ON public.course_enrollments FOR UPDATE TO authenticated
  USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());

-- Lesson progress
CREATE POLICY "read own or admin progress" ON public.course_lesson_progress FOR SELECT TO authenticated
  USING (private.owns_enrollment(auth.uid(), enrollment_id) OR private.has_role(auth.uid(),'admin') OR private.can_edit_module(auth.uid(),'learning'));
CREATE POLICY "learner write own progress" ON public.course_lesson_progress FOR INSERT TO authenticated
  WITH CHECK (private.owns_enrollment(auth.uid(), enrollment_id));
CREATE POLICY "learner delete own progress" ON public.course_lesson_progress FOR DELETE TO authenticated
  USING (private.owns_enrollment(auth.uid(), enrollment_id));

-- Quiz attempts
CREATE POLICY "read own or admin attempts" ON public.course_quiz_attempts FOR SELECT TO authenticated
  USING (private.owns_enrollment(auth.uid(), enrollment_id) OR private.has_role(auth.uid(),'admin') OR private.can_edit_module(auth.uid(),'learning'));
CREATE POLICY "learner write own attempts" ON public.course_quiz_attempts FOR INSERT TO authenticated
  WITH CHECK (private.owns_enrollment(auth.uid(), enrollment_id));

-- Certificates
CREATE POLICY "read own or admin certificates" ON public.course_certificates FOR SELECT TO authenticated
  USING (private.owns_enrollment(auth.uid(), enrollment_id) OR private.has_role(auth.uid(),'admin') OR private.can_edit_module(auth.uid(),'learning'));
CREATE POLICY "learner issue own certificate" ON public.course_certificates FOR INSERT TO authenticated
  WITH CHECK (private.owns_enrollment(auth.uid(), enrollment_id));

-- ============ TRIGGERS ============
CREATE TRIGGER set_updated_at_categories BEFORE UPDATE ON public.course_categories
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_updated_at_courses BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_updated_at_modules BEFORE UPDATE ON public.course_modules
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_updated_at_lessons BEFORE UPDATE ON public.course_lessons
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_updated_at_groups BEFORE UPDATE ON public.learning_groups
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto-enroll new joiners
CREATE OR REPLACE FUNCTION public.tg_auto_enroll_new_joiners()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.course_enrollments (course_id, profile_id, source, status)
  SELECT c.id, NEW.id, 'auto', 'enrolled'
  FROM public.courses c
  WHERE c.auto_assign_new_joiners = true AND c.published = true
    AND NOT EXISTS (SELECT 1 FROM public.course_enrollments e WHERE e.course_id = c.id AND e.profile_id = NEW.id);
  RETURN NEW;
END $$;

CREATE TRIGGER auto_enroll_new_joiners AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_auto_enroll_new_joiners();

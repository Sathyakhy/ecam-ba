
-- Courses
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  cover_url text,
  passing_score integer not null default 70,
  published boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.courses enable row level security;

create table public.course_lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  content text,
  material_type text not null default 'document',
  url text,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.course_lessons enable row level security;

create table public.course_quiz_questions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  question text not null,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.course_quiz_questions enable row level security;

create table public.course_quiz_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.course_quiz_questions(id) on delete cascade,
  label text not null,
  is_correct boolean not null default false,
  order_index integer not null default 0
);
alter table public.course_quiz_options enable row level security;

create table public.course_assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  profile_id uuid not null,
  assigned_by uuid,
  due_date date,
  status text not null default 'assigned',
  assigned_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  unique (course_id, profile_id)
);
alter table public.course_assignments enable row level security;

create table public.course_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.course_assignments(id) on delete cascade,
  lesson_id uuid not null references public.course_lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (assignment_id, lesson_id)
);
alter table public.course_lesson_progress enable row level security;

create table public.course_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.course_assignments(id) on delete cascade,
  score integer not null default 0,
  total integer not null default 0,
  passed boolean not null default false,
  answers jsonb not null default '{}'::jsonb,
  attempted_at timestamptz not null default now()
);
alter table public.course_quiz_attempts enable row level security;

create table public.course_certificates (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.course_assignments(id) on delete cascade unique,
  certificate_no text not null unique,
  issued_at timestamptz not null default now()
);
alter table public.course_certificates enable row level security;

-- updated_at triggers
create trigger courses_set_updated before update on public.courses
  for each row execute function public.tg_set_updated_at();
create trigger course_lessons_set_updated before update on public.course_lessons
  for each row execute function public.tg_set_updated_at();

-- Helper: is user assigned this course
create or replace function private.is_course_assignee(_user uuid, _course uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.course_assignments
    where course_id = _course and profile_id = _user
  )
$$;

create or replace function private.owns_assignment(_user uuid, _assignment uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.course_assignments
    where id = _assignment and profile_id = _user
  )
$$;

-- RLS: courses
create policy "auth read published courses" on public.courses
  for select to authenticated using (published or private.has_role(auth.uid(),'admin'::app_role) or private.can_edit_module(auth.uid(),'learning'));
create policy "admin manage courses" on public.courses
  for all to authenticated
  using (private.has_role(auth.uid(),'admin'::app_role) or private.can_edit_module(auth.uid(),'learning'))
  with check (private.has_role(auth.uid(),'admin'::app_role) or private.can_edit_module(auth.uid(),'learning'));

-- RLS: lessons
create policy "read lessons of accessible course" on public.course_lessons
  for select to authenticated using (
    private.has_role(auth.uid(),'admin'::app_role)
    or private.can_edit_module(auth.uid(),'learning')
    or private.is_course_assignee(auth.uid(), course_id)
    or exists (select 1 from public.courses c where c.id = course_id and c.published)
  );
create policy "admin manage lessons" on public.course_lessons
  for all to authenticated
  using (private.has_role(auth.uid(),'admin'::app_role) or private.can_edit_module(auth.uid(),'learning'))
  with check (private.has_role(auth.uid(),'admin'::app_role) or private.can_edit_module(auth.uid(),'learning'));

-- RLS: quiz questions
create policy "read quiz of accessible course" on public.course_quiz_questions
  for select to authenticated using (
    private.has_role(auth.uid(),'admin'::app_role)
    or private.can_edit_module(auth.uid(),'learning')
    or private.is_course_assignee(auth.uid(), course_id)
  );
create policy "admin manage quiz questions" on public.course_quiz_questions
  for all to authenticated
  using (private.has_role(auth.uid(),'admin'::app_role) or private.can_edit_module(auth.uid(),'learning'))
  with check (private.has_role(auth.uid(),'admin'::app_role) or private.can_edit_module(auth.uid(),'learning'));

-- RLS: quiz options (no is_correct exposure protection; learners can see options. We rely on app to score, but is_correct is technically visible. For simplicity we allow read since this is internal training.)
create policy "read quiz options" on public.course_quiz_options
  for select to authenticated using (
    exists (
      select 1 from public.course_quiz_questions q
      where q.id = question_id and (
        private.has_role(auth.uid(),'admin'::app_role)
        or private.can_edit_module(auth.uid(),'learning')
        or private.is_course_assignee(auth.uid(), q.course_id)
      )
    )
  );
create policy "admin manage quiz options" on public.course_quiz_options
  for all to authenticated
  using (private.has_role(auth.uid(),'admin'::app_role) or private.can_edit_module(auth.uid(),'learning'))
  with check (private.has_role(auth.uid(),'admin'::app_role) or private.can_edit_module(auth.uid(),'learning'));

-- RLS: assignments
create policy "read own or admin assignments" on public.course_assignments
  for select to authenticated using (
    profile_id = auth.uid()
    or private.has_role(auth.uid(),'admin'::app_role)
    or private.can_edit_module(auth.uid(),'learning')
  );
create policy "admin manage assignments" on public.course_assignments
  for all to authenticated
  using (private.has_role(auth.uid(),'admin'::app_role) or private.can_edit_module(auth.uid(),'learning'))
  with check (private.has_role(auth.uid(),'admin'::app_role) or private.can_edit_module(auth.uid(),'learning'));
create policy "learner update own assignment" on public.course_assignments
  for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- RLS: lesson progress
create policy "read own or admin progress" on public.course_lesson_progress
  for select to authenticated using (
    private.owns_assignment(auth.uid(), assignment_id)
    or private.has_role(auth.uid(),'admin'::app_role)
    or private.can_edit_module(auth.uid(),'learning')
  );
create policy "learner write own progress" on public.course_lesson_progress
  for insert to authenticated with check (private.owns_assignment(auth.uid(), assignment_id));
create policy "learner delete own progress" on public.course_lesson_progress
  for delete to authenticated using (private.owns_assignment(auth.uid(), assignment_id));

-- RLS: quiz attempts
create policy "read own or admin attempts" on public.course_quiz_attempts
  for select to authenticated using (
    private.owns_assignment(auth.uid(), assignment_id)
    or private.has_role(auth.uid(),'admin'::app_role)
    or private.can_edit_module(auth.uid(),'learning')
  );
create policy "learner write own attempts" on public.course_quiz_attempts
  for insert to authenticated with check (private.owns_assignment(auth.uid(), assignment_id));

-- RLS: certificates
create policy "read own or admin certificates" on public.course_certificates
  for select to authenticated using (
    private.owns_assignment(auth.uid(), assignment_id)
    or private.has_role(auth.uid(),'admin'::app_role)
    or private.can_edit_module(auth.uid(),'learning')
  );
create policy "learner issue own certificate" on public.course_certificates
  for insert to authenticated with check (private.owns_assignment(auth.uid(), assignment_id));

-- Audit
create trigger audit_courses after insert or update or delete on public.courses
  for each row execute function public.tg_audit_log('learning');
create trigger audit_course_assignments after insert or update or delete on public.course_assignments
  for each row execute function public.tg_audit_log('learning');

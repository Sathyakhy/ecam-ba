-- Ensure course-materials bucket exists and remains public for learner content playback
insert into storage.buckets (id, name, public)
values ('course-materials', 'course-materials', true)
on conflict (id) do update set public = true;

-- Replace course-materials storage policies with explicit, resilient access rules
drop policy if exists "course materials public read" on storage.objects;
drop policy if exists "course materials managers insert" on storage.objects;
drop policy if exists "course materials managers update" on storage.objects;
drop policy if exists "course materials managers delete" on storage.objects;

drop policy if exists "learning write course-materials" on storage.objects;
drop policy if exists "learning update course-materials" on storage.objects;
drop policy if exists "learning delete course-materials" on storage.objects;

create policy "course materials public read"
on storage.objects
for select
to public
using (bucket_id = 'course-materials');

create policy "course materials managers insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'course-materials'
  and (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or private.has_role(auth.uid(), 'admin'::public.app_role)
    or private.can_edit_module(auth.uid(), 'learning')
  )
);

create policy "course materials managers update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'course-materials'
  and (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or private.has_role(auth.uid(), 'admin'::public.app_role)
    or private.can_edit_module(auth.uid(), 'learning')
  )
)
with check (
  bucket_id = 'course-materials'
  and (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or private.has_role(auth.uid(), 'admin'::public.app_role)
    or private.can_edit_module(auth.uid(), 'learning')
  )
);

create policy "course materials managers delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'course-materials'
  and (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or private.has_role(auth.uid(), 'admin'::public.app_role)
    or private.can_edit_module(auth.uid(), 'learning')
  )
);
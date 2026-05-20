-- Avoid broad public listing on course materials while keeping files available to signed-in users

drop policy if exists "course materials public read" on storage.objects;
drop policy if exists "course materials authenticated read" on storage.objects;

create policy "course materials authenticated read"
on storage.objects
for select
to authenticated
using (bucket_id = 'course-materials');

-- Storage policies should rely on private role helpers only
drop policy if exists "course materials managers insert" on storage.objects;
drop policy if exists "course materials managers update" on storage.objects;
drop policy if exists "course materials managers delete" on storage.objects;

create policy "course materials managers insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'course-materials'
  and (
    private.has_role(auth.uid(), 'admin'::public.app_role)
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
    private.has_role(auth.uid(), 'admin'::public.app_role)
    or private.can_edit_module(auth.uid(), 'learning')
  )
)
with check (
  bucket_id = 'course-materials'
  and (
    private.has_role(auth.uid(), 'admin'::public.app_role)
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
    private.has_role(auth.uid(), 'admin'::public.app_role)
    or private.can_edit_module(auth.uid(), 'learning')
  )
);

-- Prevent direct API calls to public security-definer helper
revoke execute on function public.has_role(uuid, public.app_role) from public;
revoke execute on function public.has_role(uuid, public.app_role) from anon;
revoke execute on function public.has_role(uuid, public.app_role) from authenticated;
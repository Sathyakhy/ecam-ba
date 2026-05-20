INSERT INTO storage.buckets (id, name, public)
VALUES ('course-materials', 'course-materials', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "auth read course-materials"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'course-materials');

CREATE POLICY "learning write course-materials"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'course-materials'
  AND (private.has_role(auth.uid(), 'admin'::app_role) OR private.can_edit_module(auth.uid(), 'learning'))
);

CREATE POLICY "learning update course-materials"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'course-materials'
  AND (private.has_role(auth.uid(), 'admin'::app_role) OR private.can_edit_module(auth.uid(), 'learning'))
);

CREATE POLICY "learning delete course-materials"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'course-materials'
  AND (private.has_role(auth.uid(), 'admin'::app_role) OR private.can_edit_module(auth.uid(), 'learning'))
);
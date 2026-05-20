DROP POLICY IF EXISTS "auth read branding" ON storage.objects;
DROP POLICY IF EXISTS "auth read avatars" ON storage.objects;

CREATE POLICY "auth read branding"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'branding');

CREATE POLICY "auth read avatars"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');
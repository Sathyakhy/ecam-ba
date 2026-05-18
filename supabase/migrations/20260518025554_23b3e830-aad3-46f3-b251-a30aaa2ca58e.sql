
-- Replace broad public SELECT policies on storage.objects with authenticated-only listing.
-- Public buckets still serve files via direct CDN URLs without needing SELECT on storage.objects.
DROP POLICY IF EXISTS "public read avatars" ON storage.objects;
DROP POLICY IF EXISTS "public read branding" ON storage.objects;

CREATE POLICY "auth read avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "auth read branding"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'branding');

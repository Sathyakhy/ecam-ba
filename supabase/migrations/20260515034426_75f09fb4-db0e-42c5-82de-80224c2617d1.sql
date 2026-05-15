
INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', true), ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public read branding" ON storage.objects FOR SELECT USING (bucket_id = 'branding');
CREATE POLICY "auth write branding" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'branding');
CREATE POLICY "auth update branding" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'branding');
CREATE POLICY "auth delete branding" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'branding');

CREATE POLICY "public read avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "auth write avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "auth update avatars" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars');
CREATE POLICY "auth delete avatars" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars');

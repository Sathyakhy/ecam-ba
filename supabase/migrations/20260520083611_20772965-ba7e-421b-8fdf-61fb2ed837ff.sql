CREATE POLICY "Authenticated can read buckets"
  ON storage.buckets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can read public buckets"
  ON storage.buckets FOR SELECT
  TO anon
  USING (public = true);
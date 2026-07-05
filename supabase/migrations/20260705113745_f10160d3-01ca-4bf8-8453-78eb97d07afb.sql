
-- Drop overly permissive policies on email-attachments bucket
DROP POLICY IF EXISTS "Authenticated users can view email attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read email attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone authenticated can view email attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view email attachments" ON storage.objects;
DROP POLICY IF EXISTS "Public read email attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete email attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete email attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone authenticated can delete email attachments" ON storage.objects;

-- Owner-only SELECT (path prefix is user's uid)
CREATE POLICY "Users can read own email attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'email-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Owner-only DELETE
CREATE POLICY "Users can delete own email attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'email-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Owner-only UPDATE (also close missing-update-policy warning)
CREATE POLICY "Users can update own email attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'email-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'email-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

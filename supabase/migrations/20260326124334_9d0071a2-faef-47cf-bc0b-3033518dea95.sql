-- Create storage bucket for email attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('email-attachments', 'email-attachments', true, 10485760);

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'email-attachments');

-- Allow authenticated users to read attachments
CREATE POLICY "Anyone can read attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'email-attachments');

-- Allow users to delete their own attachments
CREATE POLICY "Users can delete their own attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'email-attachments');

-- Create account_deletion_requests table
CREATE TABLE public.account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own deletion request"
ON public.account_deletion_requests FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own deletion requests"
ON public.account_deletion_requests FOR SELECT TO authenticated
USING (auth.uid() = user_id);
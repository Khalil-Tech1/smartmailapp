ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sender_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_signature text;
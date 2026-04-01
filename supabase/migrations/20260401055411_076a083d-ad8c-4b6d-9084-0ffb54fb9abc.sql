
-- Drop the broken foreign key on mail_groups
ALTER TABLE public.mail_groups DROP CONSTRAINT IF EXISTS mail_groups_user_id_fkey;

-- Insert missing profile for existing user
INSERT INTO public.profiles (user_id, full_name)
SELECT id, raw_user_meta_data->>'full_name'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.profiles)
ON CONFLICT DO NOTHING;

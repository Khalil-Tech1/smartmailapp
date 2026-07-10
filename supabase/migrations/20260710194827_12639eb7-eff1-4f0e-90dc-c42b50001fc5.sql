CREATE POLICY "Team members can view owner profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_team_member_of_owner(user_id, ARRAY['admin','editor','viewer']));

REVOKE ALL ON FUNCTION public.accept_team_invite(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_team_member_of_owner(UUID, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_team_invite(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_member_of_owner(UUID, TEXT[]) TO authenticated;

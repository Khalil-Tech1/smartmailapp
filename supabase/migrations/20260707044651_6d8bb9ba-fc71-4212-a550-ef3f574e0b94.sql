
CREATE OR REPLACE FUNCTION public.is_team_member_of_owner(_owner UUID, _roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members tm
    JOIN public.teams t ON t.id = tm.team_id
    WHERE t.owner_id = _owner
      AND tm.user_id = auth.uid()
      AND tm.role::text = ANY(_roles)
  );
$$;

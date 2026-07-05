
-- 1. Create private schema for internal helper functions
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- 2. Recreate SECURITY DEFINER helpers in private schema
CREATE OR REPLACE FUNCTION private.is_team_owner(_user_id uuid, _team_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.teams WHERE id = _team_id AND owner_id = _user_id) $$;

CREATE OR REPLACE FUNCTION private.is_team_member(_user_id uuid, _team_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.team_members WHERE team_id = _team_id AND user_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.teams WHERE id = _team_id AND owner_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION private.is_team_admin(_user_id uuid, _team_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.team_members WHERE team_id = _team_id AND user_id = _user_id AND role = 'admin')
      OR EXISTS (SELECT 1 FROM public.teams WHERE id = _team_id AND owner_id = _user_id)
$$;

REVOKE ALL ON FUNCTION private.is_team_owner(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_team_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_team_admin(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_team_owner(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_team_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_team_admin(uuid, uuid) TO authenticated, service_role;

-- 3. Rewrite policies that reference public.is_team_* to use private.*
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, cmd, qual, with_check, roles
    FROM pg_policies
    WHERE schemaname='public'
      AND (qual LIKE '%is_team_owner%' OR qual LIKE '%is_team_member%' OR qual LIKE '%is_team_admin%'
        OR with_check LIKE '%is_team_owner%' OR with_check LIKE '%is_team_member%' OR with_check LIKE '%is_team_admin%')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I FOR %s TO %s %s %s',
      r.policyname, r.schemaname, r.tablename, r.cmd,
      array_to_string(r.roles, ','),
      CASE WHEN r.qual IS NOT NULL THEN 'USING (' || replace(replace(replace(r.qual,'is_team_owner(','private.is_team_owner('),'is_team_member(','private.is_team_member('),'is_team_admin(','private.is_team_admin(') || ')' ELSE '' END,
      CASE WHEN r.with_check IS NOT NULL THEN 'WITH CHECK (' || replace(replace(replace(r.with_check,'is_team_owner(','private.is_team_owner('),'is_team_member(','private.is_team_member('),'is_team_admin(','private.is_team_admin(') || ')' ELSE '' END
    );
  END LOOP;
END $$;

-- 4. Drop old public helper functions
DROP FUNCTION IF EXISTS public.is_team_owner(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_team_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_team_admin(uuid, uuid);

-- 5. Restrict trigger helpers so anon/authenticated cannot invoke them via the API
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- 6. Replace always-true tracking-pixel policy with a scoped check
DROP POLICY IF EXISTS "Anyone can insert tracking events" ON public.campaign_tracking;
CREATE POLICY "Anyone can insert tracking events"
ON public.campaign_tracking
FOR INSERT
TO anon, authenticated
WITH CHECK (
  event_type IN ('open','click')
  AND campaign_id IS NOT NULL
  AND recipient_email IS NOT NULL
  AND char_length(recipient_email) <= 320
);

-- 7. Add owner-scoped UPDATE and DELETE policies on account_deletion_requests
CREATE POLICY "Users can update their own deletion request"
ON public.account_deletion_requests
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own deletion request"
ON public.account_deletion_requests
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

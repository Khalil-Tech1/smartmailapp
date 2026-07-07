
-- 1. team_invites: token + expires_at + status widening
ALTER TABLE public.team_invites
  ADD COLUMN IF NOT EXISTS token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Backfill tokens for any existing rows so UNIQUE holds
UPDATE public.team_invites SET token = gen_random_uuid()::text WHERE token IS NULL;
UPDATE public.team_invites SET expires_at = created_at + interval '48 hours' WHERE expires_at IS NULL;

CREATE INDEX IF NOT EXISTS team_invites_token_idx ON public.team_invites(token);
CREATE INDEX IF NOT EXISTS team_invites_email_status_idx ON public.team_invites(lower(email), status);

-- 2. team_members: email column for UI display
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS email TEXT;

-- 3. Allow invitee to read their own invite row by token or email
DROP POLICY IF EXISTS "Invitee can read own invite" ON public.team_invites;
CREATE POLICY "Invitee can read own invite" ON public.team_invites
  FOR SELECT TO authenticated
  USING (
    lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  );

-- 4. accept_team_invite RPC (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.accept_team_invite(_token TEXT)
RETURNS TABLE(team_id UUID, team_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT;
  v_invite RECORD;
  v_team RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  SELECT * INTO v_invite FROM public.team_invites WHERE token = _token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite_not_found';
  END IF;

  IF v_invite.status = 'cancelled' THEN
    RAISE EXCEPTION 'invite_cancelled';
  END IF;

  IF v_invite.status = 'accepted' THEN
    -- Idempotent: if already accepted and caller is the member, return team info.
    SELECT id, name INTO v_team FROM public.teams WHERE id = v_invite.team_id;
    RETURN QUERY SELECT v_team.id, v_team.name;
    RETURN;
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < now() THEN
    UPDATE public.team_invites SET status = 'expired' WHERE id = v_invite.id;
    RAISE EXCEPTION 'invite_expired';
  END IF;

  IF lower(v_invite.email) <> lower(v_email) THEN
    RAISE EXCEPTION 'invite_email_mismatch';
  END IF;

  -- Idempotent membership insert
  INSERT INTO public.team_members (team_id, user_id, role, email)
  VALUES (v_invite.team_id, v_uid, v_invite.role, v_email)
  ON CONFLICT DO NOTHING;

  UPDATE public.team_invites SET status = 'accepted' WHERE id = v_invite.id;

  SELECT id, name INTO v_team FROM public.teams WHERE id = v_invite.team_id;
  RETURN QUERY SELECT v_team.id, v_team.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_team_invite(TEXT) TO authenticated;

-- 5. Helper: is caller a team member of the given owner (with allowed roles)
CREATE OR REPLACE FUNCTION public.is_team_member_of_owner(_owner UUID, _roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
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

GRANT EXECUTE ON FUNCTION public.is_team_member_of_owner(UUID, TEXT[]) TO authenticated;

-- 6. Widen RLS on mail_groups / group_members / sent_emails / email_campaigns
--    Owners keep full access. Team members get access based on role.

-- mail_groups
DROP POLICY IF EXISTS "Team can view owner mail groups" ON public.mail_groups;
CREATE POLICY "Team can view owner mail groups" ON public.mail_groups
  FOR SELECT TO authenticated
  USING (public.is_team_member_of_owner(user_id, ARRAY['admin','editor','viewer']));

DROP POLICY IF EXISTS "Team can insert owner mail groups" ON public.mail_groups;
CREATE POLICY "Team can insert owner mail groups" ON public.mail_groups
  FOR INSERT TO authenticated
  WITH CHECK (public.is_team_member_of_owner(user_id, ARRAY['admin','editor']));

DROP POLICY IF EXISTS "Team can update owner mail groups" ON public.mail_groups;
CREATE POLICY "Team can update owner mail groups" ON public.mail_groups
  FOR UPDATE TO authenticated
  USING (public.is_team_member_of_owner(user_id, ARRAY['admin','editor']));

DROP POLICY IF EXISTS "Team admins can delete owner mail groups" ON public.mail_groups;
CREATE POLICY "Team admins can delete owner mail groups" ON public.mail_groups
  FOR DELETE TO authenticated
  USING (public.is_team_member_of_owner(user_id, ARRAY['admin']));

-- group_members (scoped by parent mail_groups.user_id)
DROP POLICY IF EXISTS "Team can view owner group members" ON public.group_members;
CREATE POLICY "Team can view owner group members" ON public.group_members
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.mail_groups mg
    WHERE mg.id = group_members.group_id
      AND public.is_team_member_of_owner(mg.user_id, ARRAY['admin','editor','viewer'])
  ));

DROP POLICY IF EXISTS "Team can insert owner group members" ON public.group_members;
CREATE POLICY "Team can insert owner group members" ON public.group_members
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.mail_groups mg
    WHERE mg.id = group_members.group_id
      AND public.is_team_member_of_owner(mg.user_id, ARRAY['admin','editor'])
  ));

DROP POLICY IF EXISTS "Team can update owner group members" ON public.group_members;
CREATE POLICY "Team can update owner group members" ON public.group_members
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.mail_groups mg
    WHERE mg.id = group_members.group_id
      AND public.is_team_member_of_owner(mg.user_id, ARRAY['admin','editor'])
  ));

DROP POLICY IF EXISTS "Team admins can delete owner group members" ON public.group_members;
CREATE POLICY "Team admins can delete owner group members" ON public.group_members
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.mail_groups mg
    WHERE mg.id = group_members.group_id
      AND public.is_team_member_of_owner(mg.user_id, ARRAY['admin'])
  ));

-- sent_emails: viewer/editor/admin can read; only admin can insert (send). Editor cannot send.
DROP POLICY IF EXISTS "Team can view owner sent emails" ON public.sent_emails;
CREATE POLICY "Team can view owner sent emails" ON public.sent_emails
  FOR SELECT TO authenticated
  USING (public.is_team_member_of_owner(user_id, ARRAY['admin','editor','viewer']));

DROP POLICY IF EXISTS "Team admins can insert owner sent emails" ON public.sent_emails;
CREATE POLICY "Team admins can insert owner sent emails" ON public.sent_emails
  FOR INSERT TO authenticated
  WITH CHECK (public.is_team_member_of_owner(user_id, ARRAY['admin']));

-- email_campaigns
DROP POLICY IF EXISTS "Team can view owner campaigns" ON public.email_campaigns;
CREATE POLICY "Team can view owner campaigns" ON public.email_campaigns
  FOR SELECT TO authenticated
  USING (public.is_team_member_of_owner(user_id, ARRAY['admin','editor','viewer']));

DROP POLICY IF EXISTS "Team can insert owner campaigns" ON public.email_campaigns;
CREATE POLICY "Team can insert owner campaigns" ON public.email_campaigns
  FOR INSERT TO authenticated
  WITH CHECK (public.is_team_member_of_owner(user_id, ARRAY['admin','editor']));

DROP POLICY IF EXISTS "Team can update owner campaigns" ON public.email_campaigns;
CREATE POLICY "Team can update owner campaigns" ON public.email_campaigns
  FOR UPDATE TO authenticated
  USING (public.is_team_member_of_owner(user_id, ARRAY['admin','editor']));

DROP POLICY IF EXISTS "Team admins can delete owner campaigns" ON public.email_campaigns;
CREATE POLICY "Team admins can delete owner campaigns" ON public.email_campaigns
  FOR DELETE TO authenticated
  USING (public.is_team_member_of_owner(user_id, ARRAY['admin']));

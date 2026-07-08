
-- 1. team_invites: drop invitee UPDATE policy (acceptance is done via SECURITY DEFINER RPC)
DROP POLICY IF EXISTS "Invited users can update their invites" ON public.team_invites;

-- 2. campaign_tracking: require campaign_id to reference an existing campaign
DROP POLICY IF EXISTS "Anyone can insert tracking events" ON public.campaign_tracking;
CREATE POLICY "Anyone can insert tracking events for real campaigns"
ON public.campaign_tracking
FOR INSERT
TO anon, authenticated
WITH CHECK (
  event_type = ANY (ARRAY['open'::text, 'click'::text])
  AND campaign_id IS NOT NULL
  AND recipient_email IS NOT NULL
  AND char_length(recipient_email) <= 320
  AND EXISTS (SELECT 1 FROM public.email_campaigns ec WHERE ec.id = campaign_id)
);

-- 3. accept_team_invite: tighten grants
REVOKE ALL ON FUNCTION public.accept_team_invite(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_team_invite(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.accept_team_invite(text) TO authenticated;

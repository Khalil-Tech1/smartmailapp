
CREATE TABLE public.campaign_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('open','click')),
  clicked_url text,
  tracked_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text
);

CREATE INDEX idx_campaign_tracking_campaign ON public.campaign_tracking(campaign_id);
CREATE INDEX idx_campaign_tracking_event ON public.campaign_tracking(campaign_id, event_type);
CREATE INDEX idx_campaign_tracking_recipient ON public.campaign_tracking(campaign_id, recipient_email);

GRANT SELECT ON public.campaign_tracking TO authenticated;
GRANT INSERT, SELECT ON public.campaign_tracking TO anon;
GRANT ALL ON public.campaign_tracking TO service_role;

ALTER TABLE public.campaign_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view campaign tracking"
ON public.campaign_tracking FOR SELECT
TO authenticated
USING (
  campaign_id IN (SELECT id FROM public.email_campaigns WHERE user_id = auth.uid())
);

CREATE POLICY "Anyone can insert tracking events"
ON public.campaign_tracking FOR INSERT
TO anon, authenticated
WITH CHECK (true);

ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS total_opened integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_clicked integer NOT NULL DEFAULT 0;

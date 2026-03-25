
CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'custom',
  heading text NOT NULL DEFAULT '',
  body_text text NOT NULL DEFAULT '',
  cta_text text DEFAULT '',
  cta_url text DEFAULT '',
  footer_text text DEFAULT '',
  primary_color text DEFAULT '#3b82f6',
  logo_url text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own templates" ON public.email_templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create templates" ON public.email_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their templates" ON public.email_templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their templates" ON public.email_templates FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.campaign_ab_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  variant text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  sent_count integer DEFAULT 0,
  open_count integer DEFAULT 0,
  click_count integer DEFAULT 0,
  bounce_count integer DEFAULT 0,
  is_winner boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, variant)
);

ALTER TABLE public.campaign_ab_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their ab tests" ON public.campaign_ab_tests FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.email_campaigns WHERE email_campaigns.id = campaign_ab_tests.campaign_id AND email_campaigns.user_id = auth.uid()));
CREATE POLICY "Users can create ab tests" ON public.campaign_ab_tests FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.email_campaigns WHERE email_campaigns.id = campaign_ab_tests.campaign_id AND email_campaigns.user_id = auth.uid()));
CREATE POLICY "Users can update ab tests" ON public.campaign_ab_tests FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM public.email_campaigns WHERE email_campaigns.id = campaign_ab_tests.campaign_id AND email_campaigns.user_id = auth.uid()));
CREATE POLICY "Users can delete ab tests" ON public.campaign_ab_tests FOR DELETE 
  USING (EXISTS (SELECT 1 FROM public.email_campaigns WHERE email_campaigns.id = campaign_ab_tests.campaign_id AND email_campaigns.user_id = auth.uid()));

ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS bounce_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unsubscribe_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivered_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_ab_test boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ab_winner_metric text DEFAULT 'open_rate',
  ADD COLUMN IF NOT EXISTS ab_winner_decided_at timestamptz;

CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

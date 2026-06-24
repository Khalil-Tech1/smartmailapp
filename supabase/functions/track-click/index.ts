import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const FALLBACK_URL = 'https://smartmailapp.lovable.app'

serve(async (req) => {
  const url = new URL(req.url)
  const parts = url.pathname.split('/').filter(Boolean)
  let campaignId = url.searchParams.get('c') || ''
  let email = url.searchParams.get('e') || ''
  const target = url.searchParams.get('url') || ''
  if (!campaignId && parts.length >= 3) campaignId = parts[parts.length - 2]
  if (!email && parts.length >= 3) email = decodeURIComponent(parts[parts.length - 1])

  // Validate target
  let redirectTo = FALLBACK_URL
  try {
    const t = new URL(target)
    if (t.protocol === 'http:' || t.protocol === 'https:') redirectTo = t.toString()
  } catch { /* invalid url, fall back */ }

  try {
    if (campaignId && email) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      )
      // Unique = first time this recipient clicks this exact URL on this campaign
      const { data: existing } = await supabase
        .from('campaign_tracking')
        .select('id')
        .eq('campaign_id', campaignId)
        .eq('recipient_email', email)
        .eq('event_type', 'click')
        .eq('clicked_url', redirectTo)
        .limit(1)
        .maybeSingle()

      await supabase.from('campaign_tracking').insert({
        campaign_id: campaignId,
        recipient_email: email,
        event_type: 'click',
        clicked_url: redirectTo,
        ip_address: req.headers.get('x-forwarded-for'),
        user_agent: req.headers.get('user-agent'),
      })

      if (!existing) {
        const { data: c } = await supabase
          .from('email_campaigns')
          .select('total_clicked, click_count')
          .eq('id', campaignId)
          .maybeSingle()
        await supabase
          .from('email_campaigns')
          .update({
            total_clicked: (c?.total_clicked || 0) + 1,
            click_count: (c?.click_count || 0) + 1,
          })
          .eq('id', campaignId)
      }
    }
  } catch (e) {
    console.error('track-click error', e)
  }

  return new Response(null, {
    status: 302,
    headers: { Location: redirectTo, 'Cache-Control': 'no-store' },
  })
})

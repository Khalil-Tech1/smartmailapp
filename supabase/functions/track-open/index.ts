import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// 1x1 transparent GIF (smaller than PNG, universally supported)
const PIXEL = Uint8Array.from([
  0x47,0x49,0x46,0x38,0x39,0x61,0x01,0x00,0x01,0x00,0x80,0x00,0x00,0xff,0xff,0xff,
  0x00,0x00,0x00,0x21,0xf9,0x04,0x01,0x00,0x00,0x00,0x00,0x2c,0x00,0x00,0x00,0x00,
  0x01,0x00,0x01,0x00,0x00,0x02,0x02,0x44,0x01,0x00,0x3b,
])

const pixelHeaders = {
  'Content-Type': 'image/gif',
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  'Pragma': 'no-cache',
  'Access-Control-Allow-Origin': '*',
}

serve(async (req) => {
  try {
    const url = new URL(req.url)
    // Accept both /track-open/:cid/:email and ?c=&e=
    const parts = url.pathname.split('/').filter(Boolean)
    let campaignId = url.searchParams.get('c') || ''
    let email = url.searchParams.get('e') || ''
    if (!campaignId && parts.length >= 3) campaignId = parts[parts.length - 2]
    if (!email && parts.length >= 3) email = decodeURIComponent(parts[parts.length - 1])

    if (campaignId && email) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      )
      // Only count unique opens per recipient
      const { data: existing } = await supabase
        .from('campaign_tracking')
        .select('id')
        .eq('campaign_id', campaignId)
        .eq('recipient_email', email)
        .eq('event_type', 'open')
        .limit(1)
        .maybeSingle()

      await supabase.from('campaign_tracking').insert({
        campaign_id: campaignId,
        recipient_email: email,
        event_type: 'open',
        ip_address: req.headers.get('x-forwarded-for'),
        user_agent: req.headers.get('user-agent'),
      })

      if (!existing) {
        const { data: c } = await supabase
          .from('email_campaigns')
          .select('total_opened, open_count')
          .eq('id', campaignId)
          .maybeSingle()
        await supabase
          .from('email_campaigns')
          .update({
            total_opened: (c?.total_opened || 0) + 1,
            open_count: (c?.open_count || 0) + 1,
          })
          .eq('id', campaignId)
      }
    }
  } catch (e) {
    console.error('track-open error', e)
  }
  return new Response(PIXEL, { headers: pixelHeaders })
})

import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SENDER_EMAIL = 'hello@smartmail.ink'
const DEFAULT_FROM_NAME = 'SmartMail'
const FN_BASE = `${Deno.env.get('SUPABASE_URL')}/functions/v1`

function buildFrom(senderName: string | null | undefined, tier: string | null | undefined) {
  const allowCustom = tier === 'pro' || tier === 'business'
  const name = (allowCustom && senderName && senderName.trim()) ? senderName.trim() : DEFAULT_FROM_NAME
  // Strip any chars that would break the From header
  const safe = name.replace(/[<>"]/g, '').slice(0, 80)
  return `${safe} <${SENDER_EMAIL}>`
}

// Inject open pixel + rewrite all <a href> links through click tracker.
// Skips mailto:, tel:, #anchors, and URLs already pointing at our tracker.
export function injectTracking(html: string, campaignId: string, recipientEmail: string): string {
  const e = encodeURIComponent(recipientEmail)
  const openUrl = `${FN_BASE}/track-open?c=${campaignId}&e=${e}`
  const rewritten = html.replace(/href=(["'])(.*?)\1/gi, (m, q, url) => {
    if (!url) return m
    const low = url.toLowerCase()
    if (low.startsWith('mailto:') || low.startsWith('tel:') || low.startsWith('#')) return m
    if (low.includes('/functions/v1/track-')) return m
    const clickUrl = `${FN_BASE}/track-click?c=${campaignId}&e=${e}&url=${encodeURIComponent(url)}`
    return `href=${q}${clickUrl}${q}`
  })
  const pixel = `<img src="${openUrl}" width="1" height="1" alt="" style="display:none;border:0;width:1px;height:1px;" />`
  if (/<\/body>/i.test(rewritten)) return rewritten.replace(/<\/body>/i, `${pixel}</body>`)
  return rewritten + pixel
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) throw new Error('RESEND_API_KEY is not configured')

    const supabase = createClient(supabaseUrl, serviceKey)

    // Auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing authorization header')
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) throw new Error('Unauthorized')

    const { recipients: rawRecipients, subject, body, groupId, scheduledAt, voiceNoteTranscript, includeSignature, campaignId, isTest } = await req.json()
    if (!rawRecipients?.length || !subject || !body) {
      throw new Error('Missing required fields: recipients, subject, body')
    }
    const recipients: { email: string }[] = rawRecipients.map((r: any) =>
      typeof r === 'string' ? { email: r } : r
    ).filter((r: any) => r?.email)
    if (!recipients.length) throw new Error('No valid recipient emails provided')

    // Load sender identity from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('sender_name, email_signature, subscription_tier')
      .eq('user_id', user.id)
      .maybeSingle()

    const from = buildFrom(profile?.sender_name, profile?.subscription_tier)
    const tier = profile?.subscription_tier
    const allowSignature = tier === 'basic' || tier === 'pro' || tier === 'business'
    const signature = (includeSignature !== false && allowSignature && profile?.email_signature?.trim())
      ? profile.email_signature.trim()
      : null

    const fullBody = voiceNoteTranscript
      ? `${body}\n\n🎙️ Voice Note:\n${voiceNoteTranscript}`
      : body

    // Schedule path: just save it, cron will process. Pre-merge signature into body so it survives the queue.
    if (scheduledAt) {
      const bodyWithSig = signature ? `${fullBody}\n\n--\n${signature}` : fullBody
      const { error } = await supabase.from('sent_emails').insert({
        user_id: user.id,
        group_id: groupId || null,
        subject,
        body: bodyWithSig,
        recipient_count: recipients.length,
        status: 'scheduled',
        scheduled_at: scheduledAt,
        sent_at: null,
      })
      if (error) throw error
      return new Response(JSON.stringify({ success: true, status: 'scheduled', count: recipients.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const signatureBlock = signature
      ? `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px;" />
         <div style="color:#6b7280;font-size:13px;line-height:1.6;">${signature}</div>`
      : ''

    const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#fff;">
      <div style="padding:30px;border-radius:12px;border:1px solid #e5e7eb;">
        <h2 style="color:#1a1a2e;margin:0 0 20px;font-size:20px;">${subject}</h2>
        <div style="color:#4a4a5a;line-height:1.7;white-space:pre-wrap;font-size:15px;">${fullBody}</div>
        ${signatureBlock}
      </div>
      <p style="color:#9ca3af;font-size:11px;text-align:center;margin-top:24px;">Sent via SmartMail</p>
    </body></html>`

    let sentCount = 0
    const errors: string[] = []
    for (const r of recipients) {
      try {
        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ from, to: [r.email], subject, html }),
        })
        if (!resp.ok) throw new Error(`${resp.status}: ${await resp.text()}`)
        sentCount++
      } catch (e: any) {
        errors.push(`${r.email}: ${e.message}`)
      }
    }

    await supabase.from('sent_emails').insert({
      user_id: user.id,
      group_id: groupId || null,
      subject,
      body: fullBody,
      recipient_count: recipients.length,
      status: errors.length === 0 ? 'sent' : sentCount === 0 ? 'failed' : 'partial',
      sent_at: new Date().toISOString(),
    })

    return new Response(JSON.stringify({
      success: sentCount > 0,
      status: errors.length === 0 ? 'sent' : sentCount === 0 ? 'failed' : 'partial',
      sentCount,
      failedCount: errors.length,
      errors: errors.length ? errors : undefined,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

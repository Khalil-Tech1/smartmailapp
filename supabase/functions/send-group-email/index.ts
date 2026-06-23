import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FROM = 'SmartMail <hello@smartmail.ink>'

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

    const { recipients, subject, body, groupId, scheduledAt, voiceNoteTranscript } = await req.json()
    if (!recipients?.length || !subject || !body) {
      throw new Error('Missing required fields: recipients, subject, body')
    }

    const fullBody = voiceNoteTranscript
      ? `${body}\n\n🎙️ Voice Note:\n${voiceNoteTranscript}`
      : body

    // Schedule path: just save it, cron will process
    if (scheduledAt) {
      const { error } = await supabase.from('sent_emails').insert({
        user_id: user.id,
        group_id: groupId || null,
        subject,
        body: fullBody,
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

    const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#fff;">
      <div style="padding:30px;border-radius:12px;border:1px solid #e5e7eb;">
        <h2 style="color:#1a1a2e;margin:0 0 20px;font-size:20px;">${subject}</h2>
        <div style="color:#4a4a5a;line-height:1.7;white-space:pre-wrap;font-size:15px;">${fullBody}</div>
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
          body: JSON.stringify({ from: FROM, to: [r.email], subject, html }),
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

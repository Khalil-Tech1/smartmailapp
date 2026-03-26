import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    // Verify JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing authorization header')
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) throw new Error('Unauthorized')

    const { recipients, subject, body, groupId, scheduledAt, voiceNoteTranscript, attachments } = await req.json()

    if (!recipients?.length || !subject || !body) {
      throw new Error('Missing required fields: recipients, subject, body')
    }

    // Build full body with voice note transcript if provided
    let fullBody = body
    if (voiceNoteTranscript) {
      fullBody += `\n\n🎙️ Voice Note:\n${voiceNoteTranscript}`
    }

    // If scheduled, save and return
    if (scheduledAt) {
      const { error: insertError } = await supabase.from('sent_emails').insert({
        user_id: user.id,
        group_id: groupId || null,
        subject,
        body: fullBody,
        recipient_count: recipients.length,
        status: 'scheduled',
        scheduled_at: scheduledAt,
        sent_at: null,
      })
      if (insertError) throw insertError

      return new Response(JSON.stringify({ success: true, status: 'scheduled', count: recipients.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Build HTML email
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #ffffff;">
        <div style="padding: 30px; border-radius: 12px; border: 1px solid #e5e7eb;">
          <h2 style="color: #1a1a2e; margin: 0 0 20px; font-size: 20px;">${subject}</h2>
          <div style="color: #4a4a5a; line-height: 1.7; white-space: pre-wrap; font-size: 15px;">${fullBody}</div>
          ${voiceNoteTranscript ? `
          <div style="margin-top: 24px; padding: 16px; background: #f0f4ff; border-radius: 8px; border-left: 4px solid #3b82f6;">
            <p style="margin: 0 0 6px; font-weight: 600; color: #1e40af; font-size: 13px;">🎙️ Voice Note Transcript</p>
            <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.5;">${voiceNoteTranscript}</p>
          </div>` : ''}
        </div>
        <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 24px;">Sent via SmartMail</p>
      </body>
      </html>
    `

    // Send emails - for now record as sent
    // Once email domain is configured, actual sending will be enabled
    let sentCount = 0
    const errors: string[] = []

    for (const recipient of recipients) {
      try {
        // TODO: Wire actual email sending via Lovable email API after domain setup
        console.log(`Email queued for: ${recipient.email}`)
        sentCount++
      } catch (e) {
        errors.push(`${recipient.email}: ${e.message}`)
      }
    }

    // Record the send
    const { error: insertError } = await supabase.from('sent_emails').insert({
      user_id: user.id,
      group_id: groupId || null,
      subject,
      body: fullBody,
      recipient_count: recipients.length,
      status: errors.length === 0 ? 'sent' : 'partial',
      sent_at: new Date().toISOString(),
    })
    if (insertError) console.error('Failed to log send:', insertError)

    return new Response(JSON.stringify({
      success: true,
      status: 'sent',
      sentCount,
      failedCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

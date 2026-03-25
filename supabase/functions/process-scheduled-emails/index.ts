import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    // Find scheduled emails that are due
    const now = new Date().toISOString()
    const { data: scheduledEmails, error } = await supabase
      .from('sent_emails')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now)

    if (error) throw error
    if (!scheduledEmails || scheduledEmails.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let processed = 0
    for (const email of scheduledEmails) {
      // Get group members if group_id exists
      let recipients: { email: string; name: string | null }[] = []
      if (email.group_id) {
        const { data: members } = await supabase
          .from('group_members')
          .select('email, name')
          .eq('group_id', email.group_id)
        if (members) recipients = members
      }

      // TODO: When email provider (e.g. Resend) is configured, actually send here
      // For now, mark as sent
      for (const r of recipients) {
        console.log(`Sending scheduled email to: ${r.email}`)
      }

      const { error: updateError } = await supabase
        .from('sent_emails')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', email.id)

      if (!updateError) processed++
    }

    // Also process scheduled campaigns
    const { data: scheduledCampaigns } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now)

    if (scheduledCampaigns) {
      for (const campaign of scheduledCampaigns) {
        if (campaign.group_id) {
          const { data: members } = await supabase
            .from('group_members')
            .select('email, name')
            .eq('group_id', campaign.group_id)

          if (members) {
            for (const r of members) {
              console.log(`Sending scheduled campaign to: ${r.email}`)
            }
            await supabase
              .from('email_campaigns')
              .update({
                status: 'sent',
                sent_at: new Date().toISOString(),
                sent_count: members.length,
                delivered_count: members.length,
              })
              .eq('id', campaign.id)
            processed++
          }
        }
      }
    }

    return new Response(JSON.stringify({ processed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error processing scheduled emails:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

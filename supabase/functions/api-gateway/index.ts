import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  try {
    // Validate API key
    const apiKey = req.headers.get('x-api-key')
    if (!apiKey) {
      return jsonResponse({ success: false, error: 'Missing X-API-Key header' }, 401)
    }

    // Hash the provided key
    const encoder = new TextEncoder()
    const data = encoder.encode(apiKey)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    // Look up the key
    const { data: keyRecord, error: keyError } = await supabase
      .from('api_keys')
      .select('*')
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single()

    if (keyError || !keyRecord) {
      return jsonResponse({ success: false, error: 'Invalid or revoked API key' }, 401)
    }

    // Check if user is enterprise tier
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('user_id', keyRecord.user_id)
      .single()

    if (!profile || profile.subscription_tier !== 'enterprise') {
      return jsonResponse({ success: false, error: 'API access requires Enterprise plan' }, 403)
    }

    // Check rate limit (10,000/month)
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { count } = await supabase
      .from('api_usage_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', keyRecord.user_id)
      .gte('created_at', startOfMonth.toISOString())

    if ((count || 0) >= 10000) {
      return jsonResponse({ success: false, error: 'Monthly API limit reached (10,000 calls)' }, 429)
    }

    // Update last_used_at
    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', keyRecord.id)

    // Parse request
    const body = await req.json()
    const { endpoint, data: requestData } = body

    if (!endpoint) {
      return jsonResponse({ success: false, error: 'Missing endpoint field' }, 400)
    }

    // Route to handler
    let result: any
    let statusCode = 200

    switch (endpoint) {
      case '/api/v1/groups':
        result = await handleGetGroups(supabase, keyRecord.user_id)
        break
      case '/api/v1/create-group':
        result = await handleCreateGroup(supabase, keyRecord.user_id, requestData)
        break
      case '/api/v1/add-contact':
        result = await handleAddContact(supabase, keyRecord.user_id, requestData)
        break
      case '/api/v1/contact':
        result = await handleDeleteContact(supabase, keyRecord.user_id, requestData)
        break
      case '/api/v1/send-email':
        result = await handleSendEmail(supabase, keyRecord.user_id, requestData)
        break
      case '/api/v1/analytics':
        result = await handleGetAnalytics(supabase, keyRecord.user_id)
        break
      default:
        result = { error: `Unknown endpoint: ${endpoint}` }
        statusCode = 404
    }

    // Log usage
    await supabase.from('api_usage_logs').insert({
      api_key_id: keyRecord.id,
      user_id: keyRecord.user_id,
      endpoint,
      method: req.method,
      status_code: statusCode,
    })

    return jsonResponse({ success: statusCode < 400, ...result }, statusCode)
  } catch (error) {
    return jsonResponse({ success: false, error: error.message }, 500)
  }
})

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// --- Handlers ---

async function handleGetGroups(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('mail_groups')
    .select('id, name, description, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }
  return { data }
}

async function handleCreateGroup(supabase: any, userId: string, data: any) {
  if (!data?.name) return { error: 'Missing required field: name' }

  const { data: group, error } = await supabase
    .from('mail_groups')
    .insert({ name: data.name, description: data.description || null, user_id: userId })
    .select()
    .single()

  if (error) return { error: error.message }
  return { data: group }
}

async function handleAddContact(supabase: any, userId: string, data: any) {
  if (!data?.group_id || !data?.email) return { error: 'Missing required fields: group_id, email' }

  // Verify group ownership
  const { data: group } = await supabase
    .from('mail_groups')
    .select('id')
    .eq('id', data.group_id)
    .eq('user_id', userId)
    .single()

  if (!group) return { error: 'Group not found or access denied' }

  const { data: member, error } = await supabase
    .from('group_members')
    .insert({ group_id: data.group_id, email: data.email, name: data.name || null })
    .select()
    .single()

  if (error) return { error: error.message }
  return { data: member }
}

async function handleDeleteContact(supabase: any, userId: string, data: any) {
  if (!data?.contact_id) return { error: 'Missing required field: contact_id' }

  // Verify ownership through group
  const { data: member } = await supabase
    .from('group_members')
    .select('id, group_id, mail_groups!inner(user_id)')
    .eq('id', data.contact_id)
    .single()

  if (!member || (member as any).mail_groups?.user_id !== userId) {
    return { error: 'Contact not found or access denied' }
  }

  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('id', data.contact_id)

  if (error) return { error: error.message }
  return { data: { deleted: true } }
}

async function handleSendEmail(supabase: any, userId: string, data: any) {
  if (!data?.group_id || !data?.subject || !data?.body) {
    return { error: 'Missing required fields: group_id, subject, body' }
  }

  // Get group members
  const { data: members } = await supabase
    .from('group_members')
    .select('email, name')
    .eq('group_id', data.group_id)

  if (!members || members.length === 0) {
    return { error: 'No contacts in this group' }
  }

  // Record the email
  const { error } = await supabase.from('sent_emails').insert({
    user_id: userId,
    group_id: data.group_id,
    subject: data.subject,
    body: data.body,
    recipient_count: members.length,
    status: data.scheduled_at ? 'scheduled' : 'sent',
    scheduled_at: data.scheduled_at || null,
    sent_at: data.scheduled_at ? null : new Date().toISOString(),
  })

  if (error) return { error: error.message }
  return { data: { sent_to: members.length, status: data.scheduled_at ? 'scheduled' : 'sent' } }
}

async function handleGetAnalytics(supabase: any, userId: string) {
  const { data: campaigns } = await supabase
    .from('email_campaigns')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)

  const { data: sentEmails } = await supabase
    .from('sent_emails')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  return {
    data: {
      campaigns: campaigns || [],
      recent_emails: sentEmails || [],
      summary: {
        total_campaigns: campaigns?.length || 0,
        total_emails_sent: sentEmails?.length || 0,
      }
    }
  }
}

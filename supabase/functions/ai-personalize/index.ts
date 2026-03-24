import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions"

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    // Verify JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing authorization header')
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) throw new Error('Unauthorized')

    const { action, message, recipientName, recipientEmail, voiceText } = await req.json()

    if (action === 'personalize') {
      // AI-personalize a message for a specific recipient
      if (!message) throw new Error('Message is required')

      const systemPrompt = `You are a professional email writing assistant. Your job is to personalize email messages to feel more personal and engaging while maintaining the original intent and key information. Keep the tone professional but warm. Do NOT add a subject line - just return the personalized message body. Keep it concise.`

      const userPrompt = recipientName
        ? `Personalize this email message for a recipient named "${recipientName}" (email: ${recipientEmail || 'unknown'}):\n\n${message}`
        : `Improve and polish this email message to be more engaging and professional:\n\n${message}`

      const aiResponse = await fetch(AI_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      })

      if (!aiResponse.ok) {
        const errText = await aiResponse.text()
        throw new Error(`AI API error: ${aiResponse.status} - ${errText}`)
      }

      const aiData = await aiResponse.json()
      const personalizedMessage = aiData.choices?.[0]?.message?.content || message

      return new Response(JSON.stringify({ personalizedMessage }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'transcribe') {
      // Transcribe/summarize voice note text
      if (!voiceText) throw new Error('Voice text is required')

      const aiResponse = await fetch(AI_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'You are a helpful assistant. Clean up and format this voice note transcription into clear, well-written text suitable for an email. Fix any grammar issues and make it flow naturally. Keep the same meaning and tone. Return only the cleaned text.' },
            { role: 'user', content: voiceText },
          ],
        }),
      })

      if (!aiResponse.ok) {
        const errText = await aiResponse.text()
        throw new Error(`AI API error: ${aiResponse.status} - ${errText}`)
      }

      const aiData = await aiResponse.json()
      const cleanedText = aiData.choices?.[0]?.message?.content || voiceText

      return new Response(JSON.stringify({ transcription: cleanedText }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    throw new Error('Invalid action. Use "personalize" or "transcribe".')
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

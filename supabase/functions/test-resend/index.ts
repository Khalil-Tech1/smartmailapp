import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

serve(async (_req) => {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) return new Response(JSON.stringify({ error: 'RESEND_API_KEY missing' }), { status: 500 })

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'onboarding@resend.dev',
      to: 'ikhalil.isa1@gmail.com',
      subject: 'SmartMail test email',
      html: '<p>This is a test email from SmartMail via Resend.</p>',
    }),
  })
  const text = await r.text()
  return new Response(JSON.stringify({ status: r.status, body: text }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

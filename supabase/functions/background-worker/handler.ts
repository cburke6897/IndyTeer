import { createClient } from 'npm:@supabase/supabase-js@2.119.0'
import type { Database } from '../_shared/database.ts'

export async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST')
    return Response.json({ error: 'Method not allowed.' }, { status: 405 })
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!cronSecret || request.headers.get('Authorization') !== 'Bearer ' + cronSecret)
    return Response.json({ error: 'Unauthorized.' }, { status: 401 })
  try {
    const url = Deno.env.get('SUPABASE_URL')
    const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}')
    const key = secretKeys.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !key) throw new Error('Server credentials are missing.')
    const deadline = Date.now() + 90_000
    const admin = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }),
      },
    })
    const reminders = await admin.rpc('enqueue_event_reminders')
    if (reminders.error) throw reminders.error
    let cleaned = 0,
      emailed = 0
    for (let count = 0; count < 25 && Date.now() < deadline; count++) {
      const media = await admin.rpc('claim_media_cleanup_jobs', { p_limit: 1 })
      if (media.error) throw media.error
      const job = media.data?.[0]
      if (!job) break
      const result = await admin.storage.from(job.bucket).remove([job.path])
      const finish = await admin.rpc('finish_media_cleanup_job', {
        p_id: job.id,
        p_error: result.error?.message,
      })
      if (finish.error) throw finish.error
      if (!result.error) cleaned++
    }
    const resendKey = Deno.env.get('RESEND_API_KEY')
    const from = Deno.env.get('NOTIFICATION_FROM_EMAIL')
    if (resendKey && from) {
      for (let count = 0; count < 5 && Date.now() < deadline; count++) {
        const emails = await admin.rpc('claim_email_jobs', { p_limit: 1 })
        if (emails.error) throw emails.error
        const job = emails.data?.[0]
        if (!job) break
        let failure: string | null = null
        try {
          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: 'Bearer ' + resendKey,
              'Content-Type': 'application/json',
              'Idempotency-Key': job.id,
            },
            body: JSON.stringify({ from, to: [job.email], subject: job.subject, text: job.body }),
            signal: AbortSignal.timeout(15000),
          })
          if (!response.ok) failure = 'Email provider returned status ' + response.status
        } catch {
          failure = 'Email provider request failed.'
        }
        const finish = await admin.rpc('finish_email_job', { p_id: job.id, p_error: failure || undefined })
        if (finish.error) throw finish.error
        if (!failure) emailed++
      }
    }
    return Response.json({
      reminders: reminders.data,
      cleaned,
      emailed,
      emailConfigured: Boolean(resendKey && from),
    })
  } catch {
    return Response.json(
      { error: 'Background processing failed. Check server logs and retry.' },
      { status: 500 },
    )
  }
}

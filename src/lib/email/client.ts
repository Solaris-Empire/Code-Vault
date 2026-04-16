// Transactional email client.
//
// Wraps Resend. When RESEND_API_KEY is absent (local dev, preview
// deploys without the secret) we no-op and log to stdout so features
// can be built end-to-end without domain verification blocking the
// workflow. Every send — real or stubbed — writes an email_log row so
// the audit trail is consistent across environments.

import { Resend } from 'resend'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { captureError } from '@/lib/error-tracking'

export type SendEmailArgs = {
  to: string
  toUserId?: string | null
  kind: string
  subject: string
  html: string
  text: string
  // dedupeKey is persisted with a UNIQUE constraint — reusing one
  // guarantees the email only ever leaves the building once, even
  // under Stripe webhook retries.
  dedupeKey?: string | null
}

export type SendEmailResult = {
  ok: boolean
  status: 'sent' | 'skipped' | 'failed'
  resendId?: string | null
  error?: string
}

// Lazy singleton so we don't instantiate Resend on routes that never
// send mail (e.g. static pages).
let resendClient: Resend | null = null
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  if (!resendClient) resendClient = new Resend(key)
  return resendClient
}

function getFromAddress(): string {
  return process.env.EMAIL_FROM || 'CodeVault <onboarding@resend.dev>'
}

export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const resend = getResend()
  const admin = getSupabaseAdmin()

  // If we've already sent this dedupeKey, skip — treat as success.
  if (args.dedupeKey) {
    const { data: existing } = await admin
      .from('email_log')
      .select('id, status')
      .eq('dedupe_key', args.dedupeKey)
      .maybeSingle()
    if (existing) {
      return { ok: true, status: 'skipped' }
    }
  }

  // No API key — log row as 'skipped' and print a dev-friendly line.
  if (!resend) {
    await logEmail({ ...args, status: 'skipped', error: 'RESEND_API_KEY not set' })
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[email:stub] to=${args.to} kind=${args.kind} subject="${args.subject}"`)
    }
    return { ok: true, status: 'skipped' }
  }

  try {
    const { data, error } = await resend.emails.send({
      from: getFromAddress(),
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
    })
    if (error) throw error
    await logEmail({ ...args, status: 'sent', resendId: data?.id ?? null })
    return { ok: true, status: 'sent', resendId: data?.id ?? null }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await logEmail({ ...args, status: 'failed', error: message })
    captureError(err instanceof Error ? err : new Error(message), {
      context: 'email:send',
      extra: { kind: args.kind, to: args.to },
    })
    return { ok: false, status: 'failed', error: message }
  }
}

async function logEmail(
  row: SendEmailArgs & { status: 'sent' | 'skipped' | 'failed'; resendId?: string | null; error?: string },
) {
  const admin = getSupabaseAdmin()
  await admin.from('email_log').insert({
    to_email: row.to,
    to_user_id: row.toUserId ?? null,
    kind: row.kind,
    subject: row.subject,
    resend_id: row.resendId ?? null,
    status: row.status,
    error: row.error ?? null,
    dedupe_key: row.dedupeKey ?? null,
  })
}

// Respect user-level opt-outs. Returns true when the user has either
// no preferences row or explicitly set the key to anything other than
// false — i.e. opt-out must be explicit.
export async function isEmailKindAllowed(
  userId: string,
  kind: string,
): Promise<boolean> {
  const admin = getSupabaseAdmin()
  const { data } = await admin
    .from('users')
    .select('notification_preferences')
    .eq('id', userId)
    .maybeSingle()
  const prefs = (data?.notification_preferences ?? {}) as Record<string, unknown>
  return prefs[kind] !== false
}

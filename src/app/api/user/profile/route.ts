import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, getSupabaseAdmin } from '@/lib/supabase/server'
import { checkRateLimit, rateLimitConfigs } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

// Only these fields are safe for a user to self-update. role,
// stripe_account_id, stripe_onboarding_complete, xp, rank, tier, email,
// etc. must never be accepted from the client body.
//
// avatar_url is HTTPS-only — `.url()` alone accepts data:, javascript:,
// ftp: and similar which turn into XSS / tracking-pixel / phishing
// vectors when the avatar renders in the feed or seller cards.
const profileUpdateSchema = z
  .object({
    display_name: z.string().trim().min(1).max(60).optional(),
    bio: z.string().trim().max(500).nullable().optional(),
    avatar_url: z
      .string()
      .url()
      .max(500)
      .refine((u) => u.startsWith('https://'), { message: 'avatar_url must be HTTPS' })
      .nullable()
      .optional(),
  })
  .strict()

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data: profile, error } = await supabaseAdmin
      .from('users')
      .select('id, email, display_name, role, avatar_url, bio, stripe_account_id, stripe_onboarding_complete, created_at, updated_at')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('[profile:GET]', error)
      return NextResponse.json({ error: { message: 'Failed to fetch profile' } }, { status: 500 })
    }

    return NextResponse.json({ data: profile })
  } catch {
    return NextResponse.json({ error: { message: 'Failed to fetch profile' } }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const rl = await checkRateLimit(request, rateLimitConfigs.api)
  if (!rl.allowed) return rl.error!

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 })
    }

    const parsed = profileUpdateSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: { message: 'Invalid profile payload', issues: parsed.error.issues } },
        { status: 400 },
      )
    }

    const { data: profile, error } = await supabase
      .from('users')
      .update(parsed.data)
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      console.error('[profile:PUT]', error)
      return NextResponse.json({ error: { message: 'Failed to update profile' } }, { status: 500 })
    }

    return NextResponse.json({ data: profile })
  } catch {
    return NextResponse.json({ error: { message: 'Failed to update profile' } }, { status: 500 })
  }
}

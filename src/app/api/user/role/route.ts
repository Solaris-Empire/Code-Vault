import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, getSupabaseAdmin } from '@/lib/supabase/server'
import { checkRateLimit, rateLimitConfigs } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  role: z.enum(['buyer', 'seller']),
})

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(request, rateLimitConfigs.api)
  if (!rl.allowed) return rl.error!

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 })
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(
        { error: { message: 'Invalid role', details: parsed.error.flatten() } },
        { status: 400 }
      )
    }

    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('users')
      .update({ role: parsed.data.role })
      .eq('id', user.id)
      .select('id, email, role')
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: { message: error.message } }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: { message: 'Profile not found' } }, { status: 404 })
    }
    return NextResponse.json({ data })
  } catch {
    return NextResponse.json(
      { error: { message: 'Failed to update role' } },
      { status: 500 }
    )
  }
}

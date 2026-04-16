// POST /api/reports — file a report on any supported target type.
//
// RLS already enforces (reporter_id = auth.uid()) on insert, but we
// also rate-limit at the app layer so a single user can't rip through
// a thousand target_ids in a minute. The UNIQUE (reporter_id,
// target_type, target_id) constraint blocks duplicates as 409.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/verify'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { checkRateLimit, rateLimitConfigs } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

const ReportSchema = z.object({
  targetType: z.enum([
    'job', 'product', 'user', 'review', 'job_application', 'service', 'post',
  ]),
  targetId: z.string().uuid(),
  reason: z.enum([
    'spam', 'scam', 'fraud', 'illegal', 'harassment',
    'infringement', 'misrepresentation', 'other',
  ]),
  details: z.string().trim().max(2000).nullable().optional(),
})

export async function POST(request: NextRequest) {
  const rl = await checkRateLimit(request, rateLimitConfigs.order)
  if (!rl.allowed) return rl.error!

  const auth = await requireAuth(request)
  if (!auth.success) return auth.error!

  let input: z.infer<typeof ReportSchema>
  try {
    input = ReportSchema.parse(await request.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: { message: 'Invalid report', details: err.issues } },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: { message: 'Invalid request body' } }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  const { error } = await admin.from('reports').insert({
    reporter_id: auth.user!.id,
    target_type: input.targetType,
    target_id: input.targetId,
    reason: input.reason,
    details: input.details ?? null,
  })

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: { message: 'You have already reported this.' } },
        { status: 409 },
      )
    }
    console.error('[reports] insert failed:', error)
    return NextResponse.json({ error: { message: 'Failed to file report' } }, { status: 500 })
  }

  return NextResponse.json({ data: { ok: true } })
}

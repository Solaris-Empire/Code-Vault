// POST /api/community/posts/[id]/report
//
// Creates a lightweight moderation report. UNIQUE(post_id,
// reporter_id) means the same user reporting twice silently succeeds
// (we don't need to tell them — acts like "already reported").

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/verify'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { checkRateLimit, rateLimitConfigs } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

const ReportSchema = z.object({
  reason: z.enum(['spam', 'harassment', 'nsfw', 'misinformation', 'off_topic', 'other']),
  notes: z.string().trim().max(500).optional(),
})

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  // Strict throttle — reports flag content for admin review and a
  // brigading account could otherwise drown the queue.
  const rl = await checkRateLimit(request, rateLimitConfigs.sensitive)
  if (!rl.allowed) return rl.error!

  const auth = await requireAuth(request)
  if (!auth.success) return auth.error!

  const { id } = await ctx.params

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
  const { error } = await admin
    .from('post_reports')
    .upsert(
      {
        post_id: id,
        reporter_id: auth.user!.id,
        reason: input.reason,
        notes: input.notes ?? null,
      },
      { onConflict: 'post_id,reporter_id', ignoreDuplicates: true },
    )

  if (error) {
    console.error('[post-report] insert failed:', error)
    return NextResponse.json({ error: { message: 'Failed to submit report' } }, { status: 500 })
  }

  return NextResponse.json({ data: { ok: true } })
}

// POST /api/jobs/[id]/apply — submit an application to a job.
//
// UNIQUE(job_id, applicant_id) means the same user applying twice
// will 409 gracefully. Cover letter is the only required field —
// portfolio/resume/expected salary are optional.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/verify'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { isBetaEnabled } from '@/lib/feature-flags'
import { checkRateLimit, rateLimitConfigs } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

const ApplySchema = z.object({
  coverLetter: z.string().trim().min(20).max(4000),
  portfolioUrl: z.string().url().max(300).nullable().optional(),
  resumeUrl: z.string().url().max(300).nullable().optional(),
  expectedSalaryCents: z.number().int().min(0).nullable().optional(),
})

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!isBetaEnabled('jobs')) {
    return NextResponse.json({ error: { message: 'Not found' } }, { status: 404 })
  }

  // Throttle application submissions — even with the UNIQUE constraint
  // catching the duplicate write, a rapid-fire client could hammer the
  // endpoint. This stops it at the edge.
  const rl = checkRateLimit(request, rateLimitConfigs.order)
  if (!rl.allowed) return rl.error!

  const auth = await requireAuth(request)
  if (!auth.success) return auth.error!

  const { id } = await ctx.params

  let input: z.infer<typeof ApplySchema>
  try {
    input = ApplySchema.parse(await request.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: { message: 'Invalid application', details: err.issues } },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: { message: 'Invalid request body' } }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  // Confirm the job exists + is active before accepting.
  const { data: job, error: jobErr } = await admin
    .from('jobs')
    .select('id, poster_id, status, expires_at')
    .eq('id', id)
    .single()

  if (jobErr || !job) {
    return NextResponse.json({ error: { message: 'Job not found' } }, { status: 404 })
  }
  if (job.status !== 'active' || new Date(job.expires_at) < new Date()) {
    return NextResponse.json(
      { error: { message: 'This job is no longer accepting applications.' } },
      { status: 400 },
    )
  }
  if (job.poster_id === auth.user!.id) {
    return NextResponse.json(
      { error: { message: 'You cannot apply to your own job listing.' } },
      { status: 400 },
    )
  }

  const { error: insertErr } = await admin
    .from('job_applications')
    .insert({
      job_id: id,
      applicant_id: auth.user!.id,
      cover_letter: input.coverLetter,
      portfolio_url: input.portfolioUrl ?? null,
      resume_url: input.resumeUrl ?? null,
      expected_salary_cents: input.expectedSalaryCents ?? null,
    })

  if (insertErr) {
    // Duplicate-application check maps to a friendly message.
    if (insertErr.code === '23505') {
      return NextResponse.json(
        { error: { message: 'You have already applied to this job.' } },
        { status: 409 },
      )
    }
    console.error('[jobs-apply] insert failed:', insertErr)
    return NextResponse.json({ error: { message: 'Failed to submit application' } }, { status: 500 })
  }

  return NextResponse.json({ data: { ok: true } })
}

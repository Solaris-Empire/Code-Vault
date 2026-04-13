// PATCH /api/jobs/[id]/applications/[appId]
//
// Employer updates the status of an application on their job, and/or
// writes a private note. Applicant-initiated 'withdrawn' goes through
// the applicant-side endpoint instead (not yet built — the applicant
// can re-apply after DB delete in the interim).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/verify'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { isBetaEnabled } from '@/lib/feature-flags'

export const dynamic = 'force-dynamic'

const PatchSchema = z
  .object({
    status: z.enum(['submitted', 'reviewed', 'interviewing', 'offered', 'rejected']).optional(),
    employerNotes: z.string().trim().max(4_000).nullable().optional(),
  })
  .strict()

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string; appId: string }> },
) {
  if (!isBetaEnabled('jobs')) {
    return NextResponse.json({ error: { message: 'Not found' } }, { status: 404 })
  }

  const auth = await requireAuth(request)
  if (!auth.success) return auth.error!

  const { id, appId } = await ctx.params

  let input: z.infer<typeof PatchSchema>
  try {
    input = PatchSchema.parse(await request.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: { message: 'Invalid update', details: err.issues } },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: { message: 'Invalid request body' } }, { status: 400 })
  }

  if (input.status === undefined && input.employerNotes === undefined) {
    return NextResponse.json(
      { error: { message: 'Nothing to update' } },
      { status: 400 },
    )
  }

  const admin = getSupabaseAdmin()

  // One round-trip: verify the application belongs to this job AND the
  // job belongs to the caller. If either check fails we return 404/403.
  const { data: app } = await admin
    .from('job_applications')
    .select('id, job_id, jobs:jobs!job_applications_job_id_fkey(poster_id)')
    .eq('id', appId)
    .eq('job_id', id)
    .maybeSingle()

  if (!app) {
    return NextResponse.json({ error: { message: 'Application not found' } }, { status: 404 })
  }

  // The embedded join returns either a row or (defensive) an array — normalize.
  const posterId = Array.isArray(app.jobs)
    ? (app.jobs[0] as { poster_id?: string } | undefined)?.poster_id
    : (app.jobs as { poster_id?: string } | null)?.poster_id

  if (posterId !== auth.user!.id) {
    return NextResponse.json(
      { error: { message: 'Only the poster can update applications' } },
      { status: 403 },
    )
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.status !== undefined) patch.status = input.status
  if (input.employerNotes !== undefined) patch.employer_notes = input.employerNotes

  const { error: updateErr } = await admin
    .from('job_applications')
    .update(patch)
    .eq('id', appId)

  if (updateErr) {
    console.error('[jobs] application update failed:', updateErr)
    return NextResponse.json({ error: { message: 'Failed to update application' } }, { status: 500 })
  }

  return NextResponse.json({ data: { ok: true } })
}

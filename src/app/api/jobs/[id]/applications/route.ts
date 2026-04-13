// GET /api/jobs/[id]/applications
//
// Employer-only view of applications received on a job they posted.
// Joins the applicant's public profile fields so the UI can render
// a list without a second round-trip per row.

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/verify'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { isBetaEnabled } from '@/lib/feature-flags'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!isBetaEnabled('jobs')) {
    return NextResponse.json({ error: { message: 'Not found' } }, { status: 404 })
  }

  const auth = await requireAuth(request)
  if (!auth.success) return auth.error!

  const { id } = await ctx.params

  const admin = getSupabaseAdmin()

  // Ownership gate — only the poster can read applications on this job.
  const { data: job } = await admin
    .from('jobs')
    .select('id, poster_id')
    .eq('id', id)
    .maybeSingle()

  if (!job) return NextResponse.json({ error: { message: 'Job not found' } }, { status: 404 })
  if (job.poster_id !== auth.user!.id) {
    return NextResponse.json({ error: { message: 'Only the poster can view applications' } }, { status: 403 })
  }

  const { data, error } = await admin
    .from('job_applications')
    .select(`
      id, status, cover_letter, portfolio_url, resume_url,
      expected_salary_cents, employer_notes, created_at, updated_at,
      applicant:users!job_applications_applicant_id_fkey(
        id, display_name, avatar_url, bio
      )
    `)
    .eq('job_id', id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[jobs] applications list failed:', error)
    return NextResponse.json({ error: { message: 'Failed to load applications' } }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}

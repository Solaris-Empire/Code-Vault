// /api/jobs/[id]
//
// PATCH  — poster edits their listing (fields + status + expiry)
// DELETE — poster removes their listing (cascades to applications)
//
// Both are poster-only. RLS would block anyone else anyway, but we also
// check at the app level so we return a clean 403 instead of a generic
// "no rows affected" swallow.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/verify'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { isBetaEnabled } from '@/lib/feature-flags'

export const dynamic = 'force-dynamic'

// Strict whitelist — poster_id, application_count, view_count, created_at
// etc. are intentionally NOT editable through this endpoint.
const PatchSchema = z
  .object({
    title: z.string().trim().min(3).max(140).optional(),
    companyName: z.string().trim().min(1).max(120).optional(),
    companyWebsite: z.string().url().max(300).nullable().optional(),
    employmentType: z.enum(['full_time', 'part_time', 'contract', 'internship', 'freelance']).optional(),
    location: z.string().trim().max(120).nullable().optional(),
    remote: z.boolean().optional(),
    salaryMinCents: z.number().int().min(0).nullable().optional(),
    salaryMaxCents: z.number().int().min(0).nullable().optional(),
    salaryCurrency: z.string().length(3).toUpperCase().optional(),
    salaryPeriod: z.enum(['hour', 'day', 'week', 'month', 'year']).optional(),
    description: z.string().trim().min(50).max(10_000).optional(),
    requirements: z.string().trim().max(5_000).nullable().optional(),
    benefits: z.string().trim().max(3_000).nullable().optional(),
    skills: z.array(z.string().max(40)).max(20).optional(),
    applyUrl: z.string().url().max(300).nullable().optional(),
    applyEmail: z.string().email().max(200).nullable().optional(),
    // Status transitions the poster is allowed to trigger themselves.
    // 'expired' is reached via the expires_at timestamp, not manually.
    status: z.enum(['active', 'paused', 'filled', 'hidden']).optional(),
  })
  .strict()

function betaGate() {
  if (!isBetaEnabled('jobs')) {
    return NextResponse.json({ error: { message: 'Not found' } }, { status: 404 })
  }
  return null
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = betaGate()
  if (gate) return gate

  const auth = await requireAuth(request)
  if (!auth.success) return auth.error!

  const { id } = await ctx.params

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

  const admin = getSupabaseAdmin()
  const { data: job } = await admin
    .from('jobs')
    .select('id, poster_id')
    .eq('id', id)
    .maybeSingle()

  if (!job) return NextResponse.json({ error: { message: 'Job not found' } }, { status: 404 })
  if (job.poster_id !== auth.user!.id) {
    return NextResponse.json({ error: { message: 'Only the poster can edit this listing' } }, { status: 403 })
  }

  // Salary sanity — same rule as create.
  if (
    input.salaryMinCents !== null && input.salaryMinCents !== undefined &&
    input.salaryMaxCents !== null && input.salaryMaxCents !== undefined &&
    input.salaryMinCents > input.salaryMaxCents
  ) {
    return NextResponse.json(
      { error: { message: 'Salary min cannot be higher than max.' } },
      { status: 400 },
    )
  }

  // Remap camelCase → snake_case, keeping only keys the client sent.
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.title !== undefined) patch.title = input.title
  if (input.companyName !== undefined) patch.company_name = input.companyName
  if (input.companyWebsite !== undefined) patch.company_website = input.companyWebsite
  if (input.employmentType !== undefined) patch.employment_type = input.employmentType
  if (input.location !== undefined) patch.location = input.location
  if (input.remote !== undefined) patch.remote = input.remote
  if (input.salaryMinCents !== undefined) patch.salary_min_cents = input.salaryMinCents
  if (input.salaryMaxCents !== undefined) patch.salary_max_cents = input.salaryMaxCents
  if (input.salaryCurrency !== undefined) patch.salary_currency = input.salaryCurrency
  if (input.salaryPeriod !== undefined) patch.salary_period = input.salaryPeriod
  if (input.description !== undefined) patch.description = input.description
  if (input.requirements !== undefined) patch.requirements = input.requirements
  if (input.benefits !== undefined) patch.benefits = input.benefits
  if (input.applyUrl !== undefined) patch.apply_url = input.applyUrl
  if (input.applyEmail !== undefined) patch.apply_email = input.applyEmail
  if (input.status !== undefined) patch.status = input.status
  if (input.skills !== undefined) {
    patch.skills = input.skills
      .map((s) => s.trim().toLowerCase())
      .filter((s, i, arr) => s.length > 0 && arr.indexOf(s) === i)
      .slice(0, 20)
  }

  const { error: updateErr } = await admin.from('jobs').update(patch).eq('id', id)
  if (updateErr) {
    console.error('[jobs] update failed:', updateErr)
    return NextResponse.json({ error: { message: 'Failed to update job' } }, { status: 500 })
  }

  return NextResponse.json({ data: { ok: true } })
}

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = betaGate()
  if (gate) return gate

  const auth = await requireAuth(request)
  if (!auth.success) return auth.error!

  const { id } = await ctx.params

  const admin = getSupabaseAdmin()
  const { data: job } = await admin
    .from('jobs')
    .select('id, poster_id')
    .eq('id', id)
    .maybeSingle()

  if (!job) return NextResponse.json({ error: { message: 'Job not found' } }, { status: 404 })
  if (job.poster_id !== auth.user!.id) {
    return NextResponse.json({ error: { message: 'Only the poster can delete this listing' } }, { status: 403 })
  }

  // FK ON DELETE CASCADE wipes job_applications too.
  const { error: delErr } = await admin.from('jobs').delete().eq('id', id)
  if (delErr) {
    console.error('[jobs] delete failed:', delErr)
    return NextResponse.json({ error: { message: 'Failed to delete job' } }, { status: 500 })
  }

  return NextResponse.json({ data: { ok: true } })
}

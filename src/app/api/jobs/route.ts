// /api/jobs
//
// GET  — list active jobs (public, paginated, filtered)
// POST — create a new job listing (auth required)

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/verify'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { isBetaEnabled } from '@/lib/feature-flags'
import { checkRateLimit, rateLimitConfigs } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

const CreateSchema = z.object({
  title: z.string().trim().min(3).max(140),
  companyName: z.string().trim().min(1).max(120),
  companyWebsite: z.string().url().max(300).nullable().optional(),
  employmentType: z.enum(['full_time', 'part_time', 'contract', 'internship', 'freelance']),
  location: z.string().trim().max(120).nullable().optional(),
  remote: z.boolean(),
  salaryMinCents: z.number().int().min(0).nullable().optional(),
  salaryMaxCents: z.number().int().min(0).nullable().optional(),
  salaryCurrency: z.string().length(3).toUpperCase().default('USD'),
  salaryPeriod: z.enum(['hour', 'day', 'week', 'month', 'year']).default('year'),
  description: z.string().trim().min(50).max(10000),
  requirements: z.string().trim().max(5000).nullable().optional(),
  benefits: z.string().trim().max(3000).nullable().optional(),
  skills: z.array(z.string().max(40)).max(20).optional(),
  applyUrl: z.string().url().max(300).nullable().optional(),
  applyEmail: z.string().email().max(200).nullable().optional(),
})

function betaGate() {
  if (!isBetaEnabled('jobs')) {
    return NextResponse.json({ error: { message: 'Not found' } }, { status: 404 })
  }
  return null
}

export async function GET(request: NextRequest) {
  const gate = betaGate()
  if (gate) return gate

  const url = new URL(request.url)
  const search   = url.searchParams.get('search')?.trim() || null
  const remoteParam = url.searchParams.get('remote')
  const remote   = remoteParam === 'true' ? true : remoteParam === 'false' ? false : null
  const empType  = url.searchParams.get('type') || null
  const skill    = url.searchParams.get('skill')?.toLowerCase() || null
  const limit    = Math.min(Math.max(Number(url.searchParams.get('limit')) || 30, 1), 100)
  const offset   = Math.max(Number(url.searchParams.get('offset')) || 0, 0)

  const admin = getSupabaseAdmin()
  const { data, error } = await admin.rpc('list_jobs', {
    p_search: search,
    p_remote: remote,
    p_emp_type: empType,
    p_skill: skill,
    p_limit: limit,
    p_offset: offset,
  })

  if (error) {
    console.error('[jobs] list failed:', error)
    return NextResponse.json({ error: { message: 'Failed to load jobs' } }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}

export async function POST(request: NextRequest) {
  const gate = betaGate()
  if (gate) return gate

  // Throttle job creation — stops an attacker (or a buggy client) from
  // flooding the board with thousands of listings in seconds.
  const rl = await checkRateLimit(request, rateLimitConfigs.upload)
  if (!rl.allowed) return rl.error!

  const auth = await requireAuth(request)
  if (!auth.success) return auth.error!

  let input: z.infer<typeof CreateSchema>
  try {
    input = CreateSchema.parse(await request.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: { message: 'Invalid job data', details: err.issues } },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: { message: 'Invalid request body' } }, { status: 400 })
  }

  if (!input.applyUrl && !input.applyEmail) {
    return NextResponse.json(
      { error: { message: 'Provide either an apply URL or apply email.' } },
      { status: 400 },
    )
  }

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

  const skills = (input.skills ?? [])
    .map((s) => s.trim().toLowerCase())
    .filter((s, i, arr) => s.length > 0 && arr.indexOf(s) === i)
    .slice(0, 20)

  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('jobs')
    .insert({
      poster_id: auth.user!.id,
      title: input.title,
      company_name: input.companyName,
      company_website: input.companyWebsite ?? null,
      employment_type: input.employmentType,
      location: input.location ?? null,
      remote: input.remote,
      salary_min_cents: input.salaryMinCents ?? null,
      salary_max_cents: input.salaryMaxCents ?? null,
      salary_currency: input.salaryCurrency,
      salary_period: input.salaryPeriod,
      description: input.description,
      requirements: input.requirements ?? null,
      benefits: input.benefits ?? null,
      skills,
      apply_url: input.applyUrl ?? null,
      apply_email: input.applyEmail ?? null,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[jobs] create failed:', error)
    return NextResponse.json({ error: { message: 'Failed to create job' } }, { status: 500 })
  }

  return NextResponse.json({ data: { id: data.id } })
}

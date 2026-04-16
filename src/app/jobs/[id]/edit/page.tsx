// /jobs/[id]/edit — poster-only edit form.
// Reuses PostJobForm in edit mode so create and update stay in sync.

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient, getSupabaseAdmin } from '@/lib/supabase/server'
import { requireBetaFeature } from '@/lib/feature-flags'
import PostJobForm, { type JobFormInitialValues } from '../../new/post-job-form'
import type { EmploymentType, SalaryPeriod } from '@/lib/jobs/types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Edit job · CodeVault' }

export default async function EditJobPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  requireBetaFeature('jobs')
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?redirectTo=/jobs/${id}/edit`)

  const admin = getSupabaseAdmin()
  const { data: job } = await admin
    .from('jobs')
    .select(`
      id, poster_id, title, company_name, company_website,
      employment_type, location, remote,
      salary_min_cents, salary_max_cents, salary_currency, salary_period,
      description, requirements, benefits, skills,
      apply_url, apply_email
    `)
    .eq('id', id)
    .maybeSingle()

  if (!job) notFound()
  if (job.poster_id !== user.id) notFound()

  const initial: JobFormInitialValues = {
    id: job.id,
    title: job.title,
    companyName: job.company_name,
    companyWebsite: job.company_website,
    employmentType: job.employment_type as EmploymentType,
    location: job.location,
    remote: job.remote,
    salaryMinCents: job.salary_min_cents,
    salaryMaxCents: job.salary_max_cents,
    salaryCurrency: job.salary_currency,
    salaryPeriod: (job.salary_period ?? 'year') as SalaryPeriod,
    description: job.description,
    requirements: job.requirements,
    benefits: job.benefits,
    skills: job.skills ?? [],
    applyUrl: job.apply_url,
    applyEmail: job.apply_email,
  }

  return (
    <div className="min-h-screen bg-(--color-background) text-foreground">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Link
          href={`/jobs/${job.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-(--color-text-secondary) hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to listing
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Edit job</h1>
        <p className="text-(--color-text-secondary) mt-2 text-sm max-w-2xl">
          Updates are live immediately. Applicants who already applied stay
          on the listing.
        </p>
        <div className="mt-6">
          <PostJobForm mode="edit" initial={initial} />
        </div>
      </div>
    </div>
  )
}

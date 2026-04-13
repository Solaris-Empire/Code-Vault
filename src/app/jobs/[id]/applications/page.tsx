// /jobs/[id]/applications — employer's inbox of applicants for a job.
// Loads on the server, hands the list to a client island that lets the
// employer flip status + jot a private note per application.

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient, getSupabaseAdmin } from '@/lib/supabase/server'
import { requireBetaFeature } from '@/lib/feature-flags'
import ApplicationsBoard from './applications-board'

export const dynamic = 'force-dynamic'

export default async function JobApplicationsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  requireBetaFeature('jobs')
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?redirectTo=/jobs/${id}/applications`)

  const admin = getSupabaseAdmin()
  const { data: job } = await admin
    .from('jobs')
    .select('id, poster_id, title, company_name, status, application_count')
    .eq('id', id)
    .maybeSingle()

  if (!job) notFound()
  if (job.poster_id !== user.id) notFound()

  const { data: apps } = await admin
    .from('job_applications')
    .select(`
      id, status, cover_letter, portfolio_url, resume_url,
      expected_salary_cents, employer_notes, created_at,
      applicant:users!job_applications_applicant_id_fkey(
        id, display_name, avatar_url, bio
      )
    `)
    .eq('job_id', id)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-(--color-background) text-foreground">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Link
          href={`/jobs/${job.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-(--color-text-secondary) hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to listing
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Applicants
          </h1>
          <p className="text-sm text-(--color-text-secondary) mt-1">
            {job.title} · {job.company_name} · {job.application_count} total
          </p>
        </div>

        <ApplicationsBoard
          jobId={job.id}
          initialApps={(apps ?? []) as unknown as ApplicationRow[]}
        />
      </div>
    </div>
  )
}

export interface ApplicationRow {
  id: string
  status: 'submitted' | 'reviewed' | 'interviewing' | 'offered' | 'rejected' | 'withdrawn'
  cover_letter: string
  portfolio_url: string | null
  resume_url: string | null
  expected_salary_cents: number | null
  employer_notes: string | null
  created_at: string
  applicant: {
    id: string
    display_name: string | null
    avatar_url: string | null
    bio: string | null
  } | null
}

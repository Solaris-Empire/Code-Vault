// /jobs/[id] — single-job detail + apply button.
//
// Apply flow lives in a client component (ApplyPanel). Employer
// sees "Manage applications" link instead. Non-logged-in visitors
// see an apply CTA that routes through /login first.

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  Briefcase, MapPin, Globe2, Clock, Building2, ExternalLink, ArrowLeft,
} from 'lucide-react'
import { createClient, getSupabaseAdmin } from '@/lib/supabase/server'
import { requireBetaFeature } from '@/lib/feature-flags'
import {
  EMPLOYMENT_TYPE_OPTIONS,
  formatSalaryRange,
} from '@/lib/jobs/types'
import { jobPostingJsonLd, jsonLdScript } from '@/lib/seo/jsonld'
import ApplyPanel from './apply-panel'
import OwnerControls from './owner-controls'
import ReportButton from '@/components/report-button'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const admin = getSupabaseAdmin()
  const { data: job } = await admin
    .from('jobs')
    .select('title, company_name, description, remote, location, employment_type')
    .eq('id', id)
    .eq('status', 'active')
    .maybeSingle()
  if (!job) return { title: 'Job not found' }

  const where = job.remote ? 'Remote' : job.location || 'On-site'
  const summary = job.description.slice(0, 155).trim() + '…'
  return {
    title: `${job.title} at ${job.company_name} (${where})`,
    description: summary,
    openGraph: {
      title: `${job.title} — ${job.company_name}`,
      description: summary,
      type: 'article',
    },
    twitter: {
      card: 'summary',
      title: `${job.title} at ${job.company_name}`,
      description: summary,
    },
    alternates: {
      canonical: `/jobs/${id}`,
    },
  }
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  requireBetaFeature('jobs')
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = getSupabaseAdmin()
  const { data: job } = await admin
    .from('jobs')
    .select(`
      id, poster_id, title, company_name, company_website,
      employment_type, location, remote,
      salary_min_cents, salary_max_cents, salary_currency, salary_period,
      description, requirements, benefits, skills,
      apply_url, apply_email,
      application_count, view_count, status, expires_at, created_at,
      users!jobs_poster_id_fkey (display_name, avatar_url)
    `)
    .eq('id', id)
    .maybeSingle()

  if (!job || (job.status !== 'active' && job.poster_id !== user?.id)) {
    notFound()
  }

  // Has the viewer already applied?
  let viewerApplied = false
  if (user && user.id !== job.poster_id) {
    const { data: existing } = await admin
      .from('job_applications')
      .select('id')
      .eq('job_id', id)
      .eq('applicant_id', user.id)
      .maybeSingle()
    viewerApplied = Boolean(existing)
  }

  // Fire-and-forget view count bump.
  admin
    .from('jobs')
    .update({ view_count: (job.view_count ?? 0) + 1 })
    .eq('id', id)
    .then(() => {})

  const salary = formatSalaryRange(
    job.salary_min_cents,
    job.salary_max_cents,
    job.salary_currency,
    job.salary_period,
  )
  const expired = new Date(job.expires_at) < new Date()
  const isOwner = user?.id === job.poster_id

  const ld = jobPostingJsonLd({
    id: job.id,
    title: job.title,
    description: job.description,
    employmentType: job.employment_type,
    companyName: job.company_name,
    companyWebsite: job.company_website,
    remote: job.remote,
    location: job.location,
    salaryMinCents: job.salary_min_cents,
    salaryMaxCents: job.salary_max_cents,
    salaryCurrency: job.salary_currency,
    salaryPeriod: job.salary_period,
    createdAt: job.created_at,
    expiresAt: job.expires_at,
  })

  return (
    <div className="min-h-screen bg-(--color-background) text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(ld) }}
      />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Link
          href="/jobs"
          className="inline-flex items-center gap-1.5 text-sm text-(--color-text-secondary) hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All jobs
        </Link>

        <div className="border border-(--color-border) bg-(--color-surface) p-6">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 bg-(--color-elevated) flex items-center justify-center shrink-0">
              <Building2 className="h-6 w-6 text-(--color-text-muted)" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{job.title}</h1>
              <p className="text-sm text-(--color-text-secondary) mt-1">
                {job.company_name}
                {job.company_website && (
                  <>
                    {' · '}
                    <a
                      href={job.company_website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-(--brand-primary) hover:underline inline-flex items-center gap-0.5"
                    >
                      website <ExternalLink className="h-3 w-3" />
                    </a>
                  </>
                )}
              </p>
              <div className="flex items-center gap-4 mt-3 text-xs text-(--color-text-muted) flex-wrap">
                {job.remote ? (
                  <span className="inline-flex items-center gap-1">
                    <Globe2 className="h-3 w-3" /> Remote
                  </span>
                ) : job.location ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {job.location}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1">
                  <Briefcase className="h-3 w-3" />
                  {EMPLOYMENT_TYPE_OPTIONS.find((o) => o.value === job.employment_type)?.label}
                </span>
                {salary && (
                  <span className="font-semibold text-(--brand-primary)">{salary}</span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {job.application_count} applicants
                </span>
              </div>
              {job.skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {(job.skills as string[]).map((s) => (
                    <Link
                      key={s}
                      href={`/jobs?skill=${encodeURIComponent(s)}`}
                      className="text-[11px] font-medium uppercase tracking-wider bg-(--color-elevated) text-(--color-text-secondary) hover:text-foreground px-2 py-0.5"
                    >
                      {s}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="mt-6 space-y-6">
            <Section title="About the role" body={job.description} />
            {job.requirements && <Section title="Requirements" body={job.requirements} />}
            {job.benefits && <Section title="Benefits" body={job.benefits} />}
          </div>

          {/* Apply / manage row */}
          <div className="mt-8 pt-6 border-t border-(--color-border)">
            {isOwner ? (
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/jobs/${job.id}/applications`}
                  className="inline-flex items-center gap-1.5 bg-(--brand-primary) text-white text-sm font-semibold px-4 py-2.5 hover:opacity-90"
                >
                  View applicants ({job.application_count})
                </Link>
                <OwnerControls jobId={job.id} status={job.status} />
              </div>
            ) : expired ? (
              <p className="text-sm text-(--color-text-muted)">
                This listing has expired.
              </p>
            ) : !user ? (
              <Link
                href={`/login?redirectTo=/jobs/${job.id}`}
                className="inline-flex items-center gap-1.5 bg-(--brand-primary) text-white text-sm font-semibold px-4 py-2.5 hover:opacity-90"
              >
                Sign in to apply
              </Link>
            ) : (
              <ApplyPanel
                jobId={job.id}
                applyUrl={job.apply_url}
                applyEmail={job.apply_email}
                alreadyApplied={viewerApplied}
              />
            )}
          </div>

          {!isOwner && user && (
            <div className="mt-6 pt-4 border-t border-(--color-border)">
              <ReportButton targetType="job" targetId={job.id} label="Report this job" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-(--color-text-secondary) mb-2">
        {title}
      </h2>
      <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
        {body}
      </div>
    </section>
  )
}

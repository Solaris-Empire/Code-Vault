// /jobs — Tech Jobs Board (Phase 7, beta-gated).
//
// Public list of active roles. Filters: search, remote-only,
// employment type, skill. Rendered server-side so SEO-friendly.

import Link from 'next/link'
import { Briefcase, MapPin, Globe2, Plus, Clock, Building2 } from 'lucide-react'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { requireBetaFeature } from '@/lib/feature-flags'
import {
  EMPLOYMENT_TYPE_OPTIONS,
  formatSalaryRange,
  type JobListRow,
} from '@/lib/jobs/types'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Tech Jobs · CodeVault' }

interface SearchParams {
  search?: string
  remote?: string
  type?: string
  skill?: string
}

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 3600)  return `${Math.max(1, Math.floor(diff / 60))}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  const d = Math.floor(diff / 86400)
  return d < 30 ? `${d}d ago` : `${Math.floor(d / 30)}mo ago`
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  requireBetaFeature('jobs')
  const params = await searchParams

  const search   = params.search?.trim() || null
  const remote   = params.remote === 'true' ? true : params.remote === 'false' ? false : null
  const empType  = params.type || null
  const skill    = params.skill?.toLowerCase() || null

  const admin = getSupabaseAdmin()
  const { data: jobsRaw } = await admin.rpc('list_jobs', {
    p_search: search,
    p_remote: remote,
    p_emp_type: empType,
    p_skill: skill,
    p_limit: 50,
    p_offset: 0,
  })
  const jobs: JobListRow[] = (jobsRaw ?? []) as JobListRow[]

  return (
    <div className="min-h-screen bg-(--color-background) text-foreground">
      <header className="border-b border-(--color-border) bg-(--color-surface)">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 text-xs text-(--color-text-muted) uppercase tracking-[0.18em] mb-2">
                <Briefcase className="h-3.5 w-3.5" />
                Tech Jobs
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                Jobs for the people who build things.
              </h1>
              <p className="text-(--color-text-secondary) mt-2 max-w-2xl">
                Roles posted by employers and teams looking for devs. Apply
                with your CodeVault profile — your rank, shipped products,
                and reviews are the CV.
              </p>
            </div>
            <Link
              href="/jobs/new"
              className="inline-flex items-center gap-1.5 bg-(--brand-amber) text-white text-sm font-semibold px-4 py-2.5 hover:opacity-90 shadow-(--shadow-amber)"
            >
              <Plus className="h-4 w-4" />
              Post a job
            </Link>
          </div>

          {/* Filters */}
          <form
            method="get"
            className="mt-6 grid gap-3 md:grid-cols-[1fr_auto_auto_auto]"
          >
            <input
              type="search"
              name="search"
              defaultValue={search ?? ''}
              placeholder="Search title, company, or keyword…"
              className="bg-(--color-elevated) border border-(--color-border) px-3 py-2 text-sm focus:outline-none focus:border-(--brand-primary)"
            />
            <select
              name="remote"
              defaultValue={params.remote ?? ''}
              className="bg-(--color-elevated) border border-(--color-border) px-3 py-2 text-sm focus:outline-none focus:border-(--brand-primary)"
            >
              <option value="">Any location</option>
              <option value="true">Remote only</option>
              <option value="false">On-site only</option>
            </select>
            <select
              name="type"
              defaultValue={empType ?? ''}
              className="bg-(--color-elevated) border border-(--color-border) px-3 py-2 text-sm focus:outline-none focus:border-(--brand-primary)"
            >
              <option value="">Any type</option>
              {EMPLOYMENT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <button
              type="submit"
              className="bg-(--brand-primary) text-white px-4 py-2 text-sm font-semibold"
            >
              Filter
            </button>
          </form>
          {skill && (
            <div className="mt-3 inline-flex items-center gap-2 bg-(--brand-primary)/10 text-(--brand-primary) px-3 py-1.5 text-xs font-semibold">
              Skill: {skill}
              <Link href="/jobs" className="opacity-70 hover:opacity-100">×</Link>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        {jobs.length === 0 ? (
          <div className="border border-(--color-border) bg-(--color-surface) p-10 text-center">
            <Briefcase className="h-10 w-10 text-(--color-text-muted) mx-auto mb-3" />
            <p className="text-sm text-(--color-text-secondary)">
              No open roles match your filters.
            </p>
            <Link
              href="/jobs/new"
              className="inline-flex items-center gap-1.5 mt-4 bg-(--brand-primary) text-white text-sm font-semibold px-4 py-2"
            >
              <Plus className="h-4 w-4" />
              Post the first one
            </Link>
          </div>
        ) : (
          jobs.map((job) => {
            const salary = formatSalaryRange(
              job.salary_min_cents,
              job.salary_max_cents,
              job.salary_currency,
            )
            return (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="block border border-(--color-border) bg-(--color-surface) p-5 hover:border-(--brand-primary) transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 bg-(--color-elevated) flex items-center justify-center shrink-0">
                    <Building2 className="h-5 w-5 text-(--color-text-muted)" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-semibold text-foreground">{job.title}</h2>
                    <p className="text-sm text-(--color-text-secondary) mt-0.5">
                      {job.company_name}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-(--color-text-muted) flex-wrap">
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
                        <Clock className="h-3 w-3" /> {relativeTime(job.created_at)}
                      </span>
                      <span>·</span>
                      <span>{job.application_count} applicants</span>
                    </div>
                    {job.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {job.skills.slice(0, 8).map((s) => (
                          <span
                            key={s}
                            className="text-[10px] uppercase tracking-wider bg-(--color-elevated) text-(--color-text-secondary) px-1.5 py-0.5"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}

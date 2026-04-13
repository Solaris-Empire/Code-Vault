'use client'

// Applications inbox — client island. Each row is a compact card with
// status selector + collapsible notes. PATCHes go to the app-level
// endpoint; optimistic updates mean the UI reflects the change before
// the server round-trip completes.

import { useState } from 'react'
import Link from 'next/link'
import {
  ChevronDown, ChevronUp, ExternalLink, Loader2, Mail, User as UserIcon,
} from 'lucide-react'
import type { ApplicationRow } from './page'

const STATUS_OPTIONS: { value: ApplicationRow['status']; label: string }[] = [
  { value: 'submitted',    label: 'New' },
  { value: 'reviewed',     label: 'Reviewed' },
  { value: 'interviewing', label: 'Interviewing' },
  { value: 'offered',      label: 'Offered' },
  { value: 'rejected',     label: 'Rejected' },
]

const STATUS_STYLES: Record<ApplicationRow['status'], string> = {
  submitted:    'bg-blue-500/10 text-blue-400 border-blue-500/30',
  reviewed:     'bg-purple-500/10 text-purple-400 border-purple-500/30',
  interviewing: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  offered:      'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  rejected:     'bg-rose-500/10 text-rose-400 border-rose-500/30',
  withdrawn:    'bg-(--color-elevated) text-(--color-text-muted) border-(--color-border)',
}

export default function ApplicationsBoard({
  jobId,
  initialApps,
}: {
  jobId: string
  initialApps: ApplicationRow[]
}) {
  const [apps, setApps] = useState<ApplicationRow[]>(initialApps)

  if (apps.length === 0) {
    return (
      <div className="border border-(--color-border) bg-(--color-surface) p-10 text-center">
        <p className="text-sm text-(--color-text-secondary)">
          No applications yet. Share the listing link to drive applicants.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {apps.map((app) => (
        <ApplicationCard
          key={app.id}
          jobId={jobId}
          app={app}
          onUpdate={(patch) =>
            setApps((prev) => prev.map((a) => (a.id === app.id ? { ...a, ...patch } : a)))
          }
        />
      ))}
    </div>
  )
}

function ApplicationCard({
  jobId,
  app,
  onUpdate,
}: {
  jobId: string
  app: ApplicationRow
  onUpdate: (patch: Partial<ApplicationRow>) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [notes, setNotes] = useState(app.employer_notes ?? '')
  const [savingStatus, setSavingStatus] = useState(false)
  const [savingNotes, setSavingNotes] = useState(false)

  async function patchApp(body: { status?: ApplicationRow['status']; employerNotes?: string | null }) {
    const res = await fetch(`/api/jobs/${jobId}/applications/${app.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => null)
      throw new Error(j?.error?.message ?? 'Update failed')
    }
  }

  async function handleStatus(next: ApplicationRow['status']) {
    if (next === app.status) return
    setSavingStatus(true)
    const prev = app.status
    onUpdate({ status: next }) // optimistic
    try {
      await patchApp({ status: next })
    } catch (e) {
      onUpdate({ status: prev })
      alert(e instanceof Error ? e.message : 'Failed to update status')
    } finally {
      setSavingStatus(false)
    }
  }

  async function handleNotesSave() {
    setSavingNotes(true)
    try {
      await patchApp({ employerNotes: notes.trim() || null })
      onUpdate({ employer_notes: notes.trim() || null })
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save note')
    } finally {
      setSavingNotes(false)
    }
  }

  const salary = app.expected_salary_cents
    ? `$${(app.expected_salary_cents / 100).toLocaleString()}`
    : null

  return (
    <div className="border border-(--color-border) bg-(--color-surface)">
      {/* Header row */}
      <div className="flex items-start gap-3 p-4">
        <div className="h-10 w-10 bg-(--color-elevated) flex items-center justify-center shrink-0 overflow-hidden">
          {app.applicant?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={app.applicant.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <UserIcon className="h-4 w-4 text-(--color-text-muted)" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/u/${app.applicant?.id ?? ''}`}
              className="text-sm font-semibold hover:text-(--brand-primary)"
            >
              {app.applicant?.display_name ?? 'Anonymous'}
            </Link>
            <span
              className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 border ${STATUS_STYLES[app.status]}`}
            >
              {STATUS_OPTIONS.find((o) => o.value === app.status)?.label ?? app.status}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-(--color-text-muted)">
            <span>{new Date(app.created_at).toLocaleDateString()}</span>
            {salary && <span>Expects {salary}</span>}
            {app.resume_url && (
              <a
                href={app.resume_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                Resume <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {app.portfolio_url && (
              <a
                href={app.portfolio_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                Portfolio <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <select
            value={app.status === 'withdrawn' ? 'submitted' : app.status}
            onChange={(e) => handleStatus(e.target.value as ApplicationRow['status'])}
            disabled={savingStatus || app.status === 'withdrawn'}
            className="text-xs bg-(--color-background) border border-(--color-border) px-2 py-1 focus:outline-none focus:border-(--brand-primary)"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {savingStatus && <Loader2 className="h-3.5 w-3.5 animate-spin text-(--color-text-muted)" />}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-(--color-text-muted) hover:text-foreground p-1"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-(--color-border) p-4 space-y-4">
          {app.applicant?.bio && (
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-(--color-text-secondary) mb-1">
                About
              </h3>
              <p className="text-sm whitespace-pre-wrap">{app.applicant.bio}</p>
            </div>
          )}
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-(--color-text-secondary) mb-1">
              Cover letter
            </h3>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{app.cover_letter}</p>
          </div>

          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-(--color-text-secondary) mb-1">
              Private note
            </h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={4000}
              rows={3}
              placeholder="Only you can see this."
              className="w-full bg-(--color-background) border border-(--color-border) px-3 py-2 text-sm focus:outline-none focus:border-(--brand-primary)"
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={handleNotesSave}
                disabled={savingNotes || notes === (app.employer_notes ?? '')}
                className="inline-flex items-center gap-1.5 bg-(--brand-primary) text-white text-xs font-semibold px-3 py-1.5 hover:opacity-90 disabled:opacity-40"
              >
                {savingNotes ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Save note
              </button>
            </div>
          </div>

          <div className="flex gap-2 pt-2 border-t border-(--color-border)">
            {app.applicant?.id && (
              <Link
                href={`/messages?to=${app.applicant.id}`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold border border-(--color-border) px-3 py-1.5 hover:bg-(--color-elevated)"
              >
                <Mail className="h-3 w-3" /> Message
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

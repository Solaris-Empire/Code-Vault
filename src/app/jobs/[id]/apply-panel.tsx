'use client'

// Apply-to-job client island. Shows either the in-app apply form,
// an "already applied" badge, or a pass-through to the employer's
// external apply URL / email.

import { useState } from 'react'
import { Loader2, Check, ExternalLink, Mail } from 'lucide-react'

interface Props {
  jobId: string
  applyUrl: string | null
  applyEmail: string | null
  alreadyApplied: boolean
}

export default function ApplyPanel({
  jobId,
  applyUrl,
  applyEmail,
  alreadyApplied,
}: Props) {
  const [open, setOpen] = useState(false)
  const [coverLetter, setCoverLetter] = useState('')
  const [portfolioUrl, setPortfolioUrl] = useState('')
  const [resumeUrl, setResumeUrl] = useState('')
  const [expectedSalary, setExpectedSalary] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [applied, setApplied] = useState(alreadyApplied)

  const canSubmit = coverLetter.trim().length >= 20 && !submitting

  async function submit() {
    setError(null)
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/jobs/${jobId}/apply`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          coverLetter: coverLetter.trim(),
          portfolioUrl: portfolioUrl.trim() || null,
          resumeUrl: resumeUrl.trim() || null,
          expectedSalaryCents: expectedSalary
            ? Math.round(parseFloat(expectedSalary) * 100)
            : null,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error?.message || 'Failed to apply')
        setSubmitting(false)
        return
      }
      setApplied(true)
      setOpen(false)
      setSubmitting(false)
    } catch {
      setError('Network error. Try again.')
      setSubmitting(false)
    }
  }

  if (applied) {
    return (
      <div className="inline-flex items-center gap-2 bg-green-500/10 text-green-600 px-4 py-2.5 text-sm font-semibold">
        <Check className="h-4 w-4" />
        You've applied. The employer can see your profile.
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 bg-(--brand-primary) text-white text-sm font-semibold px-4 py-2.5 hover:opacity-90"
        >
          {open ? 'Close' : 'Apply with your CodeVault profile'}
        </button>
        {applyUrl && (
          <a
            href={applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 border border-(--color-border) bg-(--color-surface) text-sm px-4 py-2.5 hover:bg-(--color-elevated)"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Apply externally
          </a>
        )}
        {applyEmail && (
          <a
            href={`mailto:${applyEmail}`}
            className="inline-flex items-center gap-1.5 border border-(--color-border) bg-(--color-surface) text-sm px-4 py-2.5 hover:bg-(--color-elevated)"
          >
            <Mail className="h-3.5 w-3.5" />
            Email
          </a>
        )}
      </div>

      {open && (
        <div className="mt-4 border border-(--color-border) bg-(--color-elevated)/40 p-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-(--color-text-secondary) mb-1.5">
              Cover letter *
            </label>
            <textarea
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              rows={6}
              maxLength={4000}
              placeholder="Why you, why this role, what you'd bring…"
              className="w-full bg-(--color-surface) border border-(--color-border) px-3 py-2 text-sm focus:outline-none focus:border-(--brand-primary)"
            />
            <p className="text-[11px] text-(--color-text-muted) mt-1">
              {coverLetter.length}/4000 — min 20 chars
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-(--color-text-secondary) mb-1.5">
                Portfolio URL
              </label>
              <input
                type="url"
                value={portfolioUrl}
                onChange={(e) => setPortfolioUrl(e.target.value)}
                placeholder="https://your-site.com"
                className="w-full bg-(--color-surface) border border-(--color-border) px-3 py-2 text-sm focus:outline-none focus:border-(--brand-primary)"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-(--color-text-secondary) mb-1.5">
                Resume URL
              </label>
              <input
                type="url"
                value={resumeUrl}
                onChange={(e) => setResumeUrl(e.target.value)}
                placeholder="https://.../resume.pdf"
                className="w-full bg-(--color-surface) border border-(--color-border) px-3 py-2 text-sm focus:outline-none focus:border-(--brand-primary)"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-(--color-text-secondary) mb-1.5">
              Expected salary (USD, optional)
            </label>
            <input
              type="number"
              min={0}
              value={expectedSalary}
              onChange={(e) => setExpectedSalary(e.target.value)}
              placeholder="80000"
              className="w-full bg-(--color-surface) border border-(--color-border) px-3 py-2 text-sm focus:outline-none focus:border-(--brand-primary)"
            />
          </div>

          {error && (
            <div className="border border-red-500/40 bg-red-500/10 text-red-600 text-sm p-2">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm hover:bg-(--color-surface)"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!canSubmit}
              className="inline-flex items-center gap-1.5 bg-(--brand-primary) text-white text-sm font-semibold px-4 py-2 hover:opacity-90 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Submit application
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

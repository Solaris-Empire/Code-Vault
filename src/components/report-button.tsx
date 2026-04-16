'use client'

// Universal "Report" button. Drops into any listing page. Opens a
// small popover with a reason dropdown + optional details textarea.
// On success shows a thank-you state so the user knows it landed;
// on 409 gently tells them they already reported it.

import { useState } from 'react'
import { Flag, Loader2, Check } from 'lucide-react'
import { getSecureHeaders } from '@/lib/security/client'
import {
  REPORT_REASON_OPTIONS,
  type ReportTargetType,
  type ReportReason,
} from '@/lib/reports/types'

interface Props {
  targetType: ReportTargetType
  targetId: string
  label?: string
  compact?: boolean
}

export default function ReportButton({ targetType, targetId, label = 'Report', compact }: Props) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<ReportReason>('spam')
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: getSecureHeaders(),
        body: JSON.stringify({
          targetType,
          targetId,
          reason,
          details: details.trim() || null,
        }),
      })
      if (res.status === 401) {
        window.location.href = '/login'
        return
      }
      const json = await res.json()
      if (!res.ok) {
        setError(json.error?.message || 'Could not file report.')
        setSubmitting(false)
        return
      }
      setDone(true)
      setSubmitting(false)
    } catch {
      setError('Network error.')
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-(--color-text-muted)">
        <Check className="h-3 w-3" /> Reported — our team will review.
      </span>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1 text-(--color-text-muted) hover:text-foreground ${
          compact ? 'text-[11px]' : 'text-xs'
        }`}
      >
        <Flag className="h-3 w-3" /> {label}
      </button>
    )
  }

  return (
    <form
      onSubmit={submit}
      className="border border-(--color-border) bg-(--color-surface) p-3 w-full max-w-sm space-y-2"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-(--color-text-secondary)">
          Report this
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-(--color-text-muted) hover:text-foreground"
        >
          Cancel
        </button>
      </div>
      <select
        value={reason}
        onChange={(e) => setReason(e.target.value as ReportReason)}
        className="w-full bg-(--color-background) border border-(--color-border) px-2 py-1.5 text-xs"
      >
        {REPORT_REASON_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <p className="text-[11px] text-(--color-text-muted)">
        {REPORT_REASON_OPTIONS.find((o) => o.value === reason)?.help}
      </p>
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        rows={2}
        maxLength={2000}
        placeholder={reason === 'other' ? 'Add details (required)…' : 'Optional details…'}
        required={reason === 'other'}
        className="w-full bg-(--color-background) border border-(--color-border) px-2 py-1.5 text-xs"
      />
      {error && <p className="text-[11px] text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-(--brand-primary) text-white text-xs font-semibold px-3 py-1.5 disabled:opacity-50 inline-flex items-center justify-center gap-1"
      >
        {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
        Submit report
      </button>
    </form>
  )
}

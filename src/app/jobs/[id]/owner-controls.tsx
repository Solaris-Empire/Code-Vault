'use client'

// Owner-side controls for a job listing: flip status (pause/fill/hide)
// or delete outright. Keeps the surface simple — a fuller edit form can
// come later when the post-a-job page is refactored to a shared
// component that handles both create and edit.

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil, Trash2 } from 'lucide-react'

type JobStatus = 'active' | 'paused' | 'filled' | 'hidden'

const STATUS_LABEL: Record<JobStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  filled: 'Filled',
  hidden: 'Hidden',
}

export default function OwnerControls({
  jobId,
  status,
}: {
  jobId: string
  status: string
}) {
  const router = useRouter()
  const [current, setCurrent] = useState<JobStatus>(
    (['active', 'paused', 'filled', 'hidden'] as const).includes(status as JobStatus)
      ? (status as JobStatus)
      : 'active',
  )
  const [busy, setBusy] = useState(false)

  async function changeStatus(next: JobStatus) {
    if (next === current) return
    setBusy(true)
    const prev = current
    setCurrent(next)
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error?.message ?? 'Update failed')
      }
      router.refresh()
    } catch (e) {
      setCurrent(prev)
      alert(e instanceof Error ? e.message : 'Failed to update status')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this job and all its applications? This cannot be undone.')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error?.message ?? 'Delete failed')
      }
      router.push('/jobs')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete')
      setBusy(false)
    }
  }

  return (
    <>
      <select
        value={current}
        onChange={(e) => changeStatus(e.target.value as JobStatus)}
        disabled={busy}
        className="text-sm bg-(--color-background) border border-(--color-border) px-3 py-2 focus:outline-none focus:border-(--brand-primary)"
      >
        {(Object.keys(STATUS_LABEL) as JobStatus[]).map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>

      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-(--color-text-muted)" />}

      <Link
        href={`/jobs/${jobId}/edit`}
        className="inline-flex items-center gap-1.5 text-sm border border-(--color-border) hover:bg-(--color-elevated) px-3 py-2"
      >
        <Pencil className="h-3.5 w-3.5" /> Edit
      </Link>

      <button
        onClick={handleDelete}
        disabled={busy}
        className="inline-flex items-center gap-1.5 text-sm text-rose-400 border border-rose-500/30 hover:bg-rose-500/10 px-3 py-2 disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" /> Delete
      </button>
    </>
  )
}

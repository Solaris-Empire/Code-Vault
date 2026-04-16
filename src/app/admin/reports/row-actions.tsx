'use client'

// Status-change buttons for one report row. Open → Reviewing → Actioned
// or Dismissed. Admins choose the terminal state; PATCH to
// /api/admin/reports/[id] persists it and refreshes the page.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { getSecureHeaders } from '@/lib/security/client'

const TRANSITIONS: { status: string; label: string; color: string }[] = [
  { status: 'reviewing', label: 'Reviewing', color: 'border-amber-500/40 text-amber-400 hover:bg-amber-500/10' },
  { status: 'actioned',  label: 'Actioned',  color: 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10' },
  { status: 'dismissed', label: 'Dismiss',   color: 'border-gray-500/40 text-gray-400 hover:bg-gray-500/10' },
]

export default function ReportRowActions({
  reportId,
  currentStatus,
}: { reportId: string; currentStatus: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  async function update(status: string) {
    setBusy(status)
    try {
      const res = await fetch(`/api/admin/reports/${reportId}`, {
        method: 'PATCH',
        headers: getSecureHeaders(),
        body: JSON.stringify({ status }),
      })
      if (res.ok) router.refresh()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex gap-1 flex-wrap">
      {TRANSITIONS.filter((t) => t.status !== currentStatus).map((t) => (
        <button
          key={t.status}
          type="button"
          disabled={busy !== null}
          onClick={() => update(t.status)}
          className={`text-[11px] px-2 py-1 border bg-(--color-surface) disabled:opacity-50 ${t.color}`}
        >
          {busy === t.status ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            t.label
          )}
        </button>
      ))}
    </div>
  )
}

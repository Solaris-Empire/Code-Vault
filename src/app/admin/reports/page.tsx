// /admin/reports — moderation queue for all user-filed reports.
//
// Groups by target so repeated reports on the same job/product show
// up as one row with a count badge — that's the real signal (one
// spam report is noise, five is a pattern).

import Link from 'next/link'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { Flag, ExternalLink } from 'lucide-react'
import ReportRowActions from './row-actions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Reports · Admin · CodeVault' }

type ReportRow = {
  id: string
  target_type: string
  target_id: string
  reason: string
  details: string | null
  status: string
  created_at: string
  reporter: { id: string; display_name: string | null; email: string | null } | null
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status = 'open' } = await searchParams
  const admin = getSupabaseAdmin()

  const query = admin
    .from('reports')
    .select(`
      id, target_type, target_id, reason, details, status, created_at,
      reporter:users!reports_reporter_id_fkey (id, display_name, email)
    `)
    .order('created_at', { ascending: false })
    .limit(200)

  const { data } = status === 'all' ? await query : await query.eq('status', status)
  const rows = (data ?? []) as unknown as ReportRow[]

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Flag className="h-5 w-5" /> Reports
          </h1>
          <p className="text-sm text-(--color-text-secondary) mt-1">
            User-filed moderation reports. Open = unreviewed. Actioned = listing
            removed or user warned. Dismissed = no violation found.
          </p>
        </div>
        <StatusFilter current={status} />
      </div>

      {rows.length === 0 ? (
        <div className="border border-(--color-border) bg-(--color-surface) p-8 text-center">
          <p className="text-sm text-(--color-text-muted)">
            No reports at status: {status}.
          </p>
        </div>
      ) : (
        <div className="border border-(--color-border) bg-(--color-surface) divide-y divide-(--color-border)">
          {rows.map((r) => (
            <div key={r.id} className="p-4 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="uppercase tracking-wider font-semibold text-(--color-text-secondary)">
                      {r.target_type}
                    </span>
                    <span className="text-(--color-text-muted)">·</span>
                    <span className="font-semibold text-red-500">{r.reason}</span>
                    <span className="text-(--color-text-muted)">·</span>
                    <span className="text-(--color-text-muted)">
                      {new Date(r.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm mt-1">
                    Reporter:{' '}
                    <span className="text-(--color-text-secondary)">
                      {r.reporter?.display_name || r.reporter?.email || r.reporter?.id}
                    </span>
                  </p>
                  {r.details && (
                    <p className="text-sm text-(--color-text-secondary) mt-1 whitespace-pre-wrap">
                      &ldquo;{r.details}&rdquo;
                    </p>
                  )}
                  <Link
                    href={targetUrl(r.target_type, r.target_id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-(--brand-primary) hover:underline mt-2"
                  >
                    View target <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={r.status} />
                  <ReportRowActions reportId={r.id} currentStatus={r.status} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function targetUrl(type: string, id: string): string {
  switch (type) {
    case 'job':     return `/jobs/${id}`
    case 'product': return `/admin/products?id=${id}`
    case 'user':    return `/admin/users?id=${id}`
    case 'post':    return `/community?post=${id}`
    default:        return `/`
  }
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    open:      'bg-red-500/20 text-red-400 border-red-500/40',
    reviewing: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    actioned:  'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    dismissed: 'bg-gray-500/20 text-gray-400 border-gray-500/40',
  }
  return (
    <span className={`inline-flex items-center border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${colors[status] ?? colors.open}`}>
      {status}
    </span>
  )
}

function StatusFilter({ current }: { current: string }) {
  const statuses = ['open', 'reviewing', 'actioned', 'dismissed', 'all']
  return (
    <div className="flex gap-1">
      {statuses.map((s) => (
        <Link
          key={s}
          href={`/admin/reports?status=${s}`}
          className={`text-xs px-2.5 py-1 border ${
            current === s
              ? 'bg-(--brand-primary) text-white border-(--brand-primary)'
              : 'bg-(--color-surface) text-(--color-text-secondary) border-(--color-border) hover:border-(--brand-primary)'
          }`}
        >
          {s}
        </Link>
      ))}
    </div>
  )
}

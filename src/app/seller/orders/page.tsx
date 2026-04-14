// Seller-side list: incoming service orders (gigs placed on this seller).

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Briefcase, ArrowRight, Zap, Gem } from 'lucide-react'
import { createClient, getSupabaseAdmin } from '@/lib/supabase/server'
import { orderStatusDisplay } from '@/lib/services/status'
import type { ServiceOrderStatus } from '@/lib/services/types'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Incoming Orders | CodeVault' }
export const dynamic = 'force-dynamic'

interface ListRow {
  id: string
  status: ServiceOrderStatus
  amount_cents: number
  seller_payout_cents: number
  created_at: string
  delivery_due_at: string | null
  service: { title: string; slug: string; tier: 'vibe' | 'real' } | null
  buyer: { display_name: string | null } | null
}

export default async function SellerOrdersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/seller/orders')

  const admin = getSupabaseAdmin()
  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
  if (!profile || !['seller', 'admin'].includes(profile.role)) {
    redirect('/register?role=seller')
  }

  const { data } = await admin
    .from('service_orders')
    .select(
      `id, status, amount_cents, seller_payout_cents, created_at, delivery_due_at,
       service:seller_services!service_orders_service_id_fkey(title, slug, tier),
       buyer:users!service_orders_buyer_id_fkey(display_name)`,
    )
    .eq('seller_id', user.id)
    .neq('status', 'awaiting_payment')
    .order('created_at', { ascending: false })
    .limit(100)

  const rows = normalize(data)

  const activeCount = rows.filter((r) =>
    ['in_progress', 'revision_requested', 'delivered'].includes(r.status),
  ).length
  const completedCount = rows.filter((r) => r.status === 'completed').length
  const totalEarnedCents = rows
    .filter((r) => r.status === 'completed')
    .reduce((sum, r) => sum + r.seller_payout_cents, 0)

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Incoming orders</h1>
          <p className="text-(--color-text-secondary) mt-1">Orders placed on your services.</p>
        </div>
        <Link
          href="/seller/services"
          className="inline-flex items-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-none text-sm font-medium"
        >
          Manage services
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Active" value={activeCount.toString()} tone="blue" />
        <StatCard label="Completed" value={completedCount.toString()} tone="green" />
        <StatCard label="Lifetime earnings" value={`$${(totalEarnedCents / 100).toFixed(2)}`} tone="emerald" />
      </div>

      {rows.length === 0 ? (
        <div className="bg-white border border-gray-200 p-12 text-center">
          <Briefcase className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-1">No orders yet</h2>
          <p className="text-(--color-text-secondary) mb-5">
            Publish services to start receiving orders from buyers.
          </p>
          <Link href="/seller/services" className="inline-flex items-center gap-2 btn-primary text-white px-5 py-2.5 text-sm font-medium rounded-none">
            Manage services
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-(--color-text-secondary) font-medium">Service</th>
                  <th className="text-left px-4 py-3 text-(--color-text-secondary) font-medium">Buyer</th>
                  <th className="text-left px-4 py-3 text-(--color-text-secondary) font-medium">Tier</th>
                  <th className="text-left px-4 py-3 text-(--color-text-secondary) font-medium">Status</th>
                  <th className="text-right px-4 py-3 text-(--color-text-secondary) font-medium">You earn</th>
                  <th className="text-right px-4 py-3 text-(--color-text-secondary) font-medium">Placed</th>
                  <th className="text-right px-4 py-3 text-(--color-text-secondary) font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => {
                  const cfg = orderStatusDisplay(r.status)
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900 line-clamp-1">{r.service?.title || 'Service'}</td>
                      <td className="px-4 py-3 text-(--color-text-secondary)">{r.buyer?.display_name || '—'}</td>
                      <td className="px-4 py-3">
                        {r.service?.tier === 'real' ? (
                          <span className="inline-flex items-center gap-1 border border-purple-300 bg-purple-50 text-purple-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                            <Gem className="h-3 w-3" /> Real
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 border border-amber-300 bg-amber-50 text-amber-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                            <Zap className="h-3 w-3" /> Vibe
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cfg.badgeClass}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">${(r.seller_payout_cents / 100).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-(--color-text-secondary)">
                        {new Date(r.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/orders/services/${r.id}`} className="text-green-700 text-xs font-medium hover:underline inline-flex items-center gap-1">
                          Open <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function normalize(raw: unknown): ListRow[] {
  if (!Array.isArray(raw)) return []
  return raw.map((r) => {
    const row = r as Record<string, unknown>
    const service = Array.isArray(row.service) ? row.service[0] : row.service
    const buyer = Array.isArray(row.buyer) ? row.buyer[0] : row.buyer
    return { ...(row as unknown as ListRow), service: (service as ListRow['service']) ?? null, buyer: (buyer as ListRow['buyer']) ?? null }
  })
}

function StatCard({ label, value, tone }: { label: string; value: string; tone: 'blue' | 'green' | 'emerald' }) {
  const toneClass =
    tone === 'blue' ? 'border-blue-200 text-blue-700' :
    tone === 'green' ? 'border-green-200 text-green-700' :
    'border-emerald-200 text-emerald-700'
  return (
    <div className={`bg-white border ${toneClass} p-4`}>
      <p className="text-xs uppercase tracking-wider text-(--color-text-muted) mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  )
}

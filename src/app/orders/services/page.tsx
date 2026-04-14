// Buyer-side list of service orders the current user has placed.

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Briefcase, ArrowRight, Zap, Gem } from 'lucide-react'
import { createClient, getSupabaseAdmin } from '@/lib/supabase/server'
import { orderStatusDisplay } from '@/lib/services/status'
import type { ServiceOrderStatus } from '@/lib/services/types'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'My Service Orders | CodeVault' }
export const dynamic = 'force-dynamic'

interface ListRow {
  id: string
  status: ServiceOrderStatus
  amount_cents: number
  created_at: string
  delivery_due_at: string | null
  service: { title: string; slug: string; tier: 'vibe' | 'real'; thumbnail_url: string | null } | null
  seller: { display_name: string | null } | null
}

export default async function BuyerServiceOrdersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/orders/services')

  const admin = getSupabaseAdmin()
  const { data } = await admin
    .from('service_orders')
    .select(
      `id, status, amount_cents, created_at, delivery_due_at,
       service:seller_services!service_orders_service_id_fkey(title, slug, tier, thumbnail_url),
       seller:users!service_orders_seller_id_fkey(display_name)`,
    )
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  const rows = normalize(data)

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">My service orders</h1>
        <p className="text-(--color-text-secondary) mt-1">Everyone you've hired through CodeVault.</p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No orders yet"
          body="Browse developers for hire and commission your first gig."
          cta={{ label: 'Browse services', href: '/hire' }}
        />
      ) : (
        <OrdersTable rows={rows} perspective="buyer" />
      )}
    </div>
  )
}

function normalize(raw: unknown): ListRow[] {
  if (!Array.isArray(raw)) return []
  return raw.map((r) => {
    const row = r as Record<string, unknown>
    const service = Array.isArray(row.service) ? row.service[0] : row.service
    const seller = Array.isArray(row.seller) ? row.seller[0] : row.seller
    return { ...(row as unknown as ListRow), service: (service as ListRow['service']) ?? null, seller: (seller as ListRow['seller']) ?? null }
  })
}

export function OrdersTable({ rows, perspective }: { rows: ListRow[]; perspective: 'buyer' | 'seller' }) {
  return (
    <div className="bg-white border border-gray-200">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-(--color-text-secondary) font-medium">Service</th>
              <th className="text-left px-4 py-3 text-(--color-text-secondary) font-medium">{perspective === 'buyer' ? 'Seller' : 'Buyer'}</th>
              <th className="text-left px-4 py-3 text-(--color-text-secondary) font-medium">Tier</th>
              <th className="text-left px-4 py-3 text-(--color-text-secondary) font-medium">Status</th>
              <th className="text-right px-4 py-3 text-(--color-text-secondary) font-medium">Amount</th>
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
                  <td className="px-4 py-3 text-(--color-text-secondary)">
                    {perspective === 'buyer' ? (r.seller?.display_name || '—') : (r.seller?.display_name || '—')}
                  </td>
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
                  <td className="px-4 py-3 text-right font-mono">${(r.amount_cents / 100).toFixed(2)}</td>
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
  )
}

function EmptyState({ title, body, cta }: { title: string; body: string; cta: { label: string; href: string } }) {
  return (
    <div className="bg-white border border-gray-200 p-12 text-center">
      <Briefcase className="h-12 w-12 text-gray-300 mx-auto mb-4" />
      <h2 className="text-lg font-semibold mb-1">{title}</h2>
      <p className="text-(--color-text-secondary) mb-5">{body}</p>
      <Link href={cta.href} className="inline-flex items-center gap-2 btn-primary text-white px-5 py-2.5 text-sm font-medium rounded-none">
        {cta.label}
      </Link>
    </div>
  )
}

// Service order detail page — shared for buyer and seller. The UI picks
// which actions to show based on the viewer's role in the order.

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Briefcase, Clock, CheckCircle2 } from 'lucide-react'
import { createClient, getSupabaseAdmin } from '@/lib/supabase/server'
import { orderStatusDisplay } from '@/lib/services/status'
import type {
  ServiceOrderRow, ServiceOrderStatus, ServiceMessageRow,
  ServiceReviewRow, ServiceDisputeRow,
} from '@/lib/services/types'
import OrderDetailClient from './order-detail-client'

export const dynamic = 'force-dynamic'

export default async function ServiceOrderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?redirectTo=${encodeURIComponent(`/orders/services/${id}`)}`)

  const admin = getSupabaseAdmin()
  const { data: orderRaw } = await admin
    .from('service_orders')
    .select(
      `id, service_id, buyer_id, seller_id, amount_cents, platform_fee_cents, seller_payout_cents,
       stripe_payment_id, brief, requirements, delivery_due_at, delivered_at, completed_at, cancelled_at,
       delivery_assets, delivery_note, revision_count, status, created_at, updated_at,
       service:seller_services!service_orders_service_id_fkey(id, title, slug, tier, pricing_model, price_cents, hourly_rate_cents, revisions_included, delivery_days, thumbnail_url),
       buyer:users!service_orders_buyer_id_fkey(id, display_name, avatar_url),
       seller:users!service_orders_seller_id_fkey(id, display_name, avatar_url, seller_tier)`,
    )
    .eq('id', id)
    .maybeSingle()

  if (!orderRaw) notFound()

  const order = normalizeOrder(orderRaw)
  if (order.buyer_id !== user.id && order.seller_id !== user.id) notFound()

  const viewerRole: 'buyer' | 'seller' = order.buyer_id === user.id ? 'buyer' : 'seller'

  const { data: messagesRaw } = await admin
    .from('service_messages')
    .select('id, order_id, sender_id, body, attachments, read_at, created_at')
    .eq('order_id', id)
    .order('created_at', { ascending: true })
    .limit(500)

  const messages = (messagesRaw ?? []) as ServiceMessageRow[]

  // Review + dispute status (drive the review form and dispute modal UX)
  const [{ data: reviewRaw }, { data: disputeRaw }] = await Promise.all([
    admin
      .from('service_reviews')
      .select('id, order_id, service_id, buyer_id, seller_id, rating, comment, created_at, updated_at')
      .eq('order_id', id)
      .maybeSingle(),
    admin
      .from('service_disputes')
      .select('id, order_id, opened_by, reason, evidence, status, admin_notes, resolved_at, created_at, updated_at')
      .eq('order_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  const existingReview = (reviewRaw ?? null) as ServiceReviewRow | null
  const existingDispute = (disputeRaw ?? null) as ServiceDisputeRow | null

  const statusCfg = orderStatusDisplay(order.status)

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <nav className="nav-light sticky top-0 z-40 border-b border-gray-100">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href={viewerRole === 'buyer' ? '/orders/services' : '/seller/orders'}
            className="inline-flex items-center gap-2 text-sm text-(--color-text-secondary) hover:text-green-700"
          >
            <ArrowLeft className="h-4 w-4" /> {viewerRole === 'buyer' ? 'My orders' : 'Incoming orders'}
          </Link>
          <span className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs font-semibold uppercase tracking-wider ${statusCfg.badgeClass}`}>
            {statusCfg.label}
          </span>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center gap-2 text-xs text-(--color-text-muted) mb-2">
            <Briefcase className="h-3.5 w-3.5" />
            <span>Service order · {new Date(order.created_at).toLocaleDateString()}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{order.service?.title || 'Service'}</h1>
          <p className="text-sm text-(--color-text-secondary) mt-1">{statusCfg.description}</p>
        </header>

        {/* Top info strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <InfoCell
            label="Amount"
            value={`$${(order.amount_cents / 100).toFixed(2)}`}
            hint={order.service?.pricing_model === 'hourly' ? 'Hourly block' : 'Fixed price'}
          />
          <InfoCell
            label={viewerRole === 'seller' ? 'You receive' : 'Seller receives'}
            value={`$${(order.seller_payout_cents / 100).toFixed(2)}`}
            hint="After 15% platform fee"
          />
          <InfoCell
            label="Delivery due"
            value={
              order.delivery_due_at
                ? new Date(order.delivery_due_at).toLocaleDateString()
                : order.service?.delivery_days
                  ? `${order.service.delivery_days}d window`
                  : '—'
            }
            hint={order.delivered_at ? `Delivered ${new Date(order.delivered_at).toLocaleDateString()}` : undefined}
          />
          <InfoCell
            label="Revisions"
            value={`${order.revision_count} / ${order.service?.revisions_included ?? 0}`}
            hint={
              order.service?.revisions_included
                ? `${(order.service.revisions_included - order.revision_count)} remaining`
                : undefined
            }
          />
        </div>

        <OrderDetailClient
          orderId={order.id}
          status={order.status}
          viewerRole={viewerRole}
          viewerId={user.id}
          brief={order.brief}
          deliveryNote={order.delivery_note}
          deliveryAssets={order.delivery_assets}
          revisionsRemaining={Math.max(0, (order.service?.revisions_included ?? 0) - order.revision_count)}
          counterparty={{
            id: viewerRole === 'buyer' ? order.seller?.id || order.seller_id : order.buyer?.id || order.buyer_id,
            name:
              viewerRole === 'buyer'
                ? order.seller?.display_name || 'Seller'
                : order.buyer?.display_name || 'Buyer',
            avatarUrl:
              viewerRole === 'buyer'
                ? order.seller?.avatar_url ?? null
                : order.buyer?.avatar_url ?? null,
          }}
          initialMessages={messages}
          existingReview={existingReview}
          existingDispute={existingDispute}
        />

        {/* Completed footer */}
        {order.status === 'completed' && (
          <div className="mt-8 border border-green-200 bg-green-50 p-5 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-green-800">Order complete</p>
              <p className="text-green-700 mt-1">
                {order.completed_at
                  ? `Accepted on ${new Date(order.completed_at).toLocaleString()}.`
                  : 'Funds have been released to the seller.'}
              </p>
            </div>
          </div>
        )}

        {order.status === 'awaiting_payment' && (
          <div className="mt-8 border border-amber-200 bg-amber-50 p-5 flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-amber-800">Awaiting payment</p>
              <p className="text-amber-700 mt-1">
                We're waiting for Stripe to confirm your payment. This usually takes a few seconds.
                Refresh the page in a moment.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoCell({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white border border-gray-200 p-3">
      <p className="text-[10px] uppercase tracking-wider text-(--color-text-muted)">{label}</p>
      <p className="text-lg font-bold text-gray-900 mt-0.5">{value}</p>
      {hint && <p className="text-[11px] text-(--color-text-muted) mt-0.5">{hint}</p>}
    </div>
  )
}

// Supabase joins can come back as arrays; normalize each to a single object.
type OrderRaw = Record<string, unknown>
type ServiceJoin = {
  id: string; title: string; slug: string; tier: 'vibe' | 'real';
  pricing_model: 'fixed' | 'hourly'; price_cents: number; hourly_rate_cents: number | null;
  revisions_included: number; delivery_days: number; thumbnail_url: string | null;
}
type UserJoin = { id: string; display_name: string | null; avatar_url: string | null; seller_tier?: string | null }

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null
  return v ?? null
}

function normalizeOrder(raw: OrderRaw): ServiceOrderRow & {
  status: ServiceOrderStatus
  service: ServiceJoin | null
  buyer: UserJoin | null
  seller: (UserJoin & { seller_tier: string | null }) | null
} {
  return {
    ...(raw as unknown as ServiceOrderRow),
    service: pickOne(raw.service as ServiceJoin | ServiceJoin[] | null),
    buyer: pickOne(raw.buyer as UserJoin | UserJoin[] | null),
    seller: pickOne(raw.seller as (UserJoin & { seller_tier: string | null }) | (UserJoin & { seller_tier: string | null })[] | null),
  }
}

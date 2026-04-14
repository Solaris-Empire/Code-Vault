// POST /api/services/orders/:id/accept
// Buyer accepts the delivery. delivered → completed. Escrow releases
// automatically via Stripe Connect transfer_data on the original payment.

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/verify'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { awardSellerXp, XP_REWARDS } from '@/lib/seller/rank'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await requireAuth(request)
  if (!auth.success) return auth.error!

  const admin = getSupabaseAdmin()
  const { data: order } = await admin
    .from('service_orders')
    .select('id, buyer_id, seller_id, status, delivery_due_at, delivered_at')
    .eq('id', id)
    .maybeSingle()

  if (!order) return NextResponse.json({ error: { message: 'Order not found' } }, { status: 404 })
  if (order.buyer_id !== auth.user!.id) {
    return NextResponse.json({ error: { message: 'Only the buyer can accept' } }, { status: 403 })
  }
  if (order.status !== 'delivered') {
    return NextResponse.json(
      { error: { message: `Cannot accept from status "${order.status}"` } },
      { status: 400 },
    )
  }

  const { error: updateErr } = await admin
    .from('service_orders')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', id)

  if (updateErr) {
    return NextResponse.json({ error: { message: 'Failed to accept' } }, { status: 500 })
  }

  await admin.from('service_messages').insert({
    order_id: id,
    sender_id: auth.user!.id,
    body: 'Buyer accepted the delivery. Funds released.',
  })

  // Fire-and-forget XP: never block order completion on a rank update.
  // +50 for completion, +25 bonus if delivered on-time (before due_at).
  const onTime =
    order.delivery_due_at && order.delivered_at
      ? new Date(order.delivered_at) <= new Date(order.delivery_due_at)
      : false
  const xp = XP_REWARDS.ORDER_COMPLETED + (onTime ? XP_REWARDS.ON_TIME_DELIVERY : 0)
  awardSellerXp({
    sellerId: order.seller_id,
    eventType: 'order_completed',
    xpDelta: xp,
    dedupKey: `service_order:${id}:completed`,
    sourceTable: 'service_orders',
    sourceId: id,
    metadata: { on_time: onTime },
  }).catch(() => {})

  // Move the buyer up the Explorer→Patron ladder on this completed order.
  try {
    await admin.rpc('recompute_buyer_tier', { p_buyer_id: order.buyer_id })
  } catch {
    // Fire-and-forget — never block order acceptance on a tier recompute.
  }

  return NextResponse.json({ data: { ok: true } })
}

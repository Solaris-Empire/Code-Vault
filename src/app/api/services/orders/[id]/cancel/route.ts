// POST /api/services/orders/:id/cancel
// Either participant may cancel, but only from awaiting_payment (no charge yet)
// or in_progress (before delivery). Disputes for delivered work go through a
// separate /dispute endpoint in Phase 4.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/verify'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/client'

export const dynamic = 'force-dynamic'

const CancelSchema = z.object({
  reason: z.string().trim().min(5).max(1_000).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await requireAuth(request)
  if (!auth.success) return auth.error!

  let input: z.infer<typeof CancelSchema> = {}
  try {
    input = CancelSchema.parse(await request.json().catch(() => ({})))
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: { message: 'Invalid request', details: err.issues } },
        { status: 400 },
      )
    }
  }

  const admin = getSupabaseAdmin()
  const { data: order } = await admin
    .from('service_orders')
    .select('id, buyer_id, seller_id, status, stripe_payment_id')
    .eq('id', id)
    .maybeSingle()

  if (!order) return NextResponse.json({ error: { message: 'Order not found' } }, { status: 404 })
  if (order.buyer_id !== auth.user!.id && order.seller_id !== auth.user!.id) {
    return NextResponse.json({ error: { message: 'Forbidden' } }, { status: 403 })
  }
  if (!['awaiting_payment', 'in_progress'].includes(order.status)) {
    return NextResponse.json(
      { error: { message: `Cannot cancel from status "${order.status}"` } },
      { status: 400 },
    )
  }

  // If the buyer has already paid, cancellation requires refunding the
  // buyer AND reversing the Connect transfer so the seller can't keep
  // the money for work that was never delivered. reverse_transfer=true
  // pulls the funds back from the connected seller account atomically.
  if (order.status === 'in_progress' && order.stripe_payment_id) {
    try {
      await getStripe().refunds.create({
        payment_intent: order.stripe_payment_id,
        reverse_transfer: true,
        refund_application_fee: true,
        metadata: {
          serviceOrderId: order.id,
          cancelledBy: auth.user!.id,
          reason: input.reason ?? 'cancelled_before_delivery',
        },
      })
    } catch (err) {
      console.error('Stripe refund on cancel failed:', err)
      return NextResponse.json(
        { error: { message: 'Failed to refund. Contact support.' } },
        { status: 500 },
      )
    }
    // Do NOT mark cancelled here — the webhook `charge.refunded` handler
    // will flip status when Stripe confirms. This keeps DB + Stripe in lockstep.
    return NextResponse.json({ data: { ok: true, refunding: true } })
  }

  // awaiting_payment: no charge to refund, flip immediately.
  const { error: updateErr } = await admin
    .from('service_orders')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', id)

  if (updateErr) {
    return NextResponse.json({ error: { message: 'Failed to cancel' } }, { status: 500 })
  }

  await admin.from('service_messages').insert({
    order_id: id,
    sender_id: auth.user!.id,
    body: input.reason ? `Order cancelled: ${input.reason}` : 'Order cancelled.',
  })

  return NextResponse.json({ data: { ok: true } })
}

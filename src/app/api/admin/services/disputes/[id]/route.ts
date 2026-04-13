// PATCH /api/admin/services/disputes/[id]
//
// Admin-only resolution for a service dispute. Before this endpoint, a
// dispute opened by either participant flipped the order to 'disputed'
// and there was no way to close it — the order was stuck forever and
// the money was frozen on Stripe (seller could not be paid, buyer could
// not be refunded).
//
// Decisions:
//   resolve_buyer  — buyer wins. Refund + reverse the Connect transfer
//                    so seller loses the payout. Order → 'cancelled'.
//   resolve_seller — seller wins. Order → 'completed'. No money moves;
//                    the original Connect transfer stands.
//   needs_info     — admin wants more evidence. Order stays 'disputed'.
//   cancel         — dispute was opened in bad faith or by mistake.
//                    Order → 'in_progress' so the workflow can resume.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/verify'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/client'

export const dynamic = 'force-dynamic'

const ResolveSchema = z.object({
  decision: z.enum(['resolve_buyer', 'resolve_seller', 'needs_info', 'cancel']),
  admin_notes: z.string().trim().max(5000).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await requireAuth(request)
  if (!auth.success) return auth.error!

  const admin = getSupabaseAdmin()

  // Admin check.
  const { data: me } = await admin
    .from('users')
    .select('role')
    .eq('id', auth.user!.id)
    .maybeSingle()
  if (me?.role !== 'admin') {
    return NextResponse.json({ error: { message: 'Forbidden' } }, { status: 403 })
  }

  const parsed = ResolveSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: 'Invalid resolution payload', issues: parsed.error.issues } },
      { status: 400 },
    )
  }
  const { decision, admin_notes } = parsed.data

  const { data: dispute } = await admin
    .from('service_disputes')
    .select('id, order_id, status')
    .eq('id', id)
    .maybeSingle()

  if (!dispute) {
    return NextResponse.json({ error: { message: 'Dispute not found' } }, { status: 404 })
  }
  if (dispute.status !== 'open' && dispute.status !== 'needs_info') {
    return NextResponse.json(
      { error: { message: `Dispute already resolved (${dispute.status})` } },
      { status: 409 },
    )
  }

  const { data: order } = await admin
    .from('service_orders')
    .select('id, buyer_id, seller_id, status, stripe_payment_id, amount_cents')
    .eq('id', dispute.order_id)
    .maybeSingle()
  if (!order) {
    return NextResponse.json({ error: { message: 'Order not found' } }, { status: 404 })
  }

  const nowIso = new Date().toISOString()

  if (decision === 'needs_info') {
    await admin
      .from('service_disputes')
      .update({ status: 'needs_info', admin_notes: admin_notes ?? null })
      .eq('id', id)
    return NextResponse.json({ data: { ok: true, status: 'needs_info' } })
  }

  if (decision === 'cancel') {
    // Admin closing the dispute without a winner. Put the order back
    // where the participants can continue.
    await admin
      .from('service_disputes')
      .update({ status: 'cancelled', admin_notes: admin_notes ?? null, resolved_at: nowIso })
      .eq('id', id)
    await admin.from('service_orders').update({ status: 'in_progress' }).eq('id', order.id)
    await admin.from('service_messages').insert({
      order_id: order.id,
      sender_id: auth.user!.id,
      body: 'Admin closed the dispute. Order resumed.',
    })
    return NextResponse.json({ data: { ok: true, status: 'cancelled' } })
  }

  if (decision === 'resolve_seller') {
    // Seller wins — order completes, money already moved at checkout
    // time via transfer_data, so nothing more to do on Stripe.
    await admin
      .from('service_disputes')
      .update({
        status: 'resolved_seller',
        admin_notes: admin_notes ?? null,
        resolved_at: nowIso,
      })
      .eq('id', id)
    await admin
      .from('service_orders')
      .update({ status: 'completed', completed_at: nowIso })
      .eq('id', order.id)
    await admin.from('service_messages').insert({
      order_id: order.id,
      sender_id: auth.user!.id,
      body: 'Admin resolved the dispute in favor of the seller. Order completed.',
    })
    return NextResponse.json({ data: { ok: true, status: 'resolved_seller' } })
  }

  // decision === 'resolve_buyer'
  // Full refund + reverse the Connect transfer. We let the webhook
  // `charge.refunded` handler flip the order to 'cancelled' once Stripe
  // confirms, to keep DB and Stripe in lockstep.
  if (!order.stripe_payment_id) {
    // Order never got paid — treat as a straight cancel.
    await admin
      .from('service_disputes')
      .update({
        status: 'resolved_buyer',
        admin_notes: admin_notes ?? null,
        resolved_at: nowIso,
      })
      .eq('id', id)
    await admin
      .from('service_orders')
      .update({ status: 'cancelled', cancelled_at: nowIso })
      .eq('id', order.id)
    return NextResponse.json({ data: { ok: true, status: 'resolved_buyer' } })
  }

  try {
    await getStripe().refunds.create({
      payment_intent: order.stripe_payment_id,
      reverse_transfer: true,
      refund_application_fee: true,
      metadata: {
        serviceOrderId: order.id,
        disputeId: dispute.id,
        resolvedBy: auth.user!.id,
      },
    })
  } catch (err) {
    console.error('Stripe refund on dispute resolution failed:', err)
    return NextResponse.json(
      { error: { message: 'Failed to refund via Stripe. Dispute left open.' } },
      { status: 500 },
    )
  }

  await admin
    .from('service_disputes')
    .update({
      status: 'resolved_buyer',
      admin_notes: admin_notes ?? null,
      resolved_at: nowIso,
    })
    .eq('id', id)

  // Post a message; order.status flip happens via webhook.
  await admin.from('service_messages').insert({
    order_id: order.id,
    sender_id: auth.user!.id,
    body: 'Admin resolved the dispute in favor of the buyer. Refund in progress.',
  })

  return NextResponse.json({ data: { ok: true, status: 'resolved_buyer', refunding: true } })
}

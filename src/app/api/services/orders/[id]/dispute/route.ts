// POST /api/services/orders/:id/dispute
// Either participant opens a dispute. Flips the order to 'disputed' so no
// further automatic status transitions happen — admin review required.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/verify'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { ServiceDisputeSchema } from '@/lib/services/validation'
import { checkRateLimit, rateLimitConfigs } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

const DISPUTABLE_STATUSES = ['in_progress', 'delivered', 'revision_requested']

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Strict throttle — opening disputes is a heavy admin-touching action.
  const rl = await checkRateLimit(request, rateLimitConfigs.sensitive)
  if (!rl.allowed) return rl.error!

  const { id } = await params
  const auth = await requireAuth(request)
  if (!auth.success) return auth.error!

  let input: z.infer<typeof ServiceDisputeSchema>
  try {
    input = ServiceDisputeSchema.parse(await request.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: { message: 'Invalid request', details: err.issues } },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: { message: 'Invalid request body' } }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  const { data: order } = await admin
    .from('service_orders')
    .select('id, buyer_id, seller_id, status')
    .eq('id', id)
    .maybeSingle()

  if (!order) return NextResponse.json({ error: { message: 'Order not found' } }, { status: 404 })
  if (order.buyer_id !== auth.user!.id && order.seller_id !== auth.user!.id) {
    return NextResponse.json({ error: { message: 'Forbidden' } }, { status: 403 })
  }
  if (!DISPUTABLE_STATUSES.includes(order.status)) {
    return NextResponse.json(
      { error: { message: `Cannot dispute from status "${order.status}"` } },
      { status: 400 },
    )
  }

  const { data: existing } = await admin
    .from('service_disputes')
    .select('id, status')
    .eq('order_id', id)
    .in('status', ['open', 'needs_info'])
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: { message: 'A dispute is already open on this order' } },
      { status: 409 },
    )
  }

  const { data: dispute, error: disputeErr } = await admin
    .from('service_disputes')
    .insert({
      order_id: id,
      opened_by: auth.user!.id,
      reason: input.reason.trim(),
      evidence: input.evidence ?? [],
    })
    .select()
    .single()

  if (disputeErr) {
    console.error('service_disputes insert failed:', disputeErr)
    return NextResponse.json({ error: { message: 'Failed to open dispute' } }, { status: 500 })
  }

  // Flip the order status. If the underlying row update fails we leave the
  // dispute in place — admin can reconcile.
  await admin.from('service_orders').update({ status: 'disputed' }).eq('id', id)

  await admin.from('service_messages').insert({
    order_id: id,
    sender_id: auth.user!.id,
    body: `Dispute opened: ${input.reason.trim()}`,
  })

  return NextResponse.json({ data: dispute })
}

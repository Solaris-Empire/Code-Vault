// POST /api/services/orders/:id/revise
// Buyer requests a revision. delivered → revision_requested.
// Caps enforced by seller_services.revisions_included.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/verify'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const ReviseSchema = z.object({
  note: z.string().trim().min(10).max(2_000),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await requireAuth(request)
  if (!auth.success) return auth.error!

  let input: z.infer<typeof ReviseSchema>
  try {
    input = ReviseSchema.parse(await request.json())
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
    .select('id, buyer_id, service_id, status, revision_count, revisions_included_snapshot')
    .eq('id', id)
    .maybeSingle()

  if (!order) return NextResponse.json({ error: { message: 'Order not found' } }, { status: 404 })
  if (order.buyer_id !== auth.user!.id) {
    return NextResponse.json({ error: { message: 'Only the buyer can request revisions' } }, { status: 403 })
  }
  if (order.status !== 'delivered') {
    return NextResponse.json(
      { error: { message: `Cannot request a revision from status "${order.status}"` } },
      { status: 400 },
    )
  }

  // Use the snapshot taken at order-creation time, NOT the current
  // seller_services.revisions_included value. Otherwise a seller could
  // raise the cap mid-order to grant themselves more revisions, or lower
  // it to block the buyer.
  const allowed = order.revisions_included_snapshot ?? 0
  if (order.revision_count >= allowed) {
    return NextResponse.json(
      { error: { message: `This service includes ${allowed} revision(s). You've used them all.` } },
      { status: 400 },
    )
  }

  const { error: updateErr } = await admin
    .from('service_orders')
    .update({
      status: 'revision_requested',
      revision_count: (order.revision_count || 0) + 1,
    })
    .eq('id', id)

  if (updateErr) {
    return NextResponse.json({ error: { message: 'Failed to request revision' } }, { status: 500 })
  }

  await admin.from('service_messages').insert({
    order_id: id,
    sender_id: auth.user!.id,
    body: `Revision requested: ${input.note}`,
  })

  return NextResponse.json({ data: { ok: true } })
}

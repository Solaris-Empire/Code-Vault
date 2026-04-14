// GET  /api/services/orders/:id/messages — list thread for this order
// POST /api/services/orders/:id/messages — send a message
// Only the order's buyer or seller may read or post.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/verify'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { ServiceMessageSchema } from '@/lib/services/validation'

export const dynamic = 'force-dynamic'

async function assertParticipant(orderId: string, userId: string) {
  const admin = getSupabaseAdmin()
  const { data: order } = await admin
    .from('service_orders')
    .select('id, buyer_id, seller_id')
    .eq('id', orderId)
    .maybeSingle()

  if (!order) return { ok: false as const, status: 404, message: 'Order not found' }
  if (order.buyer_id !== userId && order.seller_id !== userId) {
    return { ok: false as const, status: 403, message: 'Forbidden' }
  }
  return { ok: true as const, order }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await requireAuth(request)
  if (!auth.success) return auth.error!

  const guard = await assertParticipant(id, auth.user!.id)
  if (!guard.ok) return NextResponse.json({ error: { message: guard.message } }, { status: guard.status })

  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('service_messages')
    .select('id, order_id, sender_id, body, attachments, read_at, created_at')
    .eq('order_id', id)
    .order('created_at', { ascending: true })
    .limit(500)

  if (error) {
    return NextResponse.json({ error: { message: 'Failed to load messages' } }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await requireAuth(request)
  if (!auth.success) return auth.error!

  let input: z.infer<typeof ServiceMessageSchema>
  try {
    input = ServiceMessageSchema.parse(await request.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: { message: 'Invalid request', details: err.issues } },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: { message: 'Invalid request body' } }, { status: 400 })
  }

  const guard = await assertParticipant(id, auth.user!.id)
  if (!guard.ok) return NextResponse.json({ error: { message: guard.message } }, { status: guard.status })

  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('service_messages')
    .insert({
      order_id: id,
      sender_id: auth.user!.id,
      body: input.body.trim(),
      attachments: input.attachments || [],
    })
    .select('id, order_id, sender_id, body, attachments, read_at, created_at')
    .single()

  if (error || !data) {
    console.error('service_messages insert failed:', error)
    return NextResponse.json({ error: { message: 'Failed to send message' } }, { status: 500 })
  }

  return NextResponse.json({ data })
}

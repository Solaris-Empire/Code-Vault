// POST /api/services/orders/:id/review
// Buyer submits a review after the order is completed. Unique per order.
// Trigger tg_service_reviews_rollup keeps seller_services.avg_rating fresh.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/verify'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { ServiceReviewSchema } from '@/lib/services/validation'
import { awardSellerXp, XP_REWARDS } from '@/lib/seller/rank'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await requireAuth(request)
  if (!auth.success) return auth.error!

  let input: z.infer<typeof ServiceReviewSchema>
  try {
    input = ServiceReviewSchema.parse(await request.json())
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
    .select('id, service_id, buyer_id, seller_id, status')
    .eq('id', id)
    .maybeSingle()

  if (!order) return NextResponse.json({ error: { message: 'Order not found' } }, { status: 404 })
  if (order.buyer_id !== auth.user!.id) {
    return NextResponse.json({ error: { message: 'Only the buyer can review' } }, { status: 403 })
  }
  if (order.status !== 'completed') {
    return NextResponse.json(
      { error: { message: 'You can only review completed orders' } },
      { status: 400 },
    )
  }

  // Skip the pre-check SELECT — two tabs clicking "Submit" milliseconds
  // apart can both pass it. Rely on the UNIQUE(order_id) constraint on
  // service_reviews and translate the 23505 unique_violation to a clean
  // 409 for the second writer.
  const { data: review, error } = await admin
    .from('service_reviews')
    .insert({
      order_id: id,
      service_id: order.service_id,
      buyer_id: order.buyer_id,
      seller_id: order.seller_id,
      rating: input.rating,
      comment: input.comment?.trim() || null,
    })
    .select()
    .single()

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json(
        { error: { message: 'You have already reviewed this order' } },
        { status: 409 },
      )
    }
    console.error('service_reviews insert failed:', error)
    return NextResponse.json({ error: { message: 'Failed to submit review' } }, { status: 500 })
  }

  // Reward the seller. Every review = base XP; 5-star = bonus XP.
  // Fire-and-forget so a flaky rank update never blocks the review write.
  if (input.rating >= 5) {
    awardSellerXp({
      sellerId: order.seller_id,
      eventType: 'five_star',
      xpDelta: XP_REWARDS.FIVE_STAR_REVIEW,
      dedupKey: `service_review:${review.id}:five_star`,
      sourceTable: 'service_reviews',
      sourceId: review.id,
      metadata: { rating: input.rating },
    }).catch(() => {})
  }

  return NextResponse.json({ data: review })
}

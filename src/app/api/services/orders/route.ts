// POST /api/services/orders
// Buyer-initiated service hire. Creates a pending service_order row,
// opens a Stripe Checkout session, and on webhook confirmation flips
// the order to 'in_progress' with delivery_due_at set.
//
// Payment model: Stripe Checkout (mode=payment). Funds are held by the
// platform, then paid out to the seller via Stripe Connect on completion.
// For now we release via application_fee_amount + transfer_data (same as
// products). Dispute/escrow release logic lives in the webhook + status
// transition endpoints (Phase 3C).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import Stripe from 'stripe'
import { requireAuth } from '@/lib/auth/verify'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/client'
import { CreateServiceOrderSchema } from '@/lib/services/validation'
import { computeFixedSplit, computeHourlySplit } from '@/lib/services/pricing'
import type { SellerServiceRow } from '@/lib/services/types'
import { checkRateLimit, rateLimitConfigs } from '@/lib/security/rate-limit'
import { captureError } from '@/lib/error-tracking'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  // Throttle order creation to prevent runaway draft rows from a buggy
  // client or scripted abuse.
  const rl = await checkRateLimit(request, rateLimitConfigs.order)
  if (!rl.allowed) return rl.error!

  const auth = await requireAuth(request)
  if (!auth.success) return auth.error!

  let body: z.infer<typeof CreateServiceOrderSchema>
  try {
    body = CreateServiceOrderSchema.parse(await request.json())
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

  const { data: service } = await admin
    .from('seller_services')
    .select('id, seller_id, tier, title, slug, pricing_model, price_cents, hourly_rate_cents, min_hours, delivery_days, revisions_included, status')
    .eq('id', body.serviceId)
    .maybeSingle()

  if (!service) {
    return NextResponse.json({ error: { message: 'Service not found' } }, { status: 404 })
  }
  const svc = service as Pick<
    SellerServiceRow,
    'id' | 'seller_id' | 'tier' | 'title' | 'slug' | 'pricing_model' | 'price_cents' |
    'hourly_rate_cents' | 'min_hours' | 'delivery_days' | 'revisions_included' | 'status'
  >

  if (svc.status !== 'approved') {
    return NextResponse.json({ error: { message: 'This service is not available for hire' } }, { status: 400 })
  }

  if (svc.seller_id === auth.user!.id) {
    return NextResponse.json({ error: { message: 'You cannot hire yourself' } }, { status: 400 })
  }

  // Compute final amount.
  let breakdown
  if (svc.pricing_model === 'hourly') {
    const hours = body.hours ?? svc.min_hours ?? 1
    if (svc.min_hours && hours < svc.min_hours) {
      return NextResponse.json(
        { error: { message: `Minimum ${svc.min_hours} hours required` } },
        { status: 400 },
      )
    }
    breakdown = computeHourlySplit(svc.hourly_rate_cents || 0, hours)
  } else {
    breakdown = computeFixedSplit(svc.price_cents)
  }

  if (breakdown.amountCents < 500) {
    return NextResponse.json({ error: { message: 'Order total is below the $5 minimum' } }, { status: 400 })
  }

  // Look up seller's Stripe Connect status (for split payment).
  const { data: seller } = await admin
    .from('users')
    .select('stripe_account_id, stripe_onboarding_complete')
    .eq('id', svc.seller_id)
    .single()

  // Create the order row first (awaiting_payment). This gives us a stable ID
  // to stamp into Stripe metadata, so the webhook can look it up deterministically.
  const { data: orderRow, error: orderErr } = await admin
    .from('service_orders')
    .insert({
      service_id: svc.id,
      buyer_id: auth.user!.id,
      seller_id: svc.seller_id,
      amount_cents: breakdown.amountCents,
      platform_fee_cents: breakdown.platformFeeCents,
      seller_payout_cents: breakdown.sellerPayoutCents,
      brief: body.brief.trim(),
      requirements: body.requirements || {},
      status: 'awaiting_payment',
      // Snapshot the revisions cap at order-creation time so a later edit
      // to seller_services.revisions_included can't change the rules
      // retroactively for an in-flight order.
      revisions_included_snapshot: svc.revisions_included ?? 1,
      // Same for delivery_days — lock in the turnaround the buyer agreed
      // to so the webhook can't stamp a shorter deadline if the seller
      // edits the listing between checkout and payment capture.
      delivery_days_snapshot: svc.delivery_days ?? 7,
    })
    .select('id')
    .single()

  if (orderErr || !orderRow) {
    captureError(orderErr instanceof Error ? orderErr : new Error(String(orderErr)), {
      context: 'api:services:orders:insert',
      extra: { serviceId: svc.id, buyerId: auth.user!.id },
    })
    return NextResponse.json({ error: { message: 'Failed to create order' } }, { status: 500 })
  }

  const stripe = getStripe()
  const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const sessionConfig: Record<string, unknown> = {
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: svc.title,
            description:
              svc.pricing_model === 'hourly'
                ? `${svc.title} — hourly engagement`
                : `${svc.title} — fixed-price gig`,
          },
          unit_amount: breakdown.amountCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      orderType: 'service',
      serviceOrderId: orderRow.id,
      serviceId: svc.id,
      buyerId: auth.user!.id,
      sellerId: svc.seller_id,
    },
    success_url: `${origin}/orders/services/${orderRow.id}?status=success`,
    cancel_url: `${origin}/hire/${svc.slug}?cancelled=1`,
  }

  if (seller?.stripe_account_id && seller.stripe_onboarding_complete) {
    sessionConfig.payment_intent_data = {
      application_fee_amount: breakdown.platformFeeCents,
      transfer_data: { destination: seller.stripe_account_id },
    }
  }

  try {
    const session = await stripe.checkout.sessions.create(
      sessionConfig as Stripe.Checkout.SessionCreateParams,
    )

    return NextResponse.json({
      data: { orderId: orderRow.id, sessionId: session.id, url: session.url },
    })
  } catch (err) {
    captureError(err instanceof Error ? err : new Error(String(err)), {
      context: 'api:services:orders:stripe-session',
      extra: { orderId: orderRow.id },
    })
    // Best-effort cleanup of the unpaid row so the buyer can retry cleanly.
    await admin.from('service_orders').delete().eq('id', orderRow.id)
    return NextResponse.json(
      { error: { message: 'Failed to create checkout session' } },
      { status: 500 },
    )
  }
}

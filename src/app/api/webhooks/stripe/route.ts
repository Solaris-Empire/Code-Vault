import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getStripe } from '@/lib/stripe/client'
import { createClient } from '@supabase/supabase-js'
import { captureError } from '@/lib/error-tracking'
import { recomputeSellerTier } from '@/lib/seller/tier'
import { awardSellerXp, XP_REWARDS } from '@/lib/seller/rank'
import crypto from 'crypto'

const PLATFORM_FEE_PERCENT = 15

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  const secrets = [
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_WEBHOOK_SECRET_ACCOUNT,
  ].filter(Boolean) as string[]

  if (secrets.length === 0) {
    captureError('No STRIPE_WEBHOOK_SECRET configured', { context: 'webhook:stripe', level: 'fatal' })
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  let event: Stripe.Event | null = null

  for (const secret of secrets) {
    try {
      event = getStripe().webhooks.constructEvent(body, signature, secret)
      break
    } catch {
      // Try next secret
    }
  }

  if (!event) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.payment_status === 'paid' && isCodeVaultSession(session)) {
          if (session.metadata?.orderType === 'service') {
            await handleSuccessfulServiceOrder(session)
          } else {
            await handleSuccessfulPurchase(session)
          }
        }
        break
      }

      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Stripe.Checkout.Session
        if (!isCodeVaultSession(session)) break
        if (session.metadata?.orderType === 'service') {
          await handleSuccessfulServiceOrder(session)
        } else {
          await handleSuccessfulPurchase(session)
        }
        break
      }

      case 'account.updated': {
        // Seller Stripe Connect account status changed
        const account = event.data.object as Stripe.Account
        await updateSellerStripeStatus(account)
        break
      }

      case 'charge.refunded': {
        // Fires on both full and partial refunds. We only flip the order
        // to 'refunded' when the charge is fully refunded — partial
        // refunds are logged but leave the license intact.
        const charge = event.data.object as Stripe.Charge
        await handleChargeRefunded(charge)
        break
      }

      case 'charge.dispute.created': {
        // Buyer opened a chargeback. Funds are already pulled by Stripe
        // until we win the dispute. Invalidate the license immediately so
        // the buyer can't keep downloading while the dispute is open.
        const dispute = event.data.object as Stripe.Dispute
        await handleDisputeOpened(dispute)
        break
      }

      case 'charge.dispute.closed': {
        // Re-enable the license if we won, keep it refunded if we lost.
        const dispute = event.data.object as Stripe.Dispute
        await handleDisputeClosed(dispute)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }
  } catch (error) {
    captureError(error instanceof Error ? error : new Error(String(error)), {
      context: 'webhook:stripe:processing',
      extra: { eventType: event.type, eventId: event.id },
    })
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

// Our Stripe account is shared across multiple Solaris businesses. A
// CodeVault session always carries either a productId (product checkout)
// or orderType=service (service checkout) in its metadata. Anything else
// arriving on this endpoint belongs to a sibling business and must be
// silently acked — throwing would make Stripe retry for 3 days.
function isCodeVaultSession(session: Stripe.Checkout.Session): boolean {
  const meta = session.metadata ?? {}
  return Boolean(meta.productId) || meta.orderType === 'service'
}

// Handle a successful digital product purchase
async function handleSuccessfulPurchase(session: Stripe.Checkout.Session) {
  const metadata = session.metadata
  const supabase = getSupabaseAdmin()

  if (!metadata?.productId || !metadata?.buyerId) {
    throw new Error(`Missing metadata in session ${session.id}`)
  }

  // Idempotency: skip if order exists for this payment
  const { data: existingOrder } = await supabase
    .from('orders')
    .select('id')
    .eq('stripe_payment_id', session.payment_intent as string)
    .maybeSingle()

  if (existingOrder) return

  const amountCents = parseInt(metadata.amountCents || '0')
  const platformFeeCents = Math.round(amountCents * PLATFORM_FEE_PERCENT / 100)
  const sellerPayoutCents = amountCents - platformFeeCents

  // Insert the license. license_key has a UNIQUE constraint; randomUUID
  // collisions are astronomically unlikely but a single 23505 would fail
  // the whole webhook, so retry with a freshly-generated key a few times
  // before giving up.
  let license: { id: string } | null = null
  let lastLicenseError: { message: string; code?: string } | null = null
  for (let attempt = 0; attempt < 5; attempt++) {
    const licenseKey = `CV-${crypto.randomUUID().replace(/-/g, '').slice(0, 20).toUpperCase()}`
    const { data, error } = await supabase
      .from('licenses')
      .insert({
        product_id: metadata.productId,
        buyer_id: metadata.buyerId,
        license_key: licenseKey,
        license_type: metadata.licenseType || 'personal',
      })
      .select()
      .single()

    if (!error && data) {
      license = data
      break
    }
    lastLicenseError = error
    // 23505 = unique_violation — keep trying with a new key. Anything
    // else is a real error, stop retrying.
    if (error?.code !== '23505') break
  }

  if (!license) {
    captureError(
      new Error(`License creation failed: ${lastLicenseError?.message ?? 'unknown'}`),
      {
        context: 'webhook:stripe:license',
        extra: { sessionId: session.id, errorCode: lastLicenseError?.code },
      },
    )
    throw new Error(lastLicenseError?.message ?? 'License creation failed')
  }

  // Create order
  const { error: orderError } = await supabase
    .from('orders')
    .insert({
      buyer_id: metadata.buyerId,
      product_id: metadata.productId,
      license_id: license.id,
      amount_cents: amountCents,
      platform_fee_cents: platformFeeCents,
      seller_payout_cents: sellerPayoutCents,
      stripe_payment_id: session.payment_intent as string,
      status: 'completed',
    })

  if (orderError) {
    captureError(new Error(`Order creation failed: ${orderError.message}`), {
      context: 'webhook:stripe:order',
      extra: { sessionId: session.id },
    })
    throw orderError
  }

  // Fire-and-forget tier recompute for the seller. A failure here must
  // never block the purchase from completing.
  const { data: productRow } = await supabase
    .from('products')
    .select('seller_id')
    .eq('id', metadata.productId)
    .maybeSingle()
  if (productRow?.seller_id) {
    await recomputeSellerTier(productRow.seller_id)
    // +50 XP for each completed product sale. Dedup by payment_intent
    // so Stripe webhook retries never double-award.
    awardSellerXp({
      sellerId: productRow.seller_id,
      eventType: 'product_order_completed',
      xpDelta: XP_REWARDS.PRODUCT_ORDER_COMPLETED,
      dedupKey: `product_order:${session.payment_intent}:completed`,
      sourceTable: 'orders',
      metadata: { product_id: metadata.productId, amount_cents: amountCents },
    }).catch(() => {})
  }

  // Buyer tier recompute — moves the buyer up the Explorer→Patron ladder.
  // Idempotent RPC, safe on webhook retries.
  try {
    await supabase.rpc('recompute_buyer_tier', { p_buyer_id: metadata.buyerId })
  } catch {
    // Tier recompute is best-effort; the purchase itself is the source of truth.
  }

  console.log(`[WEBHOOK] Purchase completed: product=${metadata.productId}, buyer=${metadata.buyerId}, license_id=${license.id}`)
}

// Handle a successful service order payment — flip the pre-created
// service_orders row to 'in_progress', set delivery_due_at, and bump
// the seller_services.order_count. Idempotent by service order ID.
async function handleSuccessfulServiceOrder(session: Stripe.Checkout.Session) {
  const supabase = getSupabaseAdmin()
  const metadata = session.metadata

  if (!metadata?.serviceOrderId || !metadata?.serviceId) {
    throw new Error(`Missing service order metadata in session ${session.id}`)
  }

  const { data: order } = await supabase
    .from('service_orders')
    .select('id, status, service_id, seller_id, delivery_days_snapshot')
    .eq('id', metadata.serviceOrderId)
    .maybeSingle()

  if (!order) {
    throw new Error(`service_order ${metadata.serviceOrderId} not found`)
  }

  // Idempotency: if already past awaiting_payment, nothing to do.
  if (order.status !== 'awaiting_payment') return

  // Fetch order_count to bump it on the listing. We intentionally do NOT
  // use seller_services.delivery_days here — that value could have been
  // edited between checkout and this webhook firing. The snapshot stamped
  // at order-creation time is what the buyer agreed to.
  const { data: svc } = await supabase
    .from('seller_services')
    .select('order_count')
    .eq('id', metadata.serviceId)
    .single()

  const deliveryDays = order.delivery_days_snapshot ?? 7
  const dueAt = new Date(Date.now() + deliveryDays * 86_400_000).toISOString()

  const { error: updateErr } = await supabase
    .from('service_orders')
    .update({
      status: 'in_progress',
      stripe_payment_id: session.payment_intent as string,
      delivery_due_at: dueAt,
    })
    .eq('id', order.id)

  if (updateErr) {
    captureError(new Error(`service_order update failed: ${updateErr.message}`), {
      context: 'webhook:stripe:service_order',
      extra: { sessionId: session.id, orderId: order.id },
    })
    throw updateErr
  }

  // Bump order_count on the listing (best-effort).
  if (svc) {
    await supabase
      .from('seller_services')
      .update({ order_count: (svc.order_count || 0) + 1 })
      .eq('id', metadata.serviceId)
  }

  console.log(`[WEBHOOK] Service order paid: order=${order.id}, seller=${order.seller_id}`)
}

// Update seller's Stripe Connect status
async function updateSellerStripeStatus(account: Stripe.Account) {
  const supabase = getSupabaseAdmin()

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('stripe_account_id', account.id)
    .single()

  if (!user) return

  await supabase
    .from('users')
    .update({
      stripe_onboarding_complete: account.details_submitted && account.charges_enabled,
    })
    .eq('id', user.id)

  console.log(`Updated Stripe status for seller ${user.id}: charges=${account.charges_enabled}`)
}

// Look up the record that corresponds to a Stripe charge across both
// payment flows. Products write the PaymentIntent ID to
// orders.stripe_payment_id; services write it to
// service_orders.stripe_payment_id. We check both and return whichever
// matches (product orders take precedence if somehow both exist).
type ChargeMatch =
  | { kind: 'product'; paymentIntentId: string; order: { id: string; status: string; product_id: string; buyer_id: string; license_id: string | null; amount_cents: number } }
  | { kind: 'service'; paymentIntentId: string; order: { id: string; status: string; service_id: string; buyer_id: string; seller_id: string; amount_cents: number } }
  | { kind: 'none'; paymentIntentId: string | null }

async function findOrderByCharge(charge: Stripe.Charge): Promise<ChargeMatch> {
  const paymentIntentId =
    typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : charge.payment_intent?.id
  if (!paymentIntentId) return { kind: 'none', paymentIntentId: null }

  const supabase = getSupabaseAdmin()

  const { data: productOrder } = await supabase
    .from('orders')
    .select('id, status, product_id, buyer_id, license_id, amount_cents')
    .eq('stripe_payment_id', paymentIntentId)
    .maybeSingle()
  if (productOrder) return { kind: 'product', paymentIntentId, order: productOrder }

  const { data: serviceOrder } = await supabase
    .from('service_orders')
    .select('id, status, service_id, buyer_id, seller_id, amount_cents')
    .eq('stripe_payment_id', paymentIntentId)
    .maybeSingle()
  if (serviceOrder) return { kind: 'service', paymentIntentId, order: serviceOrder }

  return { kind: 'none', paymentIntentId }
}

// Handle charge.refunded — flip the order to 'refunded' and revoke any
// associated access (license for products, delivery files stay visible
// but the order is marked refunded for services). Partial refunds are
// logged but leave state intact.
async function handleChargeRefunded(charge: Stripe.Charge) {
  const supabase = getSupabaseAdmin()
  const match = await findOrderByCharge(charge)

  if (match.kind === 'none') {
    console.log(`[WEBHOOK] charge.refunded: no order for payment_intent=${match.paymentIntentId}`)
    return
  }

  const fullyRefunded = charge.amount_refunded >= charge.amount
  if (!fullyRefunded) {
    console.log(
      `[WEBHOOK] Partial refund (${charge.amount_refunded}/${charge.amount}) on ${match.kind}_order ${match.order.id} — state unchanged`,
    )
    return
  }

  if (match.kind === 'product') {
    const order = match.order
    if (order.status === 'refunded') return

    const { error: orderErr } = await supabase
      .from('orders')
      .update({ status: 'refunded' })
      .eq('id', order.id)

    if (orderErr) {
      captureError(new Error(`Order refund update failed: ${orderErr.message}`), {
        context: 'webhook:stripe:refund',
        extra: { orderId: order.id, chargeId: charge.id },
      })
      throw orderErr
    }

    if (order.license_id) {
      await supabase
        .from('licenses')
        .update({ expires_at: new Date().toISOString() })
        .eq('id', order.license_id)
    }

    console.log(`[WEBHOOK] Order ${order.id} refunded, license revoked`)
    return
  }

  // Service order refund — mark as cancelled so seller can't keep working
  // against it and it no longer counts in stats. We don't flip to a
  // 'refunded' status because service_orders has no such state; 'cancelled'
  // covers the "this order no longer exists" case.
  const order = match.order
  if (order.status === 'cancelled') return
  const { error: soErr } = await supabase
    .from('service_orders')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', order.id)
  if (soErr) {
    captureError(new Error(`service_order refund update failed: ${soErr.message}`), {
      context: 'webhook:stripe:refund:service',
      extra: { orderId: order.id, chargeId: charge.id },
    })
    throw soErr
  }
  console.log(`[WEBHOOK] service_order ${order.id} refunded, marked cancelled`)
}

// Buyer opened a chargeback. For products: revoke the license so the
// disputed buyer can't keep downloading. For services: cancel the
// in-flight order so the seller stops delivering against it. Either way,
// we only mark fully refunded state when the dispute actually closes.
async function handleDisputeOpened(dispute: Stripe.Dispute) {
  const supabase = getSupabaseAdmin()
  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge.id
  const charge = await getStripe().charges.retrieve(chargeId)
  const match = await findOrderByCharge(charge)

  if (match.kind === 'none') {
    console.log(`[WEBHOOK] dispute.created: no order for charge=${chargeId}`)
    return
  }

  if (match.kind === 'product') {
    if (match.order.license_id) {
      await supabase
        .from('licenses')
        .update({ expires_at: new Date().toISOString() })
        .eq('id', match.order.license_id)
    }
    console.log(`[WEBHOOK] Dispute opened on order ${match.order.id}, license revoked pending resolution`)
    return
  }

  // Service order — pause the engagement until dispute closes.
  await supabase
    .from('service_orders')
    .update({ status: 'disputed' })
    .eq('id', match.order.id)
  console.log(`[WEBHOOK] Dispute opened on service_order ${match.order.id}, paused`)
}

// Dispute resolved. If we won, restore access. If we lost, treat it as a refund.
async function handleDisputeClosed(dispute: Stripe.Dispute) {
  const supabase = getSupabaseAdmin()
  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge.id
  const charge = await getStripe().charges.retrieve(chargeId)
  const match = await findOrderByCharge(charge)

  if (match.kind === 'none') return

  const won = dispute.status === 'won' || dispute.status === 'warning_closed'

  if (match.kind === 'product') {
    const order = match.order
    if (won) {
      if (order.license_id) {
        await supabase
          .from('licenses')
          .update({ expires_at: null })
          .eq('id', order.license_id)
      }
      console.log(`[WEBHOOK] Dispute ${dispute.id} won — order ${order.id} restored`)
      return
    }
    if (order.status !== 'refunded') {
      await supabase.from('orders').update({ status: 'refunded' }).eq('id', order.id)
    }
    console.log(`[WEBHOOK] Dispute ${dispute.id} closed (${dispute.status}) — order ${order.id} refunded`)
    return
  }

  // Service order.
  const order = match.order
  if (won) {
    // Restore to a sensible state: if delivery had already happened, back
    // to 'delivered'; otherwise 'in_progress'. Without knowing the prior
    // state we take the safer choice and leave it in_progress so buyer
    // must accept again.
    await supabase
      .from('service_orders')
      .update({ status: 'in_progress' })
      .eq('id', order.id)
    console.log(`[WEBHOOK] Dispute ${dispute.id} won — service_order ${order.id} resumed`)
    return
  }
  if (order.status !== 'cancelled') {
    await supabase
      .from('service_orders')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', order.id)
  }
  console.log(`[WEBHOOK] Dispute ${dispute.id} closed (${dispute.status}) — order ${order.id} refunded`)
}

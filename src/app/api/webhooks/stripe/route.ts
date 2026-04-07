import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getStripe } from '@/lib/stripe/client'
import { createClient } from '@supabase/supabase-js'
import { captureError } from '@/lib/error-tracking'
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
        if (session.payment_status === 'paid') {
          await handleSuccessfulPurchase(session)
        }
        break
      }

      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleSuccessfulPurchase(session)
        break
      }

      case 'account.updated': {
        // Seller Stripe Connect account status changed
        const account = event.data.object as Stripe.Account
        await updateSellerStripeStatus(account)
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

  // Generate license key
  const licenseKey = `CV-${crypto.randomUUID().replace(/-/g, '').slice(0, 20).toUpperCase()}`

  // Create license
  const { data: license, error: licenseError } = await supabase
    .from('licenses')
    .insert({
      product_id: metadata.productId,
      buyer_id: metadata.buyerId,
      license_key: licenseKey,
      license_type: metadata.licenseType || 'regular',
    })
    .select()
    .single()

  if (licenseError) {
    captureError(new Error(`License creation failed: ${licenseError.message}`), {
      context: 'webhook:stripe:license',
      extra: { sessionId: session.id },
    })
    throw licenseError
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

  console.log(`[WEBHOOK] Purchase completed: product=${metadata.productId}, buyer=${metadata.buyerId}, license=${licenseKey}`)
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

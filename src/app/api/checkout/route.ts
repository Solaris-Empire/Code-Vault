import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import Stripe from 'stripe'
import { requireAuth } from '@/lib/auth/verify'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/client'
import {
  DEFAULT_LICENSE_TIER,
  getLicenseTierDef,
  resolveLicensePrice,
  type LicenseTier,
} from '@/lib/constants/licensing'

export const dynamic = 'force-dynamic'

const PLATFORM_FEE_PERCENT = 15

// ─── Request validation ────────────────────────────────────────────
const checkoutSchema = z.object({
  product_id: z.string().uuid(),
  license_type: z.enum(['personal', 'commercial', 'extended']).default(DEFAULT_LICENSE_TIER),
})

// ─── POST /api/checkout ────────────────────────────────────────────
// Creates a Stripe Checkout Session for purchasing a digital product.
// The buyer is redirected to Stripe's hosted checkout page.
// After payment, the Stripe webhook creates the order + license.
export async function POST(request: NextRequest) {
  // Only authenticated users can purchase
  const auth = await requireAuth(request)
  if (!auth.success) return auth.error!

  let body: z.infer<typeof checkoutSchema>
  try {
    body = checkoutSchema.parse(await request.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: { message: 'Invalid request', details: err.issues } },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: { message: 'Invalid request body' } },
      { status: 400 }
    )
  }

  const admin = getSupabaseAdmin()

  // Fetch the product — must be approved and available for sale
  const { data: product, error: productError } = await admin
    .from('products')
    .select('id, title, slug, price_cents, seller_id, thumbnail_url, status, license_prices_cents')
    .eq('id', body.product_id)
    .single()

  if (productError || !product) {
    return NextResponse.json(
      { error: { message: 'Product not found' } },
      { status: 404 }
    )
  }

  if (product.status !== 'approved') {
    return NextResponse.json(
      { error: { message: 'This product is not available for purchase' } },
      { status: 400 }
    )
  }

  // Prevent buyers from purchasing their own products
  if (product.seller_id === auth.user!.id) {
    return NextResponse.json(
      { error: { message: 'You cannot purchase your own product' } },
      { status: 400 }
    )
  }

  // Check if buyer already owns this product (has an active license)
  const { data: existingLicense } = await admin
    .from('licenses')
    .select('id')
    .eq('product_id', product.id)
    .eq('buyer_id', auth.user!.id)
    .maybeSingle()

  if (existingLicense) {
    return NextResponse.json(
      { error: { message: 'You already own this product' } },
      { status: 409 }
    )
  }

  // Resolve tier price (honors per-product overrides, falls back to multipliers)
  const tier: LicenseTier = body.license_type
  const tierDef = getLicenseTierDef(tier)
  const priceCents = resolveLicensePrice(
    product.price_cents,
    tier,
    product.license_prices_cents as Partial<Record<LicenseTier, number>> | null
  )

  // Stripe rejects charges under $0.50. Enforce this explicitly so we
  // surface a clean error instead of a Stripe 400 deep in the flow, and
  // so free/zero-price products can't accidentally open checkout.
  const MIN_CHARGE_CENTS = 50
  if (priceCents < MIN_CHARGE_CENTS) {
    return NextResponse.json(
      { error: { message: 'Minimum purchase amount is $0.50' } },
      { status: 400 },
    )
  }

  // Calculate platform fee for Stripe Connect
  const platformFeeCents = Math.round(priceCents * PLATFORM_FEE_PERCENT / 100)

  // Look up seller's Stripe Connect account ID for split payment
  const { data: seller } = await admin
    .from('users')
    .select('stripe_account_id, stripe_onboarding_complete')
    .eq('id', product.seller_id)
    .single()

  // Build the Stripe Checkout Session
  const stripe = getStripe()
  const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  // Base session config — using Record to avoid strict type issues with Stripe SDK
  const sessionConfig: Record<string, unknown> = {
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: product.title,
            description: `${tierDef.name} License \u2014 ${tierDef.tagline}`,
            ...(product.thumbnail_url ? { images: [product.thumbnail_url] } : {}),
          },
          unit_amount: priceCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      productId: product.id,
      buyerId: auth.user!.id,
      amountCents: priceCents.toString(),
      licenseType: tier,
      sellerId: product.seller_id,
    },
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/products/${product.slug}`,
  }

  // If seller has a connected Stripe account, use Connect for split payments
  // Otherwise, the platform collects the full amount
  if (seller?.stripe_account_id && seller.stripe_onboarding_complete) {
    sessionConfig.payment_intent_data = {
      application_fee_amount: platformFeeCents,
      transfer_data: {
        destination: seller.stripe_account_id,
      },
    }
  }

  try {
    const session = await stripe.checkout.sessions.create(
      sessionConfig as Stripe.Checkout.SessionCreateParams
    )

    return NextResponse.json({
      data: {
        sessionId: session.id,
        url: session.url,
      },
    })
  } catch (err) {
    console.error('Stripe session creation failed:', err)
    return NextResponse.json(
      { error: { message: 'Failed to create checkout session' } },
      { status: 500 }
    )
  }
}

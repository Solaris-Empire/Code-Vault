import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import Stripe from 'stripe'
import { requireAuth } from '@/lib/auth/verify'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/client'

export const dynamic = 'force-dynamic'

const PLATFORM_FEE_PERCENT = 15

// ─── Request validation ────────────────────────────────────────────
const checkoutSchema = z.object({
  product_id: z.string().uuid(),
  license_type: z.enum(['regular', 'extended']).default('regular'),
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
    .select('id, title, slug, price_cents, seller_id, thumbnail_url, status')
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

  // Extended license costs 5x the regular price
  const priceCents = body.license_type === 'extended'
    ? product.price_cents * 5
    : product.price_cents

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
            description: `${body.license_type === 'extended' ? 'Extended' : 'Regular'} License`,
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
      licenseType: body.license_type,
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

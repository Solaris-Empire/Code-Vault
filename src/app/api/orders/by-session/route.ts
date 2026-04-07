import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/verify'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/client'

export const dynamic = 'force-dynamic'

// ─── GET /api/orders/by-session?session_id=... ─────────────────────
// Fetches order details using a Stripe Checkout Session ID.
// Used by the checkout success page to show the order confirmation.
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth.success) return auth.error!

  const sessionId = request.nextUrl.searchParams.get('session_id')
  if (!sessionId) {
    return NextResponse.json(
      { error: { message: 'session_id is required' } },
      { status: 400 }
    )
  }

  // Look up the Stripe session to get the payment_intent ID
  const stripe = getStripe()
  let paymentIntentId: string

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    paymentIntentId = session.payment_intent as string
    if (!paymentIntentId) {
      return NextResponse.json(
        { error: { message: 'Payment not found' } },
        { status: 404 }
      )
    }
  } catch {
    return NextResponse.json(
      { error: { message: 'Invalid session' } },
      { status: 400 }
    )
  }

  // Find the order by stripe_payment_id
  const admin = getSupabaseAdmin()
  const { data: order, error } = await admin
    .from('orders')
    .select(`
      id, amount_cents, status, created_at,
      product:products(title, slug),
      license:licenses(license_key, license_type)
    `)
    .eq('stripe_payment_id', paymentIntentId)
    .eq('buyer_id', auth.user!.id)
    .maybeSingle()

  if (error || !order) {
    return NextResponse.json(
      { error: { message: 'Order not found' } },
      { status: 404 }
    )
  }

  // Shape the response for the success page
  // Supabase joins can return arrays or objects depending on the FK relationship
  const rawProduct = order.product as unknown
  const product = Array.isArray(rawProduct) ? rawProduct[0] as { title: string; slug: string } | undefined : rawProduct as { title: string; slug: string } | null
  const rawLicense = order.license as unknown
  const license = Array.isArray(rawLicense) ? rawLicense[0] as { license_key: string; license_type: string } | undefined : rawLicense as { license_key: string; license_type: string } | null

  return NextResponse.json({
    data: {
      orderId: order.id,
      productTitle: product?.title || 'Unknown',
      productSlug: product?.slug || '',
      licenseKey: license?.license_key || '',
      licenseType: license?.license_type || 'regular',
      amountCents: order.amount_cents,
    },
  })
}

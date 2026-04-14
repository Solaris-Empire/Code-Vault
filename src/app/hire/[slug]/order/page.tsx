// Checkout page for hiring a seller — collects buyer brief + requirements,
// then redirects to Stripe via /api/services/orders.

import { notFound, redirect } from 'next/navigation'
import { createClient, getSupabaseAdmin } from '@/lib/supabase/server'
import OrderCheckoutForm, { type CheckoutService } from './order-checkout-form'

export const dynamic = 'force-dynamic'

export default async function OrderCheckoutPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?redirectTo=${encodeURIComponent(`/hire/${slug}/order`)}`)

  const admin = getSupabaseAdmin()
  const { data: svc } = await admin
    .from('seller_services')
    .select(
      `id, seller_id, tier, title, slug, short_description, thumbnail_url,
       pricing_model, price_cents, hourly_rate_cents, min_hours,
       delivery_days, revisions_included, status,
       seller:users!seller_services_seller_id_fkey(id, display_name, avatar_url, seller_tier)`,
    )
    .eq('slug', slug)
    .eq('status', 'approved')
    .maybeSingle()

  if (!svc) notFound()

  // Supabase can return the joined relation as an array; normalize to a single object.
  const raw = svc as unknown as Record<string, unknown> & {
    seller?: CheckoutService['seller'] | CheckoutService['seller'][] | null
  }
  const sellerValue = Array.isArray(raw.seller) ? (raw.seller[0] ?? null) : (raw.seller ?? null)
  const service: CheckoutService = { ...(raw as unknown as CheckoutService), seller: sellerValue }

  if (service.seller_id === user.id) {
    redirect(`/hire/${slug}?error=self`)
  }

  return <OrderCheckoutForm service={service} />
}

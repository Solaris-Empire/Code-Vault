// Service detail page — public, pre-purchase view of a Vibe/Real gig.
// Hire Now CTA will wire to /orders flow in Sprint 3 Phase 3.

import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  Clock, Gem, Zap, Star, CheckCircle2, ArrowLeft, RefreshCw, User as UserIcon,
  Calendar, Shield, Briefcase,
} from 'lucide-react'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { SellerTierBadge } from '@/components/seller/seller-tier-badge'
import { SellerRankBadge, type SellerRankKey } from '@/components/seller/seller-rank-badge'
import { PLATFORM_FEE_PERCENT, computeFixedSplit, computeHourlySplit } from '@/lib/services/pricing'
import type { SellerTier } from '@/lib/seller/tier'
import type { SellerServiceListRow } from '@/lib/services/types'
import type { Metadata } from 'next'

export const revalidate = 60

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('seller_services')
    .select('title, short_description, description')
    .eq('slug', slug)
    .eq('status', 'approved')
    .maybeSingle()

  if (!data) return { title: 'Service not found | CodeVault' }
  return {
    title: `${data.title} | CodeVault`,
    description: data.short_description || data.description.slice(0, 160),
  }
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = getSupabaseAdmin()

  const { data: serviceRaw } = await supabase
    .from('seller_services')
    .select(
      `id, seller_id, tier, category_id, title, slug, short_description, description,
       thumbnail_url, tags, pricing_model, price_cents, hourly_rate_cents, min_hours,
       delivery_days, revisions_included, status, order_count, avg_rating, review_count,
       created_at, updated_at,
       seller:users!seller_services_seller_id_fkey(id, display_name, avatar_url, bio, created_at, seller_tier, seller_rank_key, seller_xp),
       category:categories!seller_services_category_id_fkey(name, slug)`,
    )
    .eq('slug', slug)
    .eq('status', 'approved')
    .maybeSingle()

  const service = serviceRaw as (SellerServiceListRow & {
    seller?: {
      id: string; display_name: string | null; avatar_url: string | null;
      bio: string | null; created_at: string; seller_tier: SellerTier | null;
      seller_rank_key: string | null; seller_xp: number | null
    } | null
  }) | null

  if (!service) notFound()

  const [{ data: otherServices }, { data: reviewsRaw }] = await Promise.all([
    supabase
      .from('seller_services')
      .select('id, title, slug, tier, pricing_model, price_cents, hourly_rate_cents, delivery_days, thumbnail_url')
      .eq('seller_id', service.seller_id)
      .eq('status', 'approved')
      .neq('id', service.id)
      .order('order_count', { ascending: false })
      .limit(3),
    supabase
      .from('service_reviews')
      .select('id, rating, comment, created_at, buyer:users!service_reviews_buyer_id_fkey(id, display_name, avatar_url)')
      .eq('service_id', service.id)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  type ReviewDisplay = {
    id: string
    rating: number
    comment: string | null
    created_at: string
    buyer: { id: string; display_name: string | null; avatar_url: string | null } | null
  }
  const reviews: ReviewDisplay[] = (reviewsRaw ?? []).map((r: Record<string, unknown>) => {
    const buyerRaw = r.buyer as ReviewDisplay['buyer'] | ReviewDisplay['buyer'][] | null
    const buyer = Array.isArray(buyerRaw) ? buyerRaw[0] ?? null : buyerRaw ?? null
    return {
      id: r.id as string,
      rating: r.rating as number,
      comment: (r.comment as string | null) ?? null,
      created_at: r.created_at as string,
      buyer,
    }
  })

  // Rating histogram: counts per star (1..5)
  const ratingDist = [1, 2, 3, 4, 5].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }))

  const sellerTier = (service.seller?.seller_tier ?? 'unverified') as SellerTier

  const breakdown = service.pricing_model === 'hourly'
    ? computeHourlySplit(service.hourly_rate_cents || 0, service.min_hours || 1)
    : computeFixedSplit(service.price_cents)

  const priceLabel = service.pricing_model === 'hourly'
    ? `$${((service.hourly_rate_cents || 0) / 100).toFixed(0)}/hr`
    : `$${(service.price_cents / 100).toFixed(2)}`

  const starterLabel = service.pricing_model === 'hourly'
    ? `$${(breakdown.amountCents / 100).toFixed(2)} starter (${service.min_hours}h)`
    : 'One-time fee'

  const memberSince = service.seller?.created_at
    ? new Date(service.seller.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <nav className="nav-light sticky top-0 z-40 border-b border-gray-100">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/hire" className="inline-flex items-center gap-2 text-sm text-(--color-text-secondary) hover:text-green-700">
            <ArrowLeft className="h-4 w-4" /> Back to services
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/products" className="text-(--color-text-muted) hover:text-green-700">Browse</Link>
            <Link href="/hire" className="text-green-700 font-medium">Hire</Link>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {service.tier === 'real' ? (
                  <span className="inline-flex items-center gap-1 bg-purple-600 text-white text-xs font-semibold px-2.5 py-1">
                    <Gem className="h-3 w-3" /> Real Coder
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 bg-amber-500 text-white text-xs font-semibold px-2.5 py-1">
                    <Zap className="h-3 w-3" /> Vibe Coder
                  </span>
                )}
                {service.category && (
                  <Link
                    href={`/hire?category=${service.category.slug}`}
                    className="text-xs bg-gray-100 text-(--color-text-muted) hover:text-green-700 px-2.5 py-1"
                  >
                    {service.category.name}
                  </Link>
                )}
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">{service.title}</h1>
              {service.short_description && (
                <p className="text-lg text-(--color-text-secondary)">{service.short_description}</p>
              )}
              <div className="flex items-center gap-6 mt-4 text-sm text-(--color-text-secondary)">
                {(service.review_count || 0) > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span className="font-semibold text-gray-900">{(service.avg_rating || 0).toFixed(1)}</span>
                    <span>({service.review_count} reviews)</span>
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Briefcase className="h-4 w-4" />
                  {service.order_count} {service.order_count === 1 ? 'order' : 'orders'}
                </span>
              </div>
            </div>

            {/* Thumbnail */}
            {service.thumbnail_url && (
              <div className="aspect-[16/9] bg-gray-50 overflow-hidden border border-gray-100">
                <img src={service.thumbnail_url} alt={service.title} className="w-full h-full object-cover" />
              </div>
            )}

            {/* Description */}
            <div>
              <h2 className="text-xl font-bold mb-3">About this service</h2>
              <div className="prose prose-sm max-w-none text-(--color-text-primary) whitespace-pre-wrap leading-relaxed">
                {service.description}
              </div>
            </div>

            {/* Tags */}
            {service.tags && service.tags.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-(--color-text-secondary) uppercase tracking-wider mb-3">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {service.tags.map((t) => (
                    <span key={t} className="text-xs bg-gray-100 text-(--color-text-muted) px-2.5 py-1">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* What you get */}
            <div className="bg-green-50/40 border border-green-100 p-5">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                What you get
              </h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <li className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  <span>Delivery in <strong>{service.delivery_days} days</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <RefreshCw className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  <span>
                    <strong>
                      {service.revisions_included === 0
                        ? 'No revisions'
                        : `${service.revisions_included} revision${service.revisions_included === 1 ? '' : 's'}`}
                    </strong> included
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Shield className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  <span>Escrow protection — funds held until delivery</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  <span>Direct messaging with the seller</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-4">
            {/* Pricing box */}
            <div className="bg-white border border-gray-200 p-5 sticky top-20">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-3xl font-bold text-green-600">{priceLabel}</span>
              </div>
              <p className="text-xs text-(--color-text-muted) mb-4">{starterLabel}</p>

              <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                <div className="bg-gray-50 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-(--color-text-muted) mb-1">Delivery</p>
                  <p className="font-semibold flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-green-600" />
                    {service.delivery_days} days
                  </p>
                </div>
                <div className="bg-gray-50 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-(--color-text-muted) mb-1">Revisions</p>
                  <p className="font-semibold flex items-center gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5 text-green-600" />
                    {service.revisions_included}
                  </p>
                </div>
              </div>

              <Link
                href={`/hire/${service.slug}/order`}
                className="w-full btn-primary text-white py-3 rounded-none font-semibold text-center block"
              >
                Continue ({priceLabel})
              </Link>
              <p className="text-[11px] text-(--color-text-muted) text-center mt-2">
                You won't be charged until the seller accepts your brief.
              </p>

              <div className="border-t border-gray-100 mt-4 pt-4 text-xs space-y-1.5 text-(--color-text-secondary)">
                <div className="flex justify-between">
                  <span>Service price</span>
                  <span className="font-mono">${(breakdown.amountCents / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Platform fee ({PLATFORM_FEE_PERCENT}%)</span>
                  <span className="font-mono">${(breakdown.platformFeeCents / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold text-gray-900 pt-1.5 border-t border-gray-100">
                  <span>Seller receives</span>
                  <span className="font-mono">${(breakdown.sellerPayoutCents / 100).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Seller card */}
            <div className="bg-white border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-(--color-text-secondary) uppercase tracking-wider mb-3">About the seller</h3>
              <div className="flex items-start gap-3 mb-3">
                <div className="h-14 w-14 bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                  {service.seller?.avatar_url ? (
                    <Image src={service.seller.avatar_url} alt="" width={56} height={56} className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="h-7 w-7 text-(--color-text-muted)" />
                  )}
                </div>
                <div className="min-w-0">
                  <Link
                    href={`/sellers/${service.seller?.id}`}
                    className="font-semibold text-gray-900 hover:text-green-700 line-clamp-1"
                  >
                    {service.seller?.display_name || 'Unknown'}
                  </Link>
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                    <SellerRankBadge rankKey={service.seller?.seller_rank_key as SellerRankKey | null} size="pill" />
                    <SellerTierBadge tier={sellerTier} />
                  </div>
                  {memberSince && (
                    <p className="text-xs text-(--color-text-muted) mt-1.5 flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Since {memberSince}
                    </p>
                  )}
                </div>
              </div>
              {service.seller?.bio && (
                <p className="text-sm text-(--color-text-secondary) line-clamp-4 leading-relaxed">{service.seller.bio}</p>
              )}
              <Link
                href={`/sellers/${service.seller?.id}`}
                className="mt-3 inline-block text-sm text-green-700 hover:text-green-800 font-medium"
              >
                View full profile →
              </Link>
            </div>
          </aside>
        </div>

        {/* Reviews */}
        {reviews.length > 0 && (
          <section className="mt-16">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold">Reviews</h2>
              <span className="text-sm text-(--color-text-secondary) flex items-center gap-1.5">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span className="font-semibold text-gray-900">{(service.avg_rating || 0).toFixed(1)}</span>
                <span>· {service.review_count || reviews.length} total</span>
              </span>
            </div>

            {/* Distribution bars */}
            <div className="bg-white border border-gray-200 p-5 mb-6">
              <div className="space-y-2">
                {ratingDist.slice().reverse().map(({ star, count }) => {
                  const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0
                  return (
                    <div key={star} className="flex items-center gap-3 text-xs">
                      <span className="w-10 flex items-center gap-1 text-(--color-text-secondary)">
                        {star} <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      </span>
                      <div className="flex-1 h-2 bg-gray-100 overflow-hidden">
                        <div
                          className="h-full bg-amber-400"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-(--color-text-muted)">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Individual reviews */}
            <div className="space-y-4">
              {reviews.map((r) => (
                <article key={r.id} className="bg-white border border-gray-200 p-5">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                      {r.buyer?.avatar_url ? (
                        <Image src={r.buyer.avatar_url} alt="" width={40} height={40} className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon className="h-5 w-5 text-(--color-text-muted)" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <p className="font-semibold text-sm text-gray-900">
                          {r.buyer?.display_name || 'Buyer'}
                        </p>
                        <span className="text-xs text-(--color-text-muted)">
                          {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5 mt-1 mb-2">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={`h-3.5 w-3.5 ${n <= r.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`}
                          />
                        ))}
                      </div>
                      {r.comment && (
                        <p className="text-sm text-(--color-text-primary) whitespace-pre-wrap leading-relaxed">
                          {r.comment}
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* More from this seller */}
        {otherServices && otherServices.length > 0 && (
          <section className="mt-16">
            <h2 className="text-xl font-bold mb-5">More from {service.seller?.display_name}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {otherServices.map((o) => (
                <Link key={o.id} href={`/hire/${o.slug}`} className="product-card group">
                  <div className="aspect-[16/10] bg-gray-50 relative overflow-hidden">
                    {o.thumbnail_url ? (
                      <img src={o.thumbnail_url} alt={o.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-green-50 to-white">
                        <Briefcase className="h-10 w-10 text-green-300" />
                      </div>
                    )}
                    <div className="absolute top-3 left-3">
                      {o.tier === 'real' ? (
                        <span className="inline-flex items-center gap-1 bg-purple-600 text-white text-xs font-medium px-2 py-0.5">
                          <Gem className="h-3 w-3" /> Real
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-amber-500 text-white text-xs font-medium px-2 py-0.5">
                          <Zap className="h-3 w-3" /> Vibe
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 group-hover:text-green-700 line-clamp-2 min-h-[3rem]">{o.title}</h3>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                      <span className="text-lg font-bold text-green-600">
                        {o.pricing_model === 'hourly'
                          ? `$${((o.hourly_rate_cents || 0) / 100).toFixed(0)}/hr`
                          : `$${(o.price_cents / 100).toFixed(2)}`}
                      </span>
                      <span className="flex items-center gap-1 text-sm text-(--color-text-secondary)">
                        <Clock className="h-3.5 w-3.5" /> {o.delivery_days}d
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

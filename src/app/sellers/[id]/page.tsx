import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Star, Download, Calendar, Package, User as UserIcon, Briefcase, Clock, Zap, Gem } from 'lucide-react'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { SellerTierBadge } from '@/components/seller/seller-tier-badge'
import { SellerRankBadge, type SellerRankKey } from '@/components/seller/seller-rank-badge'
import type { SellerTier } from '@/lib/seller/tier'
import type { SellerServiceRow } from '@/lib/services/types'

export const revalidate = 60

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export default async function SellerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = getSupabaseAdmin()

  const [{ data: seller }, { data: products }, { data: statsRow }, { data: services }] = await Promise.all([
    supabase
      .from('users')
      .select('id, display_name, avatar_url, bio, created_at, role, seller_tier, seller_rank_key, seller_xp, seller_rank_sort')
      .eq('id', id)
      .in('role', ['seller', 'admin'])
      .maybeSingle(),
    supabase
      .from('products')
      .select('id, title, slug, thumbnail_url, price_cents, avg_rating, review_count, download_count, short_description')
      .eq('seller_id', id)
      .eq('status', 'approved')
      .order('created_at', { ascending: false }),
    supabase
      .from('seller_stats')
      .select('tier, quality_letter, avg_quality_score, total_sales, total_products, verified_ownership_count')
      .eq('seller_id', id)
      .maybeSingle(),
    supabase
      .from('seller_services')
      .select('id, title, slug, tier, short_description, thumbnail_url, pricing_model, price_cents, hourly_rate_cents, delivery_days, revisions_included, order_count, avg_rating, review_count')
      .eq('seller_id', id)
      .eq('status', 'approved')
      .order('order_count', { ascending: false })
      .limit(6),
  ])

  if (!seller) notFound()

  const productList = products || []
  const serviceList = (services || []) as Pick<
    SellerServiceRow,
    'id' | 'title' | 'slug' | 'tier' | 'short_description' | 'thumbnail_url' |
    'pricing_model' | 'price_cents' | 'hourly_rate_cents' | 'delivery_days' |
    'revisions_included' | 'order_count' | 'avg_rating' | 'review_count'
  >[]
  const totalDownloads = productList.reduce((sum, p) => sum + (p.download_count || 0), 0)
  const ratedProducts = productList.filter((p) => (p.review_count || 0) > 0)
  const avgRating =
    ratedProducts.length > 0
      ? ratedProducts.reduce((sum, p) => sum + (p.avg_rating || 0), 0) / ratedProducts.length
      : 0

  return (
    <div className="min-h-screen bg-(--color-background)">
      {/* Header */}
      <div className="bg-(--brand-dark) text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div className="h-24 w-24 rounded-full bg-white/10 flex items-center justify-center overflow-hidden shrink-0">
              {seller.avatar_url ? (
                <Image src={seller.avatar_url} alt={seller.display_name} width={96} height={96} className="h-full w-full object-cover" />
              ) : (
                <UserIcon className="h-12 w-12 text-white/60" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight">{seller.display_name}</h1>
                <SellerRankBadge rankKey={seller.seller_rank_key as SellerRankKey | null} size="pill" />
                <SellerTierBadge tier={(statsRow?.tier ?? seller.seller_tier ?? 'unverified') as SellerTier} />
              </div>
              <p className="text-sm text-white/60 mt-1 flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                Member since {formatDate(seller.created_at)}
              </p>
              {seller.bio && <p className="text-white/80 mt-4 max-w-2xl leading-relaxed">{seller.bio}</p>}

              <div className="flex flex-wrap gap-6 mt-6">
                <div>
                  <div className="text-2xl font-bold">{productList.length}</div>
                  <div className="text-xs text-white/60 uppercase tracking-wider">Products</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{totalDownloads.toLocaleString()}</div>
                  <div className="text-xs text-white/60 uppercase tracking-wider">Downloads</div>
                </div>
                <div>
                  <div className="text-2xl font-bold flex items-center gap-1.5">
                    {avgRating.toFixed(1)}
                    <Star className="h-5 w-5 fill-(--brand-amber) text-(--brand-amber)" />
                  </div>
                  <div className="text-xs text-white/60 uppercase tracking-wider">Avg Rating</div>
                </div>
                {statsRow?.quality_letter && (
                  <div>
                    <div className="text-2xl font-bold">
                      {statsRow.quality_letter}
                      <span className="text-sm text-white/60 font-normal ml-1">
                        ({Number(statsRow.avg_quality_score).toFixed(0)})
                      </span>
                    </div>
                    <div className="text-xs text-white/60 uppercase tracking-wider">Quality GPA</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Services / Hire Me */}
      {serviceList.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <h2 className="text-xl font-bold text-(--color-text-primary) flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Hire {seller.display_name}
            </h2>
            <Link
              href={`/hire?search=${encodeURIComponent(seller.display_name)}`}
              className="text-sm text-(--brand-primary) hover:underline"
            >
              View all services →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {serviceList.map((s) => (
              <Link
                key={s.id}
                href={`/hire/${s.slug}`}
                className="group bg-(--color-surface) border border-(--color-border) hover:border-(--brand-primary) transition-colors"
              >
                <div className="aspect-video bg-(--color-elevated) relative overflow-hidden">
                  {s.thumbnail_url ? (
                    <Image
                      src={s.thumbnail_url}
                      alt={s.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-(--color-text-muted)">
                      <Briefcase className="h-10 w-10" />
                    </div>
                  )}
                  <div className="absolute top-3 left-3">
                    {s.tier === 'real' ? (
                      <span className="inline-flex items-center gap-1 bg-purple-600 text-white text-xs font-semibold px-2 py-0.5">
                        <Gem className="h-3 w-3" /> Real
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-amber-500 text-white text-xs font-semibold px-2 py-0.5">
                        <Zap className="h-3 w-3" /> Vibe
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-(--color-text-primary) line-clamp-2 min-h-[3rem] group-hover:text-(--brand-primary) transition-colors">
                    {s.title}
                  </h3>
                  {s.short_description && (
                    <p className="text-sm text-(--color-text-secondary) line-clamp-2 mt-1">{s.short_description}</p>
                  )}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-(--color-border)">
                    <span className="text-lg font-bold text-(--brand-primary)">
                      {s.pricing_model === 'hourly'
                        ? `$${((s.hourly_rate_cents || 0) / 100).toFixed(0)}/hr`
                        : formatPrice(s.price_cents)}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-(--color-text-muted)">
                      <Clock className="h-3.5 w-3.5" />
                      {s.delivery_days}d
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Products */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-xl font-bold text-(--color-text-primary) mb-6 flex items-center gap-2">
          <Package className="h-5 w-5" />
          Products by {seller.display_name}
        </h2>

        {productList.length === 0 ? (
          <div className="text-center py-16 bg-(--color-surface) border border-(--color-border)">
            <p className="text-(--color-text-secondary)">No products published yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {productList.map((p) => (
              <Link
                key={p.id}
                href={`/products/${p.slug}`}
                className="group bg-(--color-surface) border border-(--color-border) hover:border-(--brand-primary) transition-colors"
              >
                <div className="aspect-video bg-(--color-elevated) relative overflow-hidden">
                  {p.thumbnail_url ? (
                    <Image
                      src={p.thumbnail_url}
                      alt={p.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-(--color-text-muted)">
                      <Package className="h-10 w-10" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-(--color-text-primary) line-clamp-1 group-hover:text-(--brand-primary) transition-colors">
                    {p.title}
                  </h3>
                  {p.short_description && (
                    <p className="text-sm text-(--color-text-secondary) line-clamp-2 mt-1">{p.short_description}</p>
                  )}
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-lg font-bold text-(--brand-primary)">{formatPrice(p.price_cents)}</span>
                    <div className="flex items-center gap-3 text-xs text-(--color-text-muted)">
                      {(p.review_count || 0) > 0 && (
                        <span className="flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 fill-(--brand-amber) text-(--brand-amber)" />
                          {(p.avg_rating || 0).toFixed(1)}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Download className="h-3.5 w-3.5" />
                        {p.download_count || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

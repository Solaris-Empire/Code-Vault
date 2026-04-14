// Public /hire — premium developer hub. Two paths up front: buy ready-made
// code (marketplace) or hire a vetted developer to build something custom.
// Toptal-inspired, distinct identity. Filters/grid kept intact below the fold.

import Link from 'next/link'
import {
  Search, SlidersHorizontal, ArrowUpDown, Sparkles, Code2, Zap, Gem, Clock, Star, Briefcase,
  ShoppingBag, Hammer, ArrowRight, Shield, CheckCircle2, MessageSquare, Users, TrendingUp,
  Rocket, Award, Lock,
} from 'lucide-react'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { requireBetaFeature } from '@/lib/feature-flags'
import { SellerTierBadge } from '@/components/seller/seller-tier-badge'
import { SellerRankBadge } from '@/components/seller/seller-rank-badge'
import type { SellerTier } from '@/lib/seller/tier'
import type { SellerServiceListRow } from '@/lib/services/types'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Hire a Developer | CodeVault',
  description: 'Buy ready-made code or hire a vetted developer to build it for you. Every seller is quality-scored. Escrow-protected.',
}

export const revalidate = 60

interface CategoryRow {
  id: string
  name: string
  slug: string
  icon: string | null
  sort_order: number
}

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
  { value: 'popular', label: 'Most Ordered' },
  { value: 'rating', label: 'Top Rated' },
] as const

type SortValue = (typeof SORT_OPTIONS)[number]['value']

function getSortConfig(sort: SortValue): { column: string; ascending: boolean } {
  switch (sort) {
    case 'price_asc': return { column: 'price_cents', ascending: true }
    case 'price_desc': return { column: 'price_cents', ascending: false }
    case 'popular': return { column: 'order_count', ascending: false }
    case 'rating': return { column: 'avg_rating', ascending: false }
    case 'newest':
    default: return { column: 'created_at', ascending: false }
  }
}

export default async function HirePage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; category?: string; tier?: string; sort?: string }>
}) {
  requireBetaFeature('hire')
  const params = await searchParams
  const searchQuery = params.search?.trim() || ''
  const categorySlug = params.category?.trim() || ''
  const tierFilter = params.tier === 'vibe' || params.tier === 'real' ? params.tier : ''
  const sortValue: SortValue = SORT_OPTIONS.some((o) => o.value === params.sort)
    ? (params.sort as SortValue)
    : 'newest'

  // If filters are active, the page becomes a focused browse experience.
  // Otherwise we show the full premium hub layout.
  const isFiltering = Boolean(searchQuery || categorySlug || tierFilter || (params.sort && sortValue !== 'newest'))

  const supabase = getSupabaseAdmin()
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, slug, icon, sort_order')
    .order('sort_order', { ascending: true })
  const safeCategories: CategoryRow[] = (categories as CategoryRow[] | null) || []

  let query = supabase
    .from('seller_services')
    .select(
      `id, seller_id, tier, category_id, title, slug, short_description, description,
       thumbnail_url, tags, pricing_model, price_cents, hourly_rate_cents, min_hours,
       delivery_days, revisions_included, status, order_count, avg_rating, review_count, created_at, updated_at,
       seller:users!seller_services_seller_id_fkey(id, display_name, avatar_url, seller_tier, seller_rank_key),
       category:categories!seller_services_category_id_fkey(name, slug)`,
    )
    .eq('status', 'approved')

  if (tierFilter) query = query.eq('tier', tierFilter)
  if (searchQuery) query = query.ilike('title', `%${searchQuery}%`)
  if (categorySlug) {
    const match = safeCategories.find((c) => c.slug === categorySlug)
    if (match) query = query.eq('category_id', match.id)
  }

  const sortConfig = getSortConfig(sortValue)
  query = query.order(sortConfig.column, { ascending: sortConfig.ascending }).limit(48)

  const { data: services } = await query
  const rows: SellerServiceListRow[] = (services as SellerServiceListRow[] | null) || []

  // Featured strips for the premium homepage variant
  const featuredReal = rows.filter((s) => s.tier === 'real').slice(0, 3)
  const featuredVibe = rows.filter((s) => s.tier === 'vibe').slice(0, 3)
  const topRated = [...rows]
    .filter((s) => (s.review_count || 0) > 0)
    .sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0))
    .slice(0, 6)

  // Lightweight platform stats — counted from the categories list and approved services
  const totalServices = rows.length
  const realCoders = rows.filter((s) => s.tier === 'real').length
  const totalDeliveries = rows.reduce((acc, s) => acc + (s.order_count || 0), 0)

  function buildUrl(overrides: Record<string, string | undefined>): string {
    const p = new URLSearchParams()
    if (searchQuery) p.set('search', searchQuery)
    if (categorySlug) p.set('category', categorySlug)
    if (tierFilter) p.set('tier', tierFilter)
    if (sortValue !== 'newest') p.set('sort', sortValue)
    for (const [key, val] of Object.entries(overrides)) {
      if (val === undefined || val === '') p.delete(key)
      else p.set(key, val)
    }
    const qs = p.toString()
    return `/hire${qs ? `?${qs}` : ''}`
  }

  const activeCategory = safeCategories.find((c) => c.slug === categorySlug)

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Nav */}
      <nav className="nav-light sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Code2 className="h-7 w-7 text-green-600" />
            <span className="text-xl font-bold tracking-tight">CodeVault</span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            <Link href="/products" className="text-(--color-text-muted) hover:text-green-700 hover:bg-green-50 px-3.5 py-2 rounded-none text-sm font-medium transition-all">Browse</Link>
            <Link href="/hire" className="text-green-700 bg-green-50 px-3.5 py-2 rounded-none text-sm font-medium">Hire</Link>
            <Link href="/categories" className="text-(--color-text-muted) hover:text-green-700 hover:bg-green-50 px-3.5 py-2 rounded-none text-sm font-medium transition-all">Categories</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-(--color-text-muted) hover:text-gray-900 transition-colors text-sm">Sign In</Link>
            <Link href="/register" className="btn-primary text-white px-5 py-2 rounded-none text-sm font-medium">Get Started</Link>
          </div>
        </div>
      </nav>

      {isFiltering ? (
        <FilterHero
          tierFilter={tierFilter}
          activeCategory={activeCategory}
          searchQuery={searchQuery}
          categorySlug={categorySlug}
          sortValue={sortValue}
        />
      ) : (
        <PremiumHero
          totalServices={totalServices}
          realCoders={realCoders}
          totalDeliveries={totalDeliveries}
        />
      )}

      {/* Featured strips — only on landing variant */}
      {!isFiltering && (
        <>
          {/* Two paths: Buy or Build */}
          <section className="container mx-auto px-4 py-14">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <span className="text-green-600 text-xs font-bold tracking-[0.2em] uppercase">Two ways forward</span>
              <h2 className="text-3xl md:text-4xl font-bold mt-2 mb-3">Buy it. Or build it.</h2>
              <p className="text-(--color-text-secondary) text-base">
                Need a working app today? Browse code that's ready to download.
                Need it tailored exactly to you? Hire a developer with escrow protection.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* BUY card */}
              <Link
                href="/products"
                className="group relative bg-white border border-gray-200 hover:border-green-300 transition-all p-8 overflow-hidden"
              >
                <div className="absolute -top-12 -right-12 w-44 h-44 bg-green-50 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-500" />
                <div className="relative">
                  <div className="inline-flex items-center justify-center h-12 w-12 bg-green-600 text-white mb-5">
                    <ShoppingBag className="h-6 w-6" />
                  </div>
                  <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-green-700 mb-2">Buy ready-made</p>
                  <h3 className="text-2xl font-bold mb-3">Code that ships today</h3>
                  <p className="text-(--color-text-secondary) text-sm leading-relaxed mb-6">
                    Thousands of scripts, themes, and full applications.
                    Every upload is fingerprinted and quality-scored. Download instantly, ship today.
                  </p>
                  <ul className="space-y-2 text-sm text-(--color-text-primary) mb-6">
                    <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" /> Instant download</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" /> Original-author verified</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" /> Refund window</li>
                  </ul>
                  <span className="inline-flex items-center gap-2 text-green-700 font-semibold text-sm group-hover:gap-3 transition-all">
                    Browse the marketplace <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>

              {/* BUILD card */}
              <a
                href="#hire-services"
                className="group relative bg-gradient-to-br from-gray-900 to-gray-800 text-white border border-gray-900 transition-all p-8 overflow-hidden"
              >
                <div className="absolute -top-12 -right-12 w-44 h-44 bg-purple-600/20 rounded-full group-hover:scale-110 transition-transform duration-500" />
                <div className="relative">
                  <div className="inline-flex items-center justify-center h-12 w-12 bg-white text-gray-900 mb-5">
                    <Hammer className="h-6 w-6" />
                  </div>
                  <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-purple-300 mb-2">Hire a developer</p>
                  <h3 className="text-2xl font-bold mb-3">Built exactly for you</h3>
                  <p className="text-gray-300 text-sm leading-relaxed mb-6">
                    Fixed-scope gigs from <strong>Vibe Coders</strong> or vetted engagements
                    with <strong>Real Coders</strong> — Pro &amp; Elite sellers only. Funds held in escrow until you accept.
                  </p>
                  <ul className="space-y-2 text-sm mb-6">
                    <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" /> Escrow protection</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" /> Direct messaging</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" /> Revisions included</li>
                  </ul>
                  <span className="inline-flex items-center gap-2 text-white font-semibold text-sm group-hover:gap-3 transition-all">
                    See available developers <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </a>
            </div>
          </section>

          {/* Tier breakdown */}
          <section className="bg-gray-50 border-y border-gray-100">
            <div className="container mx-auto px-4 py-14">
              <div className="text-center max-w-2xl mx-auto mb-10">
                <span className="text-green-600 text-xs font-bold tracking-[0.2em] uppercase">Two tiers, one quality bar</span>
                <h2 className="text-3xl md:text-4xl font-bold mt-2 mb-3">Pick the right kind of help</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Link
                  href="/hire?tier=vibe"
                  className="group bg-white border border-gray-200 hover:border-amber-300 p-7 transition-all"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="inline-flex items-center gap-2 bg-amber-500 text-white text-xs font-semibold px-3 py-1.5">
                      <Zap className="h-3.5 w-3.5" /> Vibe Coder
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Fast, fixed-scope gigs</h3>
                  <p className="text-(--color-text-secondary) text-sm leading-relaxed mb-4">
                    Open to all approved sellers. Great for landing pages, scripts, bug fixes,
                    Stripe integrations, anything with a clear deliverable.
                  </p>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <p className="text-(--color-text-muted) uppercase tracking-wider text-[10px] mb-0.5">Starts</p>
                      <p className="font-bold text-gray-900">$5</p>
                    </div>
                    <div>
                      <p className="text-(--color-text-muted) uppercase tracking-wider text-[10px] mb-0.5">Delivery</p>
                      <p className="font-bold text-gray-900">1–14 days</p>
                    </div>
                    <div>
                      <p className="text-(--color-text-muted) uppercase tracking-wider text-[10px] mb-0.5">Pricing</p>
                      <p className="font-bold text-gray-900">Fixed</p>
                    </div>
                  </div>
                </Link>

                <Link
                  href="/hire?tier=real"
                  className="group relative bg-white border border-gray-200 hover:border-purple-300 p-7 transition-all overflow-hidden"
                >
                  <div className="absolute top-3 right-3 text-[10px] font-bold tracking-wider uppercase bg-purple-100 text-purple-700 px-2 py-0.5">
                    Pro &amp; Elite only
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="inline-flex items-center gap-2 bg-purple-600 text-white text-xs font-semibold px-3 py-1.5">
                      <Gem className="h-3.5 w-3.5" /> Real Coder
                    </div>
                  </div>
                  <h3 className="text-xl font-bold mb-2">Vetted engineering talent</h3>
                  <p className="text-(--color-text-secondary) text-sm leading-relaxed mb-4">
                    Reserved for sellers who've passed our quality gate. Great for full apps,
                    SaaS builds, integrations, and anything where <em>code quality matters</em>.
                  </p>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <p className="text-(--color-text-muted) uppercase tracking-wider text-[10px] mb-0.5">Starts</p>
                      <p className="font-bold text-gray-900">$50/hr</p>
                    </div>
                    <div>
                      <p className="text-(--color-text-muted) uppercase tracking-wider text-[10px] mb-0.5">Delivery</p>
                      <p className="font-bold text-gray-900">Project-based</p>
                    </div>
                    <div>
                      <p className="text-(--color-text-muted) uppercase tracking-wider text-[10px] mb-0.5">Pricing</p>
                      <p className="font-bold text-gray-900">Fixed or hourly</p>
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          </section>

          {/* How it works */}
          <section className="container mx-auto px-4 py-14">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <span className="text-green-600 text-xs font-bold tracking-[0.2em] uppercase">How it works</span>
              <h2 className="text-3xl md:text-4xl font-bold mt-2 mb-3">From brief to delivery in 4 steps</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              <Step n={1} icon={<Search className="h-5 w-5" />} title="Browse">
                Filter by tier, category, or sort by top-rated. Every seller has a quality score.
              </Step>
              <Step n={2} icon={<MessageSquare className="h-5 w-5" />} title="Brief">
                Write what you need. Pay safely — funds are held in escrow until delivery.
              </Step>
              <Step n={3} icon={<Hammer className="h-5 w-5" />} title="Build">
                Direct messaging with your developer. Request revisions or open a dispute if needed.
              </Step>
              <Step n={4} icon={<Rocket className="h-5 w-5" />} title="Accept">
                Review the work. Accept to release funds. Leave a review for the next buyer.
              </Step>
            </div>
          </section>

          {/* Trust band */}
          <section className="bg-gradient-to-br from-green-50 via-white to-green-50/50 border-y border-green-100">
            <div className="container mx-auto px-4 py-12">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                <Trust icon={<Shield className="h-6 w-6 text-green-600" />} label="Escrow protected" sub="Funds held until you accept" />
                <Trust icon={<Award className="h-6 w-6 text-green-600" />} label="Quality scored" sub="AI-graded code on every upload" />
                <Trust icon={<Lock className="h-6 w-6 text-green-600" />} label="Original work" sub="Fingerprinted against theft" />
                <Trust icon={<Users className="h-6 w-6 text-green-600" />} label="Vetted Real Coders" sub="Pro &amp; Elite tier only" />
              </div>
            </div>
          </section>

          {/* Featured Real Coders */}
          {featuredReal.length > 0 && (
            <FeaturedStrip
              eyebrow="Featured Real Coders"
              title="Hand-picked engineering talent"
              subtitle="Vetted Pro and Elite sellers tackling production-grade builds."
              services={featuredReal}
              ctaHref="/hire?tier=real"
              ctaLabel="Browse all Real Coders"
            />
          )}

          {/* Top rated */}
          {topRated.length > 0 && (
            <FeaturedStrip
              eyebrow="Top rated"
              title="What buyers love right now"
              subtitle="The highest-reviewed services across both tiers."
              services={topRated}
              ctaHref="/hire?sort=rating"
              ctaLabel="See all top-rated services"
              variant="grid"
            />
          )}

          {/* Featured Vibe Coders */}
          {featuredVibe.length > 0 && (
            <FeaturedStrip
              eyebrow="Featured Vibe Coders"
              title="Quick wins, fixed prices"
              subtitle="Fast-turnaround gigs from approved sellers."
              services={featuredVibe}
              ctaHref="/hire?tier=vibe"
              ctaLabel="Browse all Vibe Coders"
            />
          )}
        </>
      )}

      {/* Main browse — always rendered, anchor for the Build CTA */}
      <div id="hire-services" className="container mx-auto px-4 py-12 scroll-mt-20">
        {!isFiltering && (
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-green-600 text-xs font-bold tracking-[0.2em] uppercase">All services</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-2 mb-3">Browse every developer</h2>
            <p className="text-(--color-text-secondary) text-base">
              Filter by tier, category, or budget. Every result is a real seller with a public profile.
            </p>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <aside className="lg:w-64 flex-shrink-0">
            <div className="lg:sticky lg:top-20">
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-(--color-text-secondary) uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" /> Tier
                </h3>
                <div className="flex flex-wrap lg:flex-col gap-2">
                  <Link
                    href={buildUrl({ tier: undefined })}
                    className={`text-sm px-3.5 py-2 rounded-none transition-all flex items-center gap-2 ${
                      !tierFilter ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-(--color-text-muted) hover:text-green-700 hover:border-green-200 hover:bg-green-50'
                    }`}
                  >
                    All Tiers
                  </Link>
                  <Link
                    href={buildUrl({ tier: 'vibe' })}
                    className={`text-sm px-3.5 py-2 rounded-none transition-all flex items-center gap-2 ${
                      tierFilter === 'vibe' ? 'bg-amber-500 text-white' : 'bg-white border border-gray-200 text-(--color-text-muted) hover:text-amber-700 hover:border-amber-200 hover:bg-amber-50'
                    }`}
                  >
                    <Zap className="h-3.5 w-3.5" /> Vibe Coder
                  </Link>
                  <Link
                    href={buildUrl({ tier: 'real' })}
                    className={`text-sm px-3.5 py-2 rounded-none transition-all flex items-center gap-2 ${
                      tierFilter === 'real' ? 'bg-purple-600 text-white' : 'bg-white border border-gray-200 text-(--color-text-muted) hover:text-purple-700 hover:border-purple-200 hover:bg-purple-50'
                    }`}
                  >
                    <Gem className="h-3.5 w-3.5" /> Real Coder
                  </Link>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-semibold text-(--color-text-secondary) uppercase tracking-wider mb-3 flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4" /> Sort By
                </h3>
                <div className="flex flex-wrap lg:flex-col gap-2">
                  {SORT_OPTIONS.map((option) => (
                    <Link
                      key={option.value}
                      href={buildUrl({ sort: option.value === 'newest' ? undefined : option.value })}
                      className={`text-sm px-3.5 py-2 rounded-none transition-all ${
                        sortValue === option.value
                          ? 'bg-green-600 text-white'
                          : 'bg-white border border-gray-200 text-(--color-text-muted) hover:text-green-700 hover:border-green-200 hover:bg-green-50'
                      }`}
                    >
                      {option.label}
                    </Link>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-(--color-text-secondary) uppercase tracking-wider mb-3 flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4" /> Categories
                </h3>
                <div className="flex flex-wrap lg:flex-col gap-2">
                  <Link
                    href={buildUrl({ category: undefined })}
                    className={`text-sm px-3.5 py-2 rounded-none transition-all ${
                      !categorySlug ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-(--color-text-muted) hover:text-green-700 hover:border-green-200 hover:bg-green-50'
                    }`}
                  >
                    All Categories
                  </Link>
                  {safeCategories.map((cat) => (
                    <Link
                      key={cat.id}
                      href={buildUrl({ category: cat.slug })}
                      className={`text-sm px-3.5 py-2 rounded-none transition-all flex items-center gap-2 ${
                        categorySlug === cat.slug ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-(--color-text-muted) hover:text-green-700 hover:border-green-200 hover:bg-green-50'
                      }`}
                    >
                      {cat.icon && <span>{cat.icon}</span>}
                      {cat.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Grid */}
          <main className="flex-1">
            <div className="flex items-center justify-between mb-6">
              <p className="text-(--color-text-secondary) text-sm">
                <span className="text-gray-900 font-medium">{rows.length}</span>{' '}
                service{rows.length !== 1 ? 's' : ''} available
                {searchQuery && <span> for &quot;<span className="text-green-600">{searchQuery}</span>&quot;</span>}
              </p>
            </div>

            {rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 rounded-none bg-green-50 flex items-center justify-center mb-5">
                  <Briefcase className="h-10 w-10 text-(--color-text-secondary)" />
                </div>
                <h2 className="text-xl font-semibold mb-2 text-gray-900">No services found</h2>
                <p className="text-(--color-text-secondary) max-w-md mb-6">
                  {searchQuery
                    ? `We couldn't find any services matching "${searchQuery}". Try adjusting your search or filters.`
                    : 'No services match your current filters. Try clearing filters or a different tier.'}
                </p>
                <Link href="/hire" className="btn-primary text-white px-6 py-2.5 rounded-none text-sm font-medium">
                  Clear All Filters
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {rows.map((s) => <ServiceCard key={s.id} service={s} />)}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Closing CTA */}
      {!isFiltering && (
        <section className="border-t border-gray-100">
          <div className="container mx-auto px-4 py-16 text-center max-w-2xl">
            <TrendingUp className="h-10 w-10 text-green-600 mx-auto mb-4" />
            <h2 className="text-3xl md:text-4xl font-bold mb-3">Ready to ship something?</h2>
            <p className="text-(--color-text-secondary) text-base mb-6">
              Whether you buy a $19 script or hire a Real Coder for a 6-week build,
              CodeVault has your back with escrow, quality scores, and refund protection.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/products" className="btn-primary text-white px-6 py-3 rounded-none text-sm font-semibold inline-flex items-center justify-center gap-2">
                <ShoppingBag className="h-4 w-4" /> Browse the marketplace
              </Link>
              <a href="#hire-services" className="border border-gray-300 hover:border-green-300 hover:text-green-700 text-gray-900 px-6 py-3 rounded-none text-sm font-semibold inline-flex items-center justify-center gap-2">
                <Hammer className="h-4 w-4" /> Find a developer
              </a>
            </div>
          </div>
        </section>
      )}

      <footer className="border-t border-gray-100">
        <div className="container mx-auto px-4 py-8 text-center text-(--color-text-secondary) text-sm">
          &copy; {new Date().getFullYear()} CodeVault by Solaris Empire Inc. All rights reserved.
        </div>
      </footer>
    </div>
  )
}

// ─── Hero variants ─────────────────────────────────────────────────

function PremiumHero({
  totalServices, realCoders, totalDeliveries,
}: {
  totalServices: number
  realCoders: number
  totalDeliveries: number
}) {
  return (
    <section className="relative overflow-hidden border-b border-gray-100">
      {/* Decorative background */}
      <div className="absolute inset-0 bg-gradient-to-br from-green-50/60 via-white to-purple-50/30" />
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-green-100 rounded-full blur-3xl opacity-40" />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-purple-100 rounded-full blur-3xl opacity-30" />

      <div className="container mx-auto px-4 py-16 md:py-20 relative">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-white border border-green-200 px-3 py-1.5 mb-5">
            <span className="h-1.5 w-1.5 bg-green-500 rounded-full" />
            <span className="text-xs font-semibold tracking-wider uppercase text-green-700">
              Top developers, vetted by code
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-5">
            The marketplace where{' '}
            <span className="text-green-600">code is currency</span>.
          </h1>
          <p className="text-lg text-(--color-text-secondary) max-w-2xl leading-relaxed mb-7">
            Buy ready-made scripts, themes, and full apps — or hire a vetted developer
            to build it exactly how you want. Every seller is quality-scored.
            Every dollar is escrow-protected.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mb-10">
            <a
              href="#hire-services"
              className="btn-primary text-white px-6 py-3.5 rounded-none text-sm font-semibold inline-flex items-center justify-center gap-2"
            >
              <Hammer className="h-4 w-4" /> Hire a developer
            </a>
            <Link
              href="/products"
              className="bg-white border border-gray-300 hover:border-green-300 hover:text-green-700 text-gray-900 px-6 py-3.5 rounded-none text-sm font-semibold inline-flex items-center justify-center gap-2"
            >
              <ShoppingBag className="h-4 w-4" /> Buy ready-made code
            </Link>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-6 max-w-xl pt-6 border-t border-gray-200">
            <Stat value={totalServices} label="Services live" />
            <Stat value={realCoders} label="Real Coders" />
            <Stat value={totalDeliveries} label="Total deliveries" />
          </div>
        </div>
      </div>
    </section>
  )
}

function FilterHero({
  tierFilter, activeCategory, searchQuery, categorySlug, sortValue,
}: {
  tierFilter: string
  activeCategory: CategoryRow | undefined
  searchQuery: string
  categorySlug: string
  sortValue: SortValue
}) {
  return (
    <section className="border-b border-gray-100 bg-green-50/30">
      <div className="container mx-auto px-4 py-10">
        <span className="text-green-600 text-sm font-semibold tracking-wider uppercase mb-2 block">
          {tierFilter === 'real' ? 'Real Coder' : tierFilter === 'vibe' ? 'Vibe Coder' : activeCategory ? 'Category' : 'Hire a Developer'}
        </span>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
          {tierFilter === 'real'
            ? 'Vetted engineering talent'
            : tierFilter === 'vibe'
              ? 'Fast fixed-scope gigs'
              : activeCategory
                ? activeCategory.name
                : 'Hire verified developers'}
        </h1>
        <p className="text-(--color-text-secondary) max-w-2xl">
          Every seller is quality-scored. Funds are held in escrow until you accept the delivery.
        </p>

        <form action="/hire" method="GET" className="mt-6 flex gap-3 max-w-2xl">
          {categorySlug && <input type="hidden" name="category" value={categorySlug} />}
          {tierFilter && <input type="hidden" name="tier" value={tierFilter} />}
          {sortValue !== 'newest' && <input type="hidden" name="sort" value={sortValue} />}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-(--color-text-secondary)" />
            <input
              type="text"
              name="search"
              defaultValue={searchQuery}
              placeholder="Search services..."
              className="w-full bg-white border border-gray-200 rounded-none pl-10 pr-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-200 transition-all"
            />
          </div>
          <button type="submit" className="btn-primary text-white px-6 py-3 rounded-none text-sm font-medium">Search</button>
        </form>
      </div>
    </section>
  )
}

// ─── Reusable bits ─────────────────────────────────────────────────

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="text-2xl md:text-3xl font-bold text-gray-900">
        {value.toLocaleString()}
        <span className="text-green-600">+</span>
      </p>
      <p className="text-xs text-(--color-text-muted) uppercase tracking-wider mt-1">{label}</p>
    </div>
  )
}

function Step({
  n, icon, title, children,
}: {
  n: number
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white border border-gray-200 p-6 relative">
      <span className="absolute -top-3 left-6 bg-green-600 text-white text-xs font-bold px-2.5 py-1 tracking-wider">
        STEP {n}
      </span>
      <div className="inline-flex items-center justify-center h-10 w-10 bg-green-50 text-green-700 mb-4 mt-2">
        {icon}
      </div>
      <h3 className="font-bold text-lg mb-2">{title}</h3>
      <p className="text-sm text-(--color-text-secondary) leading-relaxed">{children}</p>
    </div>
  )
}

function Trust({ icon, label, sub }: { icon: React.ReactNode; label: string; sub: string }) {
  return (
    <div>
      <div className="inline-flex items-center justify-center h-12 w-12 bg-white border border-green-100 mb-3">
        {icon}
      </div>
      <p className="font-semibold text-sm text-gray-900">{label}</p>
      <p className="text-xs text-(--color-text-secondary) mt-0.5">{sub}</p>
    </div>
  )
}

function FeaturedStrip({
  eyebrow, title, subtitle, services, ctaHref, ctaLabel, variant = 'horizontal',
}: {
  eyebrow: string
  title: string
  subtitle: string
  services: SellerServiceListRow[]
  ctaHref: string
  ctaLabel: string
  variant?: 'horizontal' | 'grid'
}) {
  return (
    <section className="container mx-auto px-4 py-14">
      <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
        <div className="max-w-xl">
          <span className="text-green-600 text-xs font-bold tracking-[0.2em] uppercase">{eyebrow}</span>
          <h2 className="text-2xl md:text-3xl font-bold mt-1.5 mb-2">{title}</h2>
          <p className="text-(--color-text-secondary) text-sm">{subtitle}</p>
        </div>
        <Link href={ctaHref} className="text-sm font-semibold text-green-700 hover:text-green-800 inline-flex items-center gap-1.5">
          {ctaLabel} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className={
        variant === 'grid'
          ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
          : 'grid grid-cols-1 md:grid-cols-3 gap-4'
      }>
        {services.map((s) => <ServiceCard key={s.id} service={s} />)}
      </div>
    </section>
  )
}

function ServiceCard({ service }: { service: SellerServiceListRow }) {
  const priceLabel = service.pricing_model === 'hourly'
    ? `$${((service.hourly_rate_cents || 0) / 100).toFixed(0)}/hr`
    : `$${(service.price_cents / 100).toFixed(2)}`

  const sellerTier = (service.seller?.seller_tier ?? null) as SellerTier | null

  return (
    <Link href={`/hire/${service.slug}`} className="product-card group">
      <div className="aspect-[16/10] bg-gray-50 relative overflow-hidden">
        {service.thumbnail_url ? (
          <img
            src={service.thumbnail_url}
            alt={service.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-green-50 to-white">
            <Briefcase className="h-10 w-10 text-green-300" />
          </div>
        )}
        <div className="absolute top-3 left-3">
          {service.tier === 'real' ? (
            <span className="inline-flex items-center gap-1 bg-purple-600 text-white text-xs font-medium px-2.5 py-1 rounded-none">
              <Gem className="h-3 w-3" /> Real Coder
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 bg-amber-500 text-white text-xs font-medium px-2.5 py-1 rounded-none">
              <Zap className="h-3 w-3" /> Vibe Coder
            </span>
          )}
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 group-hover:text-green-700 transition-colors line-clamp-2 min-h-[3rem]">
          {service.title}
        </h3>
        <div className="flex items-center gap-1.5 flex-wrap mt-2">
          <p className="text-(--color-text-secondary) text-sm line-clamp-1">
            by {service.seller?.display_name || 'Unknown'}
          </p>
          <SellerRankBadge rankKey={service.seller?.seller_rank_key} size="inline" />
          {sellerTier && sellerTier !== 'unverified' && (
            <SellerTierBadge tier={sellerTier} size="avatar" />
          )}
        </div>
        {service.category && (
          <span className="inline-block mt-2 text-xs bg-gray-100 text-(--color-text-muted) px-2.5 py-0.5 rounded-none">
            {service.category.name}
          </span>
        )}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-(--color-text-muted)">
              {service.pricing_model === 'hourly' ? 'From' : 'Fixed'}
            </p>
            <span className="text-lg font-bold text-green-600">{priceLabel}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-(--color-text-secondary)">
            {(service.review_count || 0) > 0 && (
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {(service.avg_rating || 0).toFixed(1)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {service.delivery_days}d
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

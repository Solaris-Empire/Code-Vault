import Link from 'next/link'
import {
  Code2,
  Download,
  Search,
  Star,
  SlidersHorizontal,
  Sparkles,
  ArrowUpDown,
  Package,
} from 'lucide-react'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Browse Marketplace | CodeVault',
  description:
    'Discover thousands of premium scripts, templates, themes, and plugins on CodeVault.',
}

export const revalidate = 60

interface ProductRow {
  id: string
  title: string
  slug: string
  short_description: string | null
  price_cents: number
  thumbnail_url: string | null
  download_count: number
  avg_rating: number | null
  review_count: number
  is_featured: boolean
  tags: string[] | null
  created_at: string
  seller: { display_name: string } | null
  category: { name: string; slug: string } | null
}

interface CategoryRow {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  sort_order: number
}

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'rating', label: 'Top Rated' },
] as const

type SortValue = (typeof SORT_OPTIONS)[number]['value']

function getSortConfig(sort: SortValue): { column: string; ascending: boolean } {
  switch (sort) {
    case 'price_asc':
      return { column: 'price_cents', ascending: true }
    case 'price_desc':
      return { column: 'price_cents', ascending: false }
    case 'popular':
      return { column: 'download_count', ascending: false }
    case 'rating':
      return { column: 'avg_rating', ascending: false }
    case 'newest':
    default:
      return { column: 'created_at', ascending: false }
  }
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string
    category?: string
    sort?: string
    featured?: string
  }>
}) {
  const params = await searchParams

  const searchQuery = params.search?.trim() || ''
  const categorySlug = params.category?.trim() || ''
  const featuredOnly = params.featured === 'true'
  const sortValue: SortValue = SORT_OPTIONS.some((o) => o.value === params.sort)
    ? (params.sort as SortValue)
    : 'newest'

  const supabase = getSupabaseAdmin()

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, slug, description, icon, sort_order')
    .order('sort_order', { ascending: true })

  const safeCategories: CategoryRow[] = (categories as CategoryRow[] | null) || []

  let query = supabase
    .from('products')
    .select(
      `id, title, slug, short_description, price_cents, thumbnail_url,
       download_count, avg_rating, review_count, is_featured, tags, created_at,
       seller:users!products_seller_id_fkey(display_name),
       category:categories!products_category_id_fkey(name, slug)`
    )
    .eq('status', 'approved')

  if (searchQuery) {
    query = query.ilike('title', `%${searchQuery}%`)
  }

  if (categorySlug) {
    const matchingCategory = safeCategories.find((c) => c.slug === categorySlug)
    if (matchingCategory) {
      query = query.eq('category_id', matchingCategory.id)
    }
  }

  if (featuredOnly) {
    query = query.eq('is_featured', true)
  }

  const sortConfig = getSortConfig(sortValue)
  query = query.order(sortConfig.column, { ascending: sortConfig.ascending }).limit(48)

  const { data: products } = await query

  const safeProducts: ProductRow[] = (products as ProductRow[] | null) || []

  function buildUrl(overrides: Record<string, string | undefined>): string {
    const p = new URLSearchParams()
    if (searchQuery) p.set('search', searchQuery)
    if (categorySlug) p.set('category', categorySlug)
    if (sortValue !== 'newest') p.set('sort', sortValue)
    if (featuredOnly) p.set('featured', 'true')
    for (const [key, val] of Object.entries(overrides)) {
      if (val === undefined || val === '') {
        p.delete(key)
      } else {
        p.set(key, val)
      }
    }
    const qs = p.toString()
    return `/products${qs ? `?${qs}` : ''}`
  }

  const activeCategory = safeCategories.find((c) => c.slug === categorySlug)

  return (
    <div className="min-h-screen bg-[#050510] text-white">
      {/* Nav */}
      <nav className="glass-nav sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="relative">
              <Code2 className="h-7 w-7 text-violet-400" />
              <div className="absolute inset-0 bg-violet-500/20 blur-lg rounded-full" />
            </div>
            <span className="text-xl font-bold tracking-tight">CodeVault</span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            <Link href="/products" className="text-violet-300 bg-violet-500/10 px-3.5 py-2 rounded-lg text-sm font-medium transition-all">
              Browse
            </Link>
            <Link href="/categories" className="text-gray-400 hover:text-white px-3.5 py-2 rounded-lg text-sm font-medium hover:bg-white/5 transition-all">
              Categories
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-gray-400 hover:text-white transition-colors text-sm">
              Sign In
            </Link>
            <Link href="/register" className="btn-premium text-white px-5 py-2 rounded-lg text-sm font-medium">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Page Header */}
      <section className="relative border-b border-white/[0.04]">
        <div className="absolute inset-0 bg-gradient-to-b from-violet-950/20 to-transparent" />
        <div className="container mx-auto px-4 py-10 relative">
          <span className="text-violet-400 text-sm font-semibold tracking-wider uppercase mb-2 block">
            {featuredOnly ? 'Curated' : activeCategory ? 'Category' : 'Marketplace'}
          </span>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
            {featuredOnly
              ? 'Featured Items'
              : activeCategory
                ? activeCategory.name
                : 'Browse Marketplace'}
          </h1>
          <p className="text-gray-500">
            {featuredOnly
              ? 'Hand-picked premium code by our team'
              : activeCategory
                ? `Explore ${activeCategory.name} scripts, templates & tools`
                : 'Discover premium scripts, templates, themes & plugins'}
          </p>

          {/* Search */}
          <form action="/products" method="GET" className="mt-6 flex gap-3 max-w-2xl">
            {categorySlug && <input type="hidden" name="category" value={categorySlug} />}
            {sortValue !== 'newest' && <input type="hidden" name="sort" value={sortValue} />}
            {featuredOnly && <input type="hidden" name="featured" value="true" />}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                type="text"
                name="search"
                defaultValue={searchQuery}
                placeholder="Search products..."
                className="w-full glass-surface rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500/30 focus:ring-1 focus:ring-violet-500/20 transition-all"
              />
            </div>
            <button
              type="submit"
              className="btn-premium text-white px-6 py-3 rounded-xl text-sm font-medium"
            >
              Search
            </button>
          </form>
        </div>
      </section>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <aside className="lg:w-64 flex-shrink-0">
            {/* Sort */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4" />
                Sort By
              </h3>
              <div className="flex flex-wrap lg:flex-col gap-2">
                {SORT_OPTIONS.map((option) => (
                  <Link
                    key={option.value}
                    href={buildUrl({ sort: option.value === 'newest' ? undefined : option.value })}
                    className={`text-sm px-3.5 py-2 rounded-lg transition-all ${
                      sortValue === option.value
                        ? 'btn-premium text-white'
                        : 'glass-surface text-gray-400 hover:text-white hover:border-violet-500/20'
                    }`}
                  >
                    {option.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Categories */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                Categories
              </h3>
              <div className="flex flex-wrap lg:flex-col gap-2">
                <Link
                  href={buildUrl({ category: undefined })}
                  className={`text-sm px-3.5 py-2 rounded-lg transition-all ${
                    !categorySlug
                      ? 'btn-premium text-white'
                      : 'glass-surface text-gray-400 hover:text-white hover:border-violet-500/20'
                  }`}
                >
                  All Categories
                </Link>
                {safeCategories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={buildUrl({ category: cat.slug })}
                    className={`text-sm px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 ${
                      categorySlug === cat.slug
                        ? 'btn-premium text-white'
                        : 'glass-surface text-gray-400 hover:text-white hover:border-violet-500/20'
                    }`}
                  >
                    {cat.icon && <span>{cat.icon}</span>}
                    {cat.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* Featured toggle */}
            <div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Quick Filters
              </h3>
              <Link
                href={buildUrl({ featured: featuredOnly ? undefined : 'true' })}
                className={`text-sm px-3.5 py-2 rounded-lg transition-all inline-flex items-center gap-2 ${
                  featuredOnly
                    ? 'btn-premium text-white'
                    : 'glass-surface text-gray-400 hover:text-white hover:border-violet-500/20'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Featured Only
              </Link>
            </div>
          </aside>

          {/* Product Grid */}
          <main className="flex-1">
            <div className="flex items-center justify-between mb-6">
              <p className="text-gray-400 text-sm">
                <span className="text-white font-medium">{safeProducts.length}</span>{' '}
                product{safeProducts.length !== 1 ? 's' : ''} found
                {searchQuery && (
                  <span>
                    {' '}for &quot;<span className="text-violet-400">{searchQuery}</span>&quot;
                  </span>
                )}
              </p>
            </div>

            {safeProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-5">
                  <Package className="h-10 w-10 text-gray-600" />
                </div>
                <h2 className="text-xl font-semibold mb-2">No products found</h2>
                <p className="text-gray-500 max-w-md mb-6">
                  {searchQuery
                    ? `We couldn't find any products matching "${searchQuery}". Try adjusting your search or filters.`
                    : 'No products match your current filters. Try selecting a different category or removing filters.'}
                </p>
                <Link
                  href="/products"
                  className="btn-premium text-white px-6 py-2.5 rounded-xl text-sm font-medium"
                >
                  Clear All Filters
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {safeProducts.map((product) => (
                  <Link
                    key={product.id}
                    href={`/products/${product.slug}`}
                    className="product-card glass-card group rounded-xl overflow-hidden"
                  >
                    <div className="aspect-[16/10] bg-[#0a0a1a] relative overflow-hidden">
                      {product.thumbnail_url ? (
                        <img
                          src={product.thumbnail_url}
                          alt={product.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Code2 className="h-10 w-10 text-gray-700" />
                        </div>
                      )}
                      {product.is_featured && (
                        <div className="absolute top-3 left-3 bg-violet-600/90 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          Featured
                        </div>
                      )}
                    </div>

                    <div className="p-4 relative z-10">
                      <h3 className="font-semibold text-white group-hover:text-violet-300 transition-colors line-clamp-1">
                        {product.title}
                      </h3>
                      <p className="text-gray-500 text-sm mt-1 line-clamp-1">
                        by {product.seller?.display_name || 'Unknown Seller'}
                      </p>
                      {product.category && (
                        <span className="inline-block mt-2 text-xs bg-white/[0.04] text-gray-400 px-2.5 py-0.5 rounded-full border border-white/[0.04]">
                          {product.category.name}
                        </span>
                      )}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.04]">
                        <span className="text-lg font-bold text-gradient">
                          ${(product.price_cents / 100).toFixed(2)}
                        </span>
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                            {product.avg_rating?.toFixed(1) || '0.0'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Download className="h-3.5 w-3.5" />
                            {product.download_count.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/[0.04] mt-16">
        <div className="container mx-auto px-4 py-8 text-center text-gray-600 text-sm">
          &copy; {new Date().getFullYear()} CodeVault by Solaris Empire Inc. All rights reserved.
        </div>
      </footer>
    </div>
  )
}

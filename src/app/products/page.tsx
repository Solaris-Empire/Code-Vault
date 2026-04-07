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

// ---------- SEO Metadata ----------
// This tells search engines what the page is about and shows up in browser tabs
export const metadata: Metadata = {
  title: 'Browse Marketplace | CodeVault',
  description:
    'Discover thousands of premium scripts, templates, themes, and plugins on CodeVault.',
}

// ---------- ISR (Incremental Static Regeneration) ----------
// The page is statically generated but re-built in the background every 60 seconds.
// This gives us blazing-fast loads while keeping data reasonably fresh.
export const revalidate = 60

// ---------- TypeScript types ----------
// We define the shape of a product row after Supabase joins so TypeScript
// can catch typos and missing fields at compile time (no `any` allowed!).
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
  // Supabase returns joined rows as objects (or null if the FK is missing)
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

// ---------- Valid sort options ----------
// We whitelist these so nobody can inject random column names into our query.
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'rating', label: 'Top Rated' },
] as const

type SortValue = (typeof SORT_OPTIONS)[number]['value']

// ---------- Helper: get the order column and direction for sorting ----------
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

// ---------- Page Component ----------
// Next.js App Router passes `searchParams` as a prop to page components.
// We destructure the filters we care about from the URL query string.
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
  // In Next.js 15+, searchParams is a Promise — we await it
  const params = await searchParams

  // Safely extract & sanitise query params
  const searchQuery = params.search?.trim() || ''
  const categorySlug = params.category?.trim() || ''
  const featuredOnly = params.featured === 'true'
  // Default to 'newest' if the user passes an invalid sort value
  const sortValue: SortValue = SORT_OPTIONS.some((o) => o.value === params.sort)
    ? (params.sort as SortValue)
    : 'newest'

  // ---- Fetch categories for the sidebar filter ----
  const supabase = getSupabaseAdmin()

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, slug, description, icon, sort_order')
    .order('sort_order', { ascending: true })

  const safeCategories: CategoryRow[] = (categories as CategoryRow[] | null) || []

  // ---- Build the products query ----
  // We select every field we need, plus join seller (users) and category (categories).
  // The join syntax `seller:users(display_name)` tells Supabase to follow the FK and
  // rename the nested object to "seller" so our TypeScript type matches.
  let query = supabase
    .from('products')
    .select(
      `id, title, slug, short_description, price_cents, thumbnail_url,
       download_count, avg_rating, review_count, is_featured, tags, created_at,
       seller:users!products_seller_id_fkey(display_name),
       category:categories!products_category_id_fkey(name, slug)`
    )
    .eq('status', 'approved') // Only show approved products — never drafts or rejected

  // Apply optional filters based on what the user selected
  if (searchQuery) {
    // ilike = case-insensitive LIKE search. The % wildcards match anything before/after.
    query = query.ilike('title', `%${searchQuery}%`)
  }

  if (categorySlug) {
    // Filter by the category's slug via the joined categories table.
    // We look up the matching category first, then filter by its id.
    const matchingCategory = safeCategories.find((c) => c.slug === categorySlug)
    if (matchingCategory) {
      query = query.eq('category_id', matchingCategory.id)
    }
  }

  if (featuredOnly) {
    query = query.eq('is_featured', true)
  }

  // Apply the chosen sort order and limit results
  const sortConfig = getSortConfig(sortValue)
  query = query.order(sortConfig.column, { ascending: sortConfig.ascending }).limit(48)

  const { data: products } = await query

  const safeProducts: ProductRow[] = (products as ProductRow[] | null) || []

  // ---- Helper to build URL with updated search params ----
  // This lets us create filter links that preserve existing params.
  function buildUrl(overrides: Record<string, string | undefined>): string {
    const p = new URLSearchParams()
    // Start from current params
    if (searchQuery) p.set('search', searchQuery)
    if (categorySlug) p.set('category', categorySlug)
    if (sortValue !== 'newest') p.set('sort', sortValue)
    if (featuredOnly) p.set('featured', 'true')
    // Apply overrides (undefined = remove the param)
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

  // ---- Active category name (for display) ----
  const activeCategory = safeCategories.find((c) => c.slug === categorySlug)

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* ===== Navigation Bar ===== */}
      {/* Sticky nav at the top — same pattern as the homepage so the site feels consistent */}
      <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Code2 className="h-7 w-7 text-violet-500" />
            <span className="text-xl font-bold">CodeVault</span>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <Link
              href="/products"
              className="text-white font-medium transition-colors"
            >
              Browse
            </Link>
            <Link
              href="/categories"
              className="text-gray-400 hover:text-white transition-colors"
            >
              Categories
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-gray-400 hover:text-white transition-colors text-sm"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* ===== Page Header ===== */}
      <section className="border-b border-gray-800 bg-gray-900/30">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            {featuredOnly
              ? 'Featured Items'
              : activeCategory
                ? activeCategory.name
                : 'Browse Marketplace'}
          </h1>
          <p className="text-gray-400">
            {featuredOnly
              ? 'Hand-picked premium code by our team'
              : activeCategory
                ? `Explore ${activeCategory.name} scripts, templates & tools`
                : 'Discover premium scripts, templates, themes & plugins'}
          </p>

          {/* ---- Search Bar ---- */}
          {/* We use a plain <form> with method GET so the search updates the URL.
              No JavaScript needed — the server re-renders with the new search param. */}
          <form action="/products" method="GET" className="mt-6 flex gap-3 max-w-2xl">
            {/* Preserve existing filters when searching */}
            {categorySlug && (
              <input type="hidden" name="category" value={categorySlug} />
            )}
            {sortValue !== 'newest' && (
              <input type="hidden" name="sort" value={sortValue} />
            )}
            {featuredOnly && (
              <input type="hidden" name="featured" value="true" />
            )}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                type="text"
                name="search"
                defaultValue={searchQuery}
                placeholder="Search products..."
                className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors"
              />
            </div>
            <button
              type="submit"
              className="bg-violet-600 hover:bg-violet-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              Search
            </button>
          </form>
        </div>
      </section>

      {/* ===== Main Content (Sidebar + Product Grid) ===== */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* ---- Sidebar: Category Filters ---- */}
          {/* On mobile this sits above the grid; on lg screens it becomes a fixed-width sidebar */}
          <aside className="lg:w-64 flex-shrink-0">
            {/* Sort dropdown (visible on all screens) */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4" />
                Sort By
              </h3>
              <div className="flex flex-wrap lg:flex-col gap-2">
                {SORT_OPTIONS.map((option) => (
                  <Link
                    key={option.value}
                    href={buildUrl({
                      sort: option.value === 'newest' ? undefined : option.value,
                    })}
                    className={`text-sm px-3 py-2 rounded-lg transition-colors ${
                      sortValue === option.value
                        ? 'bg-violet-600 text-white'
                        : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
                    }`}
                  >
                    {option.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Category filter links */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                Categories
              </h3>
              <div className="flex flex-wrap lg:flex-col gap-2">
                {/* "All" link to clear category filter */}
                <Link
                  href={buildUrl({ category: undefined })}
                  className={`text-sm px-3 py-2 rounded-lg transition-colors ${
                    !categorySlug
                      ? 'bg-violet-600 text-white'
                      : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
                  }`}
                >
                  All Categories
                </Link>
                {safeCategories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={buildUrl({ category: cat.slug })}
                    className={`text-sm px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                      categorySlug === cat.slug
                        ? 'bg-violet-600 text-white'
                        : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
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
                href={buildUrl({
                  featured: featuredOnly ? undefined : 'true',
                })}
                className={`text-sm px-3 py-2 rounded-lg transition-colors inline-flex items-center gap-2 ${
                  featuredOnly
                    ? 'bg-violet-600 text-white'
                    : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Featured Only
              </Link>
            </div>
          </aside>

          {/* ---- Product Grid ---- */}
          <main className="flex-1">
            {/* Results count */}
            <div className="flex items-center justify-between mb-6">
              <p className="text-gray-400 text-sm">
                <span className="text-white font-medium">{safeProducts.length}</span>{' '}
                product{safeProducts.length !== 1 ? 's' : ''} found
                {searchQuery && (
                  <span>
                    {' '}
                    for &quot;<span className="text-violet-400">{searchQuery}</span>&quot;
                  </span>
                )}
              </p>
            </div>

            {/* ---- Empty State ---- */}
            {safeProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Package className="h-16 w-16 text-gray-700 mb-4" />
                <h2 className="text-xl font-semibold mb-2">No products found</h2>
                <p className="text-gray-500 max-w-md mb-6">
                  {searchQuery
                    ? `We couldn't find any products matching "${searchQuery}". Try adjusting your search or filters.`
                    : 'No products match your current filters. Try selecting a different category or removing filters.'}
                </p>
                <Link
                  href="/products"
                  className="bg-violet-600 hover:bg-violet-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  Clear All Filters
                </Link>
              </div>
            ) : (
              /* ---- Product Cards Grid ----
                 Responsive grid:
                 - 1 column on mobile (< 640px)
                 - 2 columns on sm (640px+)
                 - 3 columns on lg (1024px+) — sidebar takes some space
                 - 4 columns on xl (1280px+) */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {safeProducts.map((product) => (
                  <Link
                    key={product.id}
                    href={`/products/${product.slug}`}
                    className="group bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-violet-500/50 transition-all"
                  >
                    {/* ---- Thumbnail ---- */}
                    {/* If the seller uploaded a thumbnail we show it; otherwise we display
                        a Code2 icon as a placeholder so the card doesn't look broken. */}
                    <div className="aspect-[16/10] bg-gray-800 relative overflow-hidden">
                      {product.thumbnail_url ? (
                        <img
                          src={product.thumbnail_url}
                          alt={product.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Code2 className="h-10 w-10 text-gray-700" />
                        </div>
                      )}
                      {/* Featured badge */}
                      {product.is_featured && (
                        <div className="absolute top-2 left-2 bg-violet-600 text-white text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          Featured
                        </div>
                      )}
                    </div>

                    {/* ---- Card Body ---- */}
                    <div className="p-4">
                      {/* Product title — line-clamp-1 ensures long titles don't break the layout */}
                      <h3 className="font-semibold text-white group-hover:text-violet-400 transition-colors line-clamp-1">
                        {product.title}
                      </h3>

                      {/* Seller name — shows who made this product */}
                      <p className="text-gray-500 text-sm mt-1 line-clamp-1">
                        by{' '}
                        {product.seller?.display_name || 'Unknown Seller'}
                      </p>

                      {/* Category tag — small pill showing which category this belongs to */}
                      {product.category && (
                        <span className="inline-block mt-2 text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
                          {product.category.name}
                        </span>
                      )}

                      {/* Bottom row: price on left, rating & downloads on right */}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800">
                        {/* Price — we store cents in the DB to avoid floating-point rounding errors,
                            then convert to dollars for display */}
                        <span className="text-lg font-bold text-violet-400">
                          ${(product.price_cents / 100).toFixed(2)}
                        </span>

                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          {/* Star rating */}
                          <span className="flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
                            {product.avg_rating?.toFixed(1) || '0.0'}
                          </span>
                          {/* Download count */}
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

      {/* ===== Footer ===== */}
      <footer className="border-t border-gray-800 mt-16">
        <div className="container mx-auto px-4 py-8 text-center text-gray-500 text-sm">
          &copy; {new Date().getFullYear()} CodeVault by Solaris Empire Inc. All rights reserved.
        </div>
      </footer>
    </div>
  )
}

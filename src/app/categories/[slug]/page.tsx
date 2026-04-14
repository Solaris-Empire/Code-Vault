import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Code2, Download, Home, ChevronRight, Star, PackageOpen } from 'lucide-react'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { SellerTierBadge } from '@/components/seller/seller-tier-badge'
import { SellerRankBadge, type SellerRankKey } from '@/components/seller/seller-rank-badge'
import type { SellerTier } from '@/lib/seller/tier'

import type { Metadata } from 'next'

// ─── ISR: revalidate every 60 seconds ────────────────────────────────
// Same strategy as the categories index — static but refreshed periodically.
export const revalidate = 60

// ─── Type definitions ────────────────────────────────────────────────
// Explicit types keep TypeScript strict and let Kevin see the data shape at a glance.

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
}

interface Seller {
  display_name: string | null
  seller_tier: SellerTier | null
  seller_rank_key: SellerRankKey | null
}

interface Product {
  id: string
  title: string
  slug: string
  short_description: string | null
  price_cents: number
  thumbnail_url: string | null
  download_count: number
  avg_rating: number | null
  review_count: number
  seller: Seller | null
}

// ─── Page props ──────────────────────────────────────────────────────
// Next.js App Router passes route params as a Promise (Next 15+ convention).
interface CategoryPageProps {
  params: Promise<{ slug: string }>
}

// ─── Dynamic metadata ────────────────────────────────────────────────
// This function runs on the server to set the <title> dynamically based on the category.
export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params
  const supabase = getSupabaseAdmin()

  const { data: category } = await supabase
    .from('categories')
    .select('name, description')
    .eq('slug', slug)
    .single()

  // If the category doesn't exist, Next.js will show the 404 page anyway,
  // but we still return a sensible fallback title.
  if (!category) {
    return { title: 'Category Not Found | CodeVault' }
  }

  return {
    title: `${category.name} | CodeVault`,
    description: category.description || `Browse ${category.name} products on CodeVault.`,
  }
}

// ─── Page component ──────────────────────────────────────────────────
export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params
  const supabase = getSupabaseAdmin()

  // ─── Fetch the category by slug ──────────────────────────────────
  // .single() returns exactly one row or null — perfect for slug lookups.
  const { data: category, error: catError } = await supabase
    .from('categories')
    .select('*')
    .eq('slug', slug)
    .single()

  // If no category matches this slug, show the Next.js 404 page.
  // notFound() throws internally so nothing below it runs.
  if (!category) {
    notFound()
  }

  // Cast to our typed interface so TypeScript knows the shape.
  const typedCategory = category as Category

  // ─── Fetch approved products in this category ────────────────────
  // We join the seller (users table) so we can display the seller's name.
  // Only approved products are shown — drafts/pending/rejected stay hidden.
  const { data: products, error: prodError } = await supabase
    .from('products')
    .select('id, title, slug, short_description, price_cents, thumbnail_url, download_count, avg_rating, review_count, seller:users(display_name, seller_tier, seller_rank_key)')
    .eq('category_id', typedCategory.id)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })

  // Safe fallback so .map() never crashes even if the query fails.
  const safeProducts: Product[] = (products as Product[] | null) || []

  return (
    <div className="min-h-screen bg-(--color-background) text-white">
      {/* ─── Breadcrumb navigation ───────────────────────────────── */}
      {/* Breadcrumbs help buyers orient themselves and improve SEO. */}
      <div className="border-b border-(--color-border) bg-(--color-surface)/30">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center gap-2 text-sm text-(--color-text-secondary)">
            <Link href="/" className="flex items-center gap-1 hover:text-white transition-colors">
              <Home className="h-4 w-4" />
              Home
            </Link>
            <ChevronRight className="h-4 w-4 text-(--color-text-muted)" />
            <Link href="/categories" className="hover:text-white transition-colors">
              Categories
            </Link>
            <ChevronRight className="h-4 w-4 text-(--color-text-muted)" />
            <span className="text-white font-medium">{typedCategory.name}</span>
          </nav>
        </div>
      </div>

      {/* ─── Category header ─────────────────────────────────────── */}
      <section className="border-b border-(--color-border)">
        <div className="container mx-auto px-4 py-10 md:py-14">
          <div className="flex items-start gap-4">
            {/* Category icon */}
            <div className="text-4xl">{typedCategory.icon || '📦'}</div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">{typedCategory.name}</h1>
              {typedCategory.description && (
                <p className="text-(--color-text-secondary) mt-2 max-w-2xl">{typedCategory.description}</p>
              )}
              <p className="text-(--color-text-muted) text-sm mt-3">
                {safeProducts.length} {safeProducts.length === 1 ? 'product' : 'products'} available
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Product grid ────────────────────────────────────────── */}
      <section className="py-10 md:py-16">
        <div className="container mx-auto px-4">
          {safeProducts.length === 0 ? (
            /* ─── Empty state ────────────────────────────────────── */
            /* Shown when there are no approved products in this category yet. */
            <div className="text-center py-20">
              <PackageOpen className="h-12 w-12 text-gray-700 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-(--color-text-secondary)">
                No products in this category yet
              </h2>
              <p className="text-(--color-text-muted) mt-2 max-w-md mx-auto">
                Be the first to upload a product in {typedCategory.name}!
                Products will appear here once they are approved.
              </p>
              <Link
                href="/categories"
                className="inline-flex items-center gap-2 mt-6 text-(--brand-primary) hover:text-(--brand-primary) text-sm font-medium transition-colors"
              >
                Browse other categories
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            /* Product cards — same design pattern as the homepage product cards */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {safeProducts.map((product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.slug}`}
                  className="group bg-(--color-surface) border border-(--color-border) rounded-none overflow-hidden hover:border-(--brand-primary)/50 transition-all"
                >
                  {/* ─── Thumbnail ──────────────────────────────── */}
                  {/* 16:10 aspect ratio keeps cards uniform even with different image sizes. */}
                  <div className="aspect-[16/10] bg-(--color-elevated) relative overflow-hidden">
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
                  </div>

                  {/* ─── Product info ───────────────────────────── */}
                  <div className="p-4">
                    {/* Product title — clamped to 1 line to keep cards neat */}
                    <h3 className="font-semibold text-white group-hover:text-(--brand-primary) transition-colors line-clamp-1">
                      {product.title}
                    </h3>

                    {/* Seller name + tier badge */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                      <p className="text-(--color-text-muted) text-sm line-clamp-1">
                        by {product.seller?.display_name || 'Unknown'}
                      </p>
                      <SellerRankBadge rankKey={product.seller?.seller_rank_key} size="inline" />
                      {product.seller?.seller_tier && product.seller.seller_tier !== 'unverified' && (
                        <SellerTierBadge tier={product.seller.seller_tier} size="avatar" />
                      )}
                    </div>

                    {/* Short description preview */}
                    {product.short_description && (
                      <p className="text-(--color-text-muted) text-xs mt-2 line-clamp-2">
                        {product.short_description}
                      </p>
                    )}

                    {/* Price, rating, and downloads — the key purchase signals */}
                    <div className="flex items-center justify-between mt-3">
                      {/* Price — converted from cents to dollars for display */}
                      <span className="text-lg font-bold text-(--brand-primary)">
                        ${(product.price_cents / 100).toFixed(2)}
                      </span>

                      <div className="flex items-center gap-3 text-sm text-(--color-text-muted)">
                        {/* Star rating */}
                        <div className="flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
                          <span>{product.avg_rating?.toFixed(1) || '0.0'}</span>
                        </div>

                        {/* Download count */}
                        <div className="flex items-center gap-1">
                          <Download className="h-3.5 w-3.5" />
                          <span>{product.download_count || 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

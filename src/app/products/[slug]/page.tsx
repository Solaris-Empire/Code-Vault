/**
 * Product Detail Page — /products/[slug]
 *
 * This is a SERVER component (no "use client" directive). It runs on the server,
 * fetches data from Supabase, and sends fully-rendered HTML to the browser.
 *
 * WHY server component?
 * - SEO: Search engines see the full page content immediately
 * - Performance: No loading spinners — data is ready before the page ships
 * - Security: Database queries never run in the browser
 *
 * ISR (Incremental Static Regeneration) with revalidate = 60:
 * - The page is cached and served instantly to visitors
 * - Every 60 seconds, Next.js rebuilds it in the background with fresh data
 * - This gives us static-site speed with near-real-time data
 */

import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import {
  Star,
  Download,
  Code2,
  ExternalLink,
  ArrowLeft,
  Shield,
  User,
  Tag,
} from 'lucide-react'
import { getSupabaseAdmin } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// ISR: Revalidate this page every 60 seconds
// WHY? Product data (reviews, download count) changes over time, but we don't
// need real-time updates. 60s is a good balance between freshness and speed.
// ---------------------------------------------------------------------------
export const revalidate = 60

// ---------------------------------------------------------------------------
// TypeScript interfaces for the data we fetch from Supabase
// WHY strict types? They catch bugs at build time instead of in production.
// We define exactly what shape the data has so TypeScript can help us.
// ---------------------------------------------------------------------------

/** The seller info we join from the users table */
interface Seller {
  id: string
  display_name: string
  avatar_url: string | null
  bio: string | null
}

/** The category info we join from the categories table */
interface Category {
  id: string
  name: string
  slug: string
  icon: string | null
}

/** The current file info from product_files (only the latest version) */
interface ProductFile {
  id: string
  file_name: string
  file_size_bytes: number
  version: string
  changelog: string | null
  created_at: string
}

/** A review left by a buyer */
interface Review {
  id: string
  rating: number
  comment: string | null
  created_at: string
  buyer: {
    display_name: string
    avatar_url: string | null
  }
}

/** The full product with all joined relations */
interface Product {
  id: string
  title: string
  slug: string
  description: string
  short_description: string | null
  price_cents: number
  thumbnail_url: string | null
  demo_url: string | null
  status: string
  download_count: number
  avg_rating: number | null
  review_count: number
  is_featured: boolean
  tags: string[] | null
  created_at: string
  updated_at: string
  seller: Seller
  category: Category
  product_files: ProductFile[]
}

// ---------------------------------------------------------------------------
// Props type — Next.js App Router passes params as a Promise in dynamic routes
// WHY Promise? Next.js 14+ made params async so the framework can optimize
// when/how it resolves them. We must await params before using them.
// ---------------------------------------------------------------------------
interface ProductPageProps {
  params: Promise<{ slug: string }>
}

// ---------------------------------------------------------------------------
// Dynamic Metadata — sets the <title> and <meta description> for SEO
// WHY a function instead of a static export? Because the title depends on
// the specific product. Next.js calls this function at build/request time.
// ---------------------------------------------------------------------------
export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params
  const supabase = getSupabaseAdmin()

  // Fetch just the fields we need for metadata (lightweight query)
  const { data: product } = await supabase
    .from('products')
    .select('title, short_description, thumbnail_url')
    .eq('slug', slug)
    .eq('status', 'approved')
    .single()

  // If product not found, return generic metadata (notFound() handles the 404)
  if (!product) {
    return { title: 'Product Not Found | CodeVault' }
  }

  return {
    title: `${product.title} | CodeVault`,
    description: product.short_description ?? `${product.title} on CodeVault`,
    openGraph: {
      title: product.title,
      description: product.short_description ?? undefined,
      images: product.thumbnail_url ? [product.thumbnail_url] : undefined,
    },
  }
}

// ---------------------------------------------------------------------------
// Helper: Format price from cents to dollars
// WHY cents? Storing money as integers (cents) avoids floating-point bugs.
// $19.99 is stored as 1999 — no rounding errors from 0.1 + 0.2 !== 0.3.
// ---------------------------------------------------------------------------
function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

// ---------------------------------------------------------------------------
// Helper: Format file size from bytes to human-readable KB or MB
// WHY? Users don't want to see "2458624 bytes" — they want "2.34 MB".
// ---------------------------------------------------------------------------
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

// ---------------------------------------------------------------------------
// Helper: Render star icons (filled or empty) for a given rating
// WHY a helper? We use stars in multiple places (avg rating + each review).
// Keeping it DRY (Don't Repeat Yourself) means one fix updates everywhere.
// ---------------------------------------------------------------------------
function StarRating({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {/* We always render 5 stars. If the rating is 3.7, stars 1-3 are
          filled (gold), star 4 is empty, star 5 is empty. We round to
          the nearest whole number for simplicity. */}
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={size}
          className={
            i < Math.round(rating)
              ? 'fill-yellow-400 text-yellow-400' // Filled star
              : 'text-gray-600' // Empty star
          }
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helper: Format a date string into a human-friendly format
// WHY? ISO dates like "2026-01-15T08:30:00Z" aren't user-friendly.
// ---------------------------------------------------------------------------
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------
export default async function ProductPage({ params }: ProductPageProps) {
  // Await params — required in Next.js 14+ App Router for dynamic routes
  const { slug } = await params
  const supabase = getSupabaseAdmin()

  // -------------------------------------------------------------------------
  // Fetch the product with all related data in ONE query using Supabase joins
  // WHY joins? Instead of 4 separate queries (product, seller, category, files),
  // Supabase lets us fetch everything in one round-trip. Faster = better UX.
  //
  // The syntax: seller:users(...) means "join the users table via the
  // seller_id foreign key and alias the result as 'seller'".
  // -------------------------------------------------------------------------
  const { data: product, error } = await supabase
    .from('products')
    .select(
      `
      *,
      seller:users!seller_id (
        id,
        display_name,
        avatar_url,
        bio
      ),
      category:categories!category_id (
        id,
        name,
        slug,
        icon
      ),
      product_files (
        id,
        file_name,
        file_size_bytes,
        version,
        changelog,
        created_at
      )
    `
    )
    .eq('slug', slug)
    .eq('status', 'approved') // Only show approved products to the public
    .eq('product_files.is_current', true) // Only fetch the current/latest file version
    .single()

  // -------------------------------------------------------------------------
  // If product doesn't exist OR isn't approved, show a 404 page
  // WHY notFound()? Next.js has a built-in 404 system. Calling notFound()
  // triggers the nearest not-found.tsx boundary — clean and consistent.
  // -------------------------------------------------------------------------
  if (error || !product) {
    notFound()
  }

  // Cast to our typed interface so TypeScript knows the shape
  const typedProduct = product as unknown as Product

  // -------------------------------------------------------------------------
  // Fetch reviews separately — they come from a different table and we want
  // to sort them (newest first) and join the buyer's display name + avatar.
  // -------------------------------------------------------------------------
  const { data: reviews } = await supabase
    .from('reviews')
    .select(
      `
      id,
      rating,
      comment,
      created_at,
      buyer:users!buyer_id (
        display_name,
        avatar_url
      )
    `
    )
    .eq('product_id', typedProduct.id)
    .order('created_at', { ascending: false })
    .limit(20) // Don't load hundreds of reviews — paginate later if needed

  const typedReviews = (reviews ?? []) as unknown as Review[]

  // Grab the current file info (first item since we filtered is_current=true)
  const currentFile =
    typedProduct.product_files.length > 0
      ? typedProduct.product_files[0]
      : null

  // =========================================================================
  // RENDER
  // =========================================================================
  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      {/* ----------------------------------------------------------------- */}
      {/* BREADCRUMB NAVIGATION                                             */}
      {/* WHY breadcrumbs? They show users where they are in the site       */}
      {/* hierarchy and let them jump back to the category or home easily.  */}
      {/* Also great for SEO — search engines use breadcrumbs to understand */}
      {/* your site structure.                                              */}
      {/* ----------------------------------------------------------------- */}
      <div className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-2 text-sm text-gray-400">
            <Link
              href="/"
              className="transition-colors hover:text-violet-400"
            >
              Home
            </Link>
            <span className="text-gray-600">/</span>
            <Link
              href={`/categories/${typedProduct.category.slug}`}
              className="transition-colors hover:text-violet-400"
            >
              {typedProduct.category.name}
            </Link>
            <span className="text-gray-600">/</span>
            <span className="text-gray-200">{typedProduct.title}</span>
          </nav>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* MAIN CONTENT AREA — Two-column layout on desktop                  */}
      {/* Left (2/3): Product details, description, tags, reviews           */}
      {/* Right (1/3): Sticky purchase card, seller info                    */}
      {/* ----------------------------------------------------------------- */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Back button — lets users go back to browsing */}
        <Link
          href="/products"
          className="mb-6 inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-violet-400"
        >
          <ArrowLeft size={16} />
          Back to Products
        </Link>

        <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* ============================================================= */}
          {/* LEFT COLUMN — Product details (takes up 2/3 on large screens) */}
          {/* ============================================================= */}
          <div className="lg:col-span-2 space-y-8">
            {/* ----------------------------------------------------------- */}
            {/* PRODUCT THUMBNAIL — The hero image of the product            */}
            {/* WHY aspect-video? It enforces a 16:9 ratio which looks       */}
            {/* consistent across all products regardless of image size.     */}
            {/* ----------------------------------------------------------- */}
            <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
              {typedProduct.thumbnail_url ? (
                <Image
                  src={typedProduct.thumbnail_url}
                  alt={typedProduct.title}
                  fill
                  className="object-cover"
                  priority // WHY priority? This is the largest image above the fold — load it first
                  sizes="(max-width: 1024px) 100vw, 66vw"
                />
              ) : (
                /* Fallback when no thumbnail exists */
                <div className="flex h-full w-full items-center justify-center">
                  <Code2 size={64} className="text-gray-700" />
                </div>
              )}
            </div>

            {/* ----------------------------------------------------------- */}
            {/* PRODUCT TITLE + STATS (rating, downloads)                   */}
            {/* ----------------------------------------------------------- */}
            <div>
              <h1 className="text-3xl font-bold text-white">
                {typedProduct.title}
              </h1>

              {/* Stats row — shows social proof (ratings + downloads) */}
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-400">
                {/* Star rating display */}
                <div className="flex items-center gap-1.5">
                  <StarRating rating={typedProduct.avg_rating ?? 0} />
                  <span className="font-medium text-gray-300">
                    {typedProduct.avg_rating?.toFixed(1) ?? '0.0'}
                  </span>
                  <span>({typedProduct.review_count} reviews)</span>
                </div>

                {/* Download count */}
                <div className="flex items-center gap-1.5">
                  <Download size={14} className="text-gray-500" />
                  <span>
                    {typedProduct.download_count.toLocaleString()} downloads
                  </span>
                </div>
              </div>
            </div>

            {/* ----------------------------------------------------------- */}
            {/* TAGS — Searchable keywords for the product                  */}
            {/* WHY tags? They help buyers find products and give sellers    */}
            {/* better discoverability through search and filtering.         */}
            {/* ----------------------------------------------------------- */}
            {typedProduct.tags && typedProduct.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <Tag size={14} className="text-gray-500" />
                {typedProduct.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-gray-800 px-3 py-1 text-xs font-medium text-gray-300 transition-colors hover:bg-violet-500/20 hover:text-violet-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* ----------------------------------------------------------- */}
            {/* VERSION INFO — Shows current file version and details        */}
            {/* WHY show this? Buyers want to know the product is maintained */}
            {/* and what version they're getting.                            */}
            {/* ----------------------------------------------------------- */}
            {currentFile && (
              <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
                  Current Version
                </h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-gray-500">Version</p>
                    <p className="font-semibold text-violet-400">
                      {currentFile.version}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">File</p>
                    <p className="font-medium text-gray-200 truncate">
                      {currentFile.file_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Size</p>
                    <p className="font-medium text-gray-200">
                      {formatFileSize(currentFile.file_size_bytes)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Updated</p>
                    <p className="font-medium text-gray-200">
                      {formatDate(currentFile.created_at)}
                    </p>
                  </div>
                </div>
                {/* Show changelog if the seller provided one */}
                {currentFile.changelog && (
                  <div className="mt-4 border-t border-gray-800 pt-4">
                    <p className="text-xs text-gray-500 mb-1">Changelog</p>
                    <p className="text-sm text-gray-300">
                      {currentFile.changelog}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ----------------------------------------------------------- */}
            {/* PRODUCT DESCRIPTION — The main sales content                 */}
            {/* WHY dangerouslySetInnerHTML? The description is stored as    */}
            {/* HTML (from a rich text editor). We render it as HTML so      */}
            {/* sellers can use headings, lists, code blocks, etc.           */}
            {/*                                                             */}
            {/* SECURITY NOTE: In production, you MUST sanitize this HTML   */}
            {/* server-side (e.g., with DOMPurify or sanitize-html) before  */}
            {/* rendering. For now we trust admin-approved content.          */}
            {/* ----------------------------------------------------------- */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
              <h2 className="mb-4 text-xl font-bold text-white">Description</h2>
              <div
                className="prose prose-invert prose-violet max-w-none
                  prose-headings:text-gray-100
                  prose-p:text-gray-300
                  prose-a:text-violet-400 prose-a:no-underline hover:prose-a:underline
                  prose-strong:text-gray-200
                  prose-code:text-violet-300 prose-code:bg-gray-800 prose-code:rounded prose-code:px-1.5 prose-code:py-0.5
                  prose-pre:bg-gray-800 prose-pre:border prose-pre:border-gray-700
                  prose-li:text-gray-300
                  prose-img:rounded-lg"
                dangerouslySetInnerHTML={{ __html: typedProduct.description }}
              />
            </div>

            {/* ----------------------------------------------------------- */}
            {/* REVIEWS SECTION                                             */}
            {/* WHY show reviews? Social proof is the #1 driver of purchase */}
            {/* decisions. Seeing other buyers' experiences builds trust.    */}
            {/* ----------------------------------------------------------- */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">
                  Reviews ({typedProduct.review_count})
                </h2>

                {/* Overall rating summary */}
                {typedProduct.avg_rating !== null &&
                  typedProduct.avg_rating > 0 && (
                    <div className="flex items-center gap-2">
                      <StarRating
                        rating={typedProduct.avg_rating}
                        size={20}
                      />
                      <span className="text-lg font-bold text-white">
                        {typedProduct.avg_rating.toFixed(1)}
                      </span>
                    </div>
                  )}
              </div>

              {/* List of individual reviews */}
              {typedReviews.length > 0 ? (
                <div className="space-y-6">
                  {typedReviews.map((review) => (
                    <div
                      key={review.id}
                      className="border-b border-gray-800 pb-6 last:border-b-0 last:pb-0"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          {/* Reviewer avatar */}
                          {review.buyer.avatar_url ? (
                            <Image
                              src={review.buyer.avatar_url}
                              alt={review.buyer.display_name}
                              width={36}
                              height={36}
                              className="rounded-full"
                            />
                          ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-800">
                              <User size={16} className="text-gray-500" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-200">
                              {review.buyer.display_name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatDate(review.created_at)}
                            </p>
                          </div>
                        </div>

                        {/* Star rating for this review */}
                        <StarRating rating={review.rating} size={14} />
                      </div>

                      {/* Review comment */}
                      {review.comment && (
                        <p className="mt-3 text-sm leading-relaxed text-gray-300">
                          {review.comment}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                /* Empty state when no reviews exist yet */
                <div className="py-12 text-center">
                  <Star size={32} className="mx-auto mb-3 text-gray-700" />
                  <p className="text-gray-400">No reviews yet</p>
                  <p className="mt-1 text-sm text-gray-500">
                    Be the first to review this product
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ============================================================= */}
          {/* RIGHT COLUMN — Sticky sidebar (takes up 1/3 on large screens) */}
          {/* WHY sticky? As users scroll through the long description, the */}
          {/* purchase card stays visible so they can buy anytime.           */}
          {/* ============================================================= */}
          <div className="space-y-6 lg:sticky lg:top-8 lg:self-start">
            {/* ----------------------------------------------------------- */}
            {/* PURCHASE CARD — The most important element on the page       */}
            {/* WHY prominent? This is where revenue comes from. It should   */}
            {/* be impossible to miss with a clear price and CTA button.     */}
            {/* ----------------------------------------------------------- */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
              {/* Price — big and bold so it's the first thing buyers see */}
              <div className="mb-4 text-center">
                <span className="text-4xl font-extrabold text-white">
                  {formatPrice(typedProduct.price_cents)}
                </span>
              </div>

              {/* Buy Now button — links to checkout (to be built) */}
              <Link
                href={`/checkout/${typedProduct.slug}`}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-6 py-3 text-base font-semibold text-white transition-all hover:bg-violet-500 hover:shadow-lg hover:shadow-violet-500/25 active:scale-[0.98]"
              >
                <Shield size={18} />
                Buy Now
              </Link>

              {/* Demo link — only show if the seller provided a demo URL */}
              {typedProduct.demo_url && (
                <a
                  href={typedProduct.demo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-6 py-3 text-sm font-medium text-gray-200 transition-colors hover:border-violet-500/50 hover:bg-gray-750 hover:text-white"
                >
                  <ExternalLink size={16} />
                  Live Demo
                </a>
              )}

              {/* Quick info list */}
              <div className="mt-5 space-y-3 border-t border-gray-800 pt-5">
                {/* License type info */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">License</span>
                  <span className="font-medium text-gray-200">Regular</span>
                </div>

                {/* Current version */}
                {currentFile && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Version</span>
                    <span className="font-medium text-gray-200">
                      {currentFile.version}
                    </span>
                  </div>
                )}

                {/* File size */}
                {currentFile && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">File Size</span>
                    <span className="font-medium text-gray-200">
                      {formatFileSize(currentFile.file_size_bytes)}
                    </span>
                  </div>
                )}

                {/* Last updated date */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Last Updated</span>
                  <span className="font-medium text-gray-200">
                    {formatDate(typedProduct.updated_at)}
                  </span>
                </div>

                {/* Downloads count */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Downloads</span>
                  <span className="font-medium text-gray-200">
                    {typedProduct.download_count.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* ----------------------------------------------------------- */}
            {/* SELLER INFO CARD                                            */}
            {/* WHY show the seller? Buyers trust products more when they   */}
            {/* can see who made it. It humanizes the transaction.           */}
            {/* ----------------------------------------------------------- */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
                About the Seller
              </h3>

              <div className="flex items-center gap-3">
                {/* Seller avatar */}
                {typedProduct.seller.avatar_url ? (
                  <Image
                    src={typedProduct.seller.avatar_url}
                    alt={typedProduct.seller.display_name}
                    width={48}
                    height={48}
                    className="rounded-full"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-500/20">
                    <User size={20} className="text-violet-400" />
                  </div>
                )}

                <div>
                  <p className="font-semibold text-white">
                    {typedProduct.seller.display_name}
                  </p>
                  <p className="text-xs text-gray-500">Seller</p>
                </div>
              </div>

              {/* Seller bio — truncated if too long */}
              {typedProduct.seller.bio && (
                <p className="mt-3 text-sm leading-relaxed text-gray-400">
                  {typedProduct.seller.bio}
                </p>
              )}

              {/* Link to seller's profile/store page */}
              <Link
                href={`/sellers/${typedProduct.seller.id}`}
                className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:border-violet-500/50 hover:text-white"
              >
                View Profile
              </Link>
            </div>

            {/* ----------------------------------------------------------- */}
            {/* CATEGORY BADGE                                              */}
            {/* WHY? Helps users discover similar products in the same       */}
            {/* category with one click.                                     */}
            {/* ----------------------------------------------------------- */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
                Category
              </h3>
              <Link
                href={`/categories/${typedProduct.category.slug}`}
                className="inline-flex items-center gap-2 rounded-full bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-400 transition-colors hover:bg-violet-500/20"
              >
                <Code2 size={14} />
                {typedProduct.category.name}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

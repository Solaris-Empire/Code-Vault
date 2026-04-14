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
import { getSupabaseAdmin, createClient } from '@/lib/supabase/server'
import { CodeQualityReport } from '@/components/product/code-quality-report'
import { OwnershipPanel, type OwnershipRow } from '@/components/product/ownership-panel'
import { SourceDNAPanel } from '@/components/product/source-dna-panel'
import type { GithubMatchRow } from '@/lib/analysis/github-match'
import { SellerTierBadge } from '@/components/seller/seller-tier-badge'
import type { SellerTier } from '@/lib/seller/tier'

export const revalidate = 60

interface Seller {
  id: string
  display_name: string
  avatar_url: string | null
  bio: string | null
  seller_tier: SellerTier | null
}

interface Category {
  id: string
  name: string
  slug: string
  icon: string | null
}

interface ProductFile {
  id: string
  file_name: string
  file_size_bytes: number
  version: string
  changelog: string | null
  created_at: string
}

interface Review {
  id: string
  rating: number
  comment: string | null
  created_at: string
  buyer: { display_name: string; avatar_url: string | null }
}

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
  seller_id: string
  show_ai_detection: boolean | null
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

interface ProductPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params
  const supabase = getSupabaseAdmin()
  const { data: product } = await supabase
    .from('products').select('title, short_description, thumbnail_url')
    .eq('slug', slug).eq('status', 'approved').single()

  if (!product) return { title: 'Product Not Found | CodeVault' }
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

function formatPrice(cents: number): string { return `$${(cents / 100).toFixed(2)}` }
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function StarRating({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={size} className={i < Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} />
      ))}
    </div>
  )
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function ownershipDetails(row: unknown): { matches: GithubMatchRow[]; topConfidence: number; note?: string } {
  const details = (row as { details?: { githubMatches?: GithubMatchRow[]; githubNote?: string } })?.details
  const matches: GithubMatchRow[] = details?.githubMatches || []
  const topConfidence = matches.reduce((max, r) => Math.max(max, r.confidence || 0), 0)
  return { matches, topConfidence, note: details?.githubNote }
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params
  const supabase = getSupabaseAdmin()

  const { data: product, error } = await supabase
    .from('products')
    .select(`*, seller:users!seller_id(id, display_name, avatar_url, bio, seller_tier), category:categories!category_id(id, name, slug, icon), product_files(id, file_name, file_size_bytes, version, changelog, created_at)`)
    .eq('slug', slug).eq('status', 'approved').eq('product_files.is_current', true).single()

  if (error || !product) notFound()
  const typedProduct = product as unknown as Product

  const { data: reviews } = await supabase
    .from('reviews')
    .select(`id, rating, comment, created_at, buyer:users!buyer_id(display_name, avatar_url)`)
    .eq('product_id', typedProduct.id).order('created_at', { ascending: false }).limit(20)

  const typedReviews = (reviews ?? []) as unknown as Review[]
  const currentFile = typedProduct.product_files.length > 0 ? typedProduct.product_files[0] : null

  // Fetch code quality analysis (may be null if not yet run)
  const { data: analysisRow } = await supabase
    .from('product_analyses')
    .select('status, error_message, quality_score, grade, total_loc, total_files, dependency_count, issue_count, report, updated_at')
    .eq('product_id', typedProduct.id)
    .maybeSingle()

  // Fetch ownership / authenticity check (may be null if not yet run)
  const { data: ownershipRow } = await supabase
    .from('product_ownership_checks')
    .select('verdict, authenticity_score, license_name, license_classification, license_allows_resale, git_present, git_unique_authors, git_matches_seller, copyright_holders_count, obfuscated_file_count, fingerprint_matches, github_match_count, signals, details, updated_at')
    .eq('product_id', typedProduct.id)
    .maybeSingle()

  // Determine if the current viewer is the seller or an admin — they always
  // see the AI-detection panel even when the seller has hidden it publicly.
  const authClient = await createClient()
  const { data: { user: viewer } } = await authClient.auth.getUser()
  let viewerCanSeeAi = false
  if (viewer) {
    if (viewer.id === typedProduct.seller_id) {
      viewerCanSeeAi = true
    } else {
      const { data: viewerProfile } = await supabase.from('users').select('role').eq('id', viewer.id).maybeSingle()
      if (viewerProfile?.role === 'admin') viewerCanSeeAi = true
    }
  }
  const showAiDetection = typedProduct.show_ai_detection ?? true

  return (
    <main className="min-h-screen bg-white text-gray-900">
      {/* Breadcrumb */}
      <div className="border-b border-gray-100 bg-gray-50/50">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-2 text-sm text-(--color-text-secondary)">
            <Link href="/" className="hover:text-green-600 transition-colors">Home</Link>
            <span>/</span>
            <Link href={`/categories/${typedProduct.category.slug}`} className="hover:text-green-600 transition-colors">{typedProduct.category.name}</Link>
            <span>/</span>
            <span className="text-gray-700">{typedProduct.title}</span>
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/products" className="mb-6 inline-flex items-center gap-2 text-sm text-(--color-text-secondary) hover:text-green-600 transition-colors">
          <ArrowLeft size={16} /> Back to Products
        </Link>

        <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Thumbnail */}
            <div className="relative aspect-video w-full overflow-hidden rounded-none border border-gray-100 bg-gray-50">
              {typedProduct.thumbnail_url ? (
                <Image src={typedProduct.thumbnail_url} alt={typedProduct.title} fill className="object-cover" priority sizes="(max-width: 1024px) 100vw, 66vw" />
              ) : (
                <div className="flex h-full w-full items-center justify-center"><Code2 size={64} className="text-gray-200" /></div>
              )}
            </div>

            {/* Title + Stats */}
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{typedProduct.title}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-(--color-text-secondary)">
                <div className="flex items-center gap-1.5">
                  <StarRating rating={typedProduct.avg_rating ?? 0} />
                  <span className="font-medium text-gray-700">{typedProduct.avg_rating?.toFixed(1) ?? '0.0'}</span>
                  <span>({typedProduct.review_count} reviews)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Download size={14} />
                  <span>{typedProduct.download_count.toLocaleString()} downloads</span>
                </div>
              </div>
            </div>

            {/* Tags */}
            {typedProduct.tags && typedProduct.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <Tag size={14} className="text-(--color-text-secondary)" />
                {typedProduct.tags.map((tag) => (
                  <span key={tag} className="rounded-none bg-green-50 border border-green-100 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors">{tag}</span>
                ))}
              </div>
            )}

            {/* Version Info */}
            {currentFile && (
              <div className="card rounded-none p-5">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-(--color-text-secondary)">Current Version</h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div><p className="text-xs text-(--color-text-secondary)">Version</p><p className="font-semibold text-green-600">{currentFile.version}</p></div>
                  <div><p className="text-xs text-(--color-text-secondary)">File</p><p className="font-medium text-gray-700 truncate">{currentFile.file_name}</p></div>
                  <div><p className="text-xs text-(--color-text-secondary)">Size</p><p className="font-medium text-gray-700">{formatFileSize(currentFile.file_size_bytes)}</p></div>
                  <div><p className="text-xs text-(--color-text-secondary)">Updated</p><p className="font-medium text-gray-700">{formatDate(currentFile.created_at)}</p></div>
                </div>
                {currentFile.changelog && (
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <p className="text-xs text-(--color-text-secondary) mb-1">Changelog</p>
                    <p className="text-sm text-(--color-text-muted)">{currentFile.changelog}</p>
                  </div>
                )}
              </div>
            )}

            {/* Ownership & Authenticity */}
            <OwnershipPanel ownership={ownershipRow as OwnershipRow | null} />

            {/* Source DNA — public-repo match summary (compact) */}
            {ownershipRow && (
              <SourceDNAPanel
                matches={ownershipDetails(ownershipRow).matches}
                topConfidence={ownershipDetails(ownershipRow).topConfidence}
                note={ownershipDetails(ownershipRow).note}
                compact
              />
            )}

            {/* Code Quality Report */}
            <CodeQualityReport
              analysis={analysisRow as never}
              showAiDetection={showAiDetection}
              viewerCanSeeAi={viewerCanSeeAi}
              productSlug={typedProduct.slug}
            />

            {/* Description */}
            <div className="card rounded-none p-6">
              <h2 className="mb-4 text-xl font-bold">Description</h2>
              <div
                className="prose prose-gray max-w-none prose-headings:text-gray-900 prose-p:text-(--color-text-muted) prose-a:text-green-600 prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-800 prose-code:text-green-700 prose-code:bg-green-50 prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-pre:bg-gray-50 prose-pre:border prose-pre:border-gray-100 prose-li:text-(--color-text-muted) prose-img:rounded-none"
                dangerouslySetInnerHTML={{ __html: typedProduct.description }}
              />
            </div>

            {/* Reviews */}
            <div className="card rounded-none p-6">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold">Reviews ({typedProduct.review_count})</h2>
                {typedProduct.avg_rating !== null && typedProduct.avg_rating > 0 && (
                  <div className="flex items-center gap-2">
                    <StarRating rating={typedProduct.avg_rating} size={20} />
                    <span className="text-lg font-bold">{typedProduct.avg_rating.toFixed(1)}</span>
                  </div>
                )}
              </div>

              {typedReviews.length > 0 ? (
                <div className="space-y-6">
                  {typedReviews.map((review) => (
                    <div key={review.id} className="border-b border-gray-100 pb-6 last:border-b-0 last:pb-0">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          {review.buyer.avatar_url ? (
                            <Image src={review.buyer.avatar_url} alt={review.buyer.display_name} width={36} height={36} className="rounded-none" />
                          ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-none bg-green-50"><User size={16} className="text-green-600" /></div>
                          )}
                          <div>
                            <p className="font-medium text-gray-800">{review.buyer.display_name}</p>
                            <p className="text-xs text-(--color-text-secondary)">{formatDate(review.created_at)}</p>
                          </div>
                        </div>
                        <StarRating rating={review.rating} size={14} />
                      </div>
                      {review.comment && <p className="mt-3 text-sm leading-relaxed text-(--color-text-muted)">{review.comment}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 rounded-none bg-green-50 flex items-center justify-center mx-auto mb-3">
                    <Star size={24} className="text-(--color-text-secondary)" />
                  </div>
                  <p className="text-(--color-text-muted)">No reviews yet</p>
                  <p className="mt-1 text-sm text-(--color-text-secondary)">Be the first to review this product</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6 lg:sticky lg:top-8 lg:self-start">
            {/* Purchase Card */}
            <div className="card rounded-none p-6">
              <div className="mb-5 text-center">
                <span className="text-4xl font-extrabold text-gray-900">{formatPrice(typedProduct.price_cents)}</span>
              </div>
              <Link
                href={`/checkout/${typedProduct.slug}`}
                className="btn-primary flex w-full items-center justify-center gap-2 rounded-none px-6 py-3.5 text-base font-semibold"
              >
                <Shield size={18} /> Buy Now
              </Link>
              {typedProduct.demo_url && (
                <a href={typedProduct.demo_url} target="_blank" rel="noopener noreferrer"
                  className="btn-outline mt-3 flex w-full items-center justify-center gap-2 rounded-none px-6 py-3 text-sm font-medium">
                  <ExternalLink size={16} /> Live Demo
                </a>
              )}
              <div className="mt-5 space-y-3 border-t border-gray-100 pt-5">
                <div className="flex items-center justify-between text-sm"><span className="text-(--color-text-secondary)">License</span><span className="font-medium text-gray-700">Regular</span></div>
                {currentFile && (
                  <>
                    <div className="flex items-center justify-between text-sm"><span className="text-(--color-text-secondary)">Version</span><span className="font-medium text-gray-700">{currentFile.version}</span></div>
                    <div className="flex items-center justify-between text-sm"><span className="text-(--color-text-secondary)">File Size</span><span className="font-medium text-gray-700">{formatFileSize(currentFile.file_size_bytes)}</span></div>
                  </>
                )}
                <div className="flex items-center justify-between text-sm"><span className="text-(--color-text-secondary)">Last Updated</span><span className="font-medium text-gray-700">{formatDate(typedProduct.updated_at)}</span></div>
                <div className="flex items-center justify-between text-sm"><span className="text-(--color-text-secondary)">Downloads</span><span className="font-medium text-gray-700">{typedProduct.download_count.toLocaleString()}</span></div>
              </div>
            </div>

            {/* Seller Card */}
            <div className="card rounded-none p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-(--color-text-secondary)">About the Seller</h3>
              <div className="flex items-center gap-3">
                {typedProduct.seller.avatar_url ? (
                  <Image src={typedProduct.seller.avatar_url} alt={typedProduct.seller.display_name} width={48} height={48} className="rounded-none" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-none bg-green-50"><User size={20} className="text-green-600" /></div>
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{typedProduct.seller.display_name}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <p className="text-xs text-(--color-text-secondary)">Seller</p>
                    {typedProduct.seller.seller_tier && typedProduct.seller.seller_tier !== 'unverified' && (
                      <SellerTierBadge tier={typedProduct.seller.seller_tier} size="avatar" />
                    )}
                  </div>
                </div>
              </div>
              {typedProduct.seller.bio && <p className="mt-3 text-sm leading-relaxed text-(--color-text-muted)">{typedProduct.seller.bio}</p>}
              <Link href={`/sellers/${typedProduct.seller.id}`} className="btn-outline mt-4 flex items-center justify-center rounded-none px-4 py-2.5 text-sm font-medium w-full">View Profile</Link>
            </div>

            {/* Category */}
            <div className="card rounded-none p-6">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-(--color-text-secondary)">Category</h3>
              <Link href={`/categories/${typedProduct.category.slug}`} className="inline-flex items-center gap-2 rounded-none bg-green-50 border border-green-100 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100 transition-colors">
                <Code2 size={14} /> {typedProduct.category.name}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

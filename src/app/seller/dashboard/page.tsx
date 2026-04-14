import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  DollarSign,
  Download,
  FileCode,
  Star,
  Plus,
  ArrowRight,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Check,
  X,
  Briefcase,
} from 'lucide-react'
import { createClient, getSupabaseAdmin } from '@/lib/supabase/server'
import { SellerTierBadge } from '@/components/seller/seller-tier-badge'
import { SellerRankBadge, type SellerRankKey, ALL_RANKS } from '@/components/seller/seller-rank-badge'

// XP thresholds mirror the seller_ranks seed in migration 00041.
// Used for the dashboard progress bar only — authoritative source is DB.
const RANK_XP_THRESHOLDS: Record<SellerRankKey, number> = {
  recruit: 0, cadet_1: 100, cadet_2: 300, cadet_3: 600,
  officer_1: 1000, officer_2: 1600, officer_3: 2400,
  captain_1: 3500, captain_2: 5000, captain_3: 7000,
  commander_1: 9500, commander_2: 12500, commander_3: 16000,
  general_1: 20000, general_2: 25000, general_3: 31000,
  bronze: 38000, silver: 46000, gold: 56000,
  platinum: 70000, diamond: 88000, obsidian: 110000,
  mythic: 140000, titan: 180000,
  founder: 0, legend: 0,
}
import type { SellerTier, TierRequirement } from '@/lib/seller/tier'

import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Seller Dashboard' }

// Revalidate every 30 seconds so seller sees near-real-time stats
export const revalidate = 30

export default async function SellerDashboardPage() {
  // Auth check — redirect to login if not authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirectTo=/seller/dashboard')
  }

  const admin = getSupabaseAdmin()

  // Check if user is a seller or admin
  const { data: profile } = await admin
    .from('users')
    .select('role, display_name, seller_rank_key, seller_rank_sort, seller_xp')
    .eq('id', user.id)
    .single()

  if (!profile || !['seller', 'admin'].includes(profile.role)) {
    redirect('/register?role=seller')
  }

  // Fetch seller's products with counts by status
  const { data: products } = await admin
    .from('products')
    .select('id, title, slug, status, price_cents, download_count, avg_rating, review_count, thumbnail_url, created_at')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false })

  const allProducts = products || []

  // Calculate stats
  const approved = allProducts.filter(p => p.status === 'approved')
  const pending = allProducts.filter(p => p.status === 'pending')
  const drafts = allProducts.filter(p => p.status === 'draft')
  const rejected = allProducts.filter(p => p.status === 'rejected')

  // Fetch total sales (completed orders for this seller's products)
  const productIds = allProducts.map(p => p.id)
  let totalSalesCents = 0
  let totalOrders = 0

  if (productIds.length > 0) {
    const { data: orders } = await admin
      .from('orders')
      .select('seller_payout_cents')
      .in('product_id', productIds)
      .eq('status', 'completed')

    if (orders) {
      totalOrders = orders.length
      totalSalesCents = orders.reduce((sum, o) => sum + (o.seller_payout_cents || 0), 0)
    }
  }

  const totalDownloads = allProducts.reduce((sum, p) => sum + (p.download_count || 0), 0)

  const { data: tierStats } = await admin
    .from('seller_stats')
    .select('tier, next_tier, next_tier_requirements, quality_letter, avg_quality_score')
    .eq('seller_id', user.id)
    .maybeSingle()

  const currentTier = (tierStats?.tier ?? 'unverified') as SellerTier
  const nextTier = (tierStats?.next_tier ?? null) as SellerTier | null
  const nextRequirements = (tierStats?.next_tier_requirements ?? []) as TierRequirement[]

  // Status icon and color helper
  const statusConfig: Record<string, { icon: typeof CheckCircle; color: string; bg: string }> = {
    approved: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-400/10' },
    pending: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
    draft: { icon: AlertCircle, color: 'text-(--color-text-secondary)', bg: 'bg-gray-400/10' },
    rejected: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-400/10' },
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Welcome header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">Welcome, {profile.display_name || 'Seller'}</h1>
            <SellerRankBadge rankKey={profile.seller_rank_key as SellerRankKey | null} size="pill" />
            <SellerTierBadge tier={currentTier} />
          </div>
          <p className="text-(--color-text-secondary) mt-1">Manage your products and track your sales</p>
          {(() => {
            const currentSort = profile.seller_rank_sort ?? 1
            const xp = Number(profile.seller_xp ?? 0)
            const nextRank = ALL_RANKS.find((r) => {
              const idx = ALL_RANKS.findIndex((x) => x.key === r.key)
              return idx === currentSort && r.group !== 'apex'
            })
            if (!nextRank) return null
            const nextThreshold = RANK_XP_THRESHOLDS[nextRank.key]
            const pct = nextThreshold > 0 ? Math.min(100, Math.round((xp / nextThreshold) * 100)) : 0
            return (
              <div className="mt-3 max-w-md">
                <div className="flex items-center justify-between text-xs text-(--color-text-secondary) mb-1">
                  <span className="font-medium">Next rank: <span className="text-foreground">{nextRank.label}</span></span>
                  <span>{xp.toLocaleString()} / {nextThreshold.toLocaleString()} XP</span>
                </div>
                <div className="h-2 bg-(--color-elevated) overflow-hidden">
                  <div className="h-full bg-(--brand-primary) transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })()}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/seller/orders"
            className="inline-flex items-center gap-2 border border-(--color-border) bg-(--color-surface) hover:bg-(--color-elevated) text-(--color-text-primary) px-4 py-2.5 rounded-none text-sm font-medium transition-colors"
          >
            <Clock className="h-4 w-4" />
            Incoming Orders
          </Link>
          <Link
            href="/seller/services"
            className="inline-flex items-center gap-2 border border-(--color-border) bg-(--color-surface) hover:bg-(--color-elevated) text-(--color-text-primary) px-4 py-2.5 rounded-none text-sm font-medium transition-colors"
          >
            <Briefcase className="h-4 w-4" />
            My Services
          </Link>
          <Link
            href="/seller/products/new"
            className="inline-flex items-center gap-2 bg-(--brand-primary) hover:opacity-90 text-white px-5 py-2.5 rounded-none font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            Upload Product
          </Link>
        </div>
      </div>

      {/* Tier progress panel */}
      {nextTier && nextRequirements.length > 0 && (
        <div className="bg-(--color-surface) border border-(--color-border) rounded-none p-5 mb-8">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <p className="text-xs uppercase tracking-wider text-(--color-text-muted)">Progress to next tier</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-(--color-text-secondary)">Next:</span>
                <SellerTierBadge tier={nextTier} />
              </div>
            </div>
            {tierStats?.quality_letter && (
              <div className="text-right">
                <p className="text-xs uppercase tracking-wider text-(--color-text-muted)">Your quality GPA</p>
                <p className="text-2xl font-bold">
                  {tierStats.quality_letter}
                  <span className="text-sm text-(--color-text-muted) font-normal ml-1">
                    ({Number(tierStats.avg_quality_score ?? 0).toFixed(0)})
                  </span>
                </p>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {nextRequirements.map((r) => (
              <div
                key={r.label}
                className={`flex items-center justify-between gap-3 px-3 py-2 border text-sm ${
                  r.met ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  {r.met ? (
                    <Check className="h-4 w-4 text-green-600 shrink-0" />
                  ) : (
                    <X className="h-4 w-4 text-gray-400 shrink-0" />
                  )}
                  <span className="truncate">{r.label}</span>
                </span>
                <span className="text-xs font-mono shrink-0">
                  <span className={r.met ? 'text-green-700' : 'text-gray-600'}>{r.current}</span>
                  <span className="text-gray-400 mx-1">/</span>
                  <span className="text-gray-600">{r.target}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats grid — 4 key metrics at a glance */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Earnings', value: `$${(totalSalesCents / 100).toFixed(2)}`, icon: DollarSign, color: 'text-green-400' },
          { label: 'Total Sales', value: totalOrders.toString(), icon: FileCode, color: 'text-(--brand-primary)' },
          { label: 'Total Downloads', value: totalDownloads.toString(), icon: Download, color: 'text-blue-400' },
          { label: 'Products', value: allProducts.length.toString(), icon: Star, color: 'text-yellow-400' },
        ].map((stat) => (
          <div key={stat.label} className="bg-(--color-surface) border border-(--color-border) rounded-none p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-(--color-text-muted)">{stat.label}</span>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
            <span className="text-2xl font-bold">{stat.value}</span>
          </div>
        ))}
      </div>

      {/* Quick status summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Approved', count: approved.length, status: 'approved' },
          { label: 'Pending Review', count: pending.length, status: 'pending' },
          { label: 'Drafts', count: drafts.length, status: 'draft' },
          { label: 'Rejected', count: rejected.length, status: 'rejected' },
        ].map((item) => {
          const config = statusConfig[item.status]
          const Icon = config.icon
          return (
            <div key={item.status} className={`${config.bg} border border-(--color-border) rounded-none p-4 flex items-center gap-3`}>
              <Icon className={`h-5 w-5 ${config.color}`} />
              <div>
                <span className="text-lg font-bold">{item.count}</span>
                <p className="text-xs text-(--color-text-muted)">{item.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Products table */}
      <div className="bg-(--color-surface) border border-(--color-border) rounded-none overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-(--color-border)">
          <h2 className="text-lg font-semibold">Your Products</h2>
          <Link href="/seller/products/new" className="text-(--brand-primary) hover:text-(--brand-primary) text-sm flex items-center gap-1">
            Add New <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {allProducts.length === 0 ? (
          <div className="p-12 text-center">
            <FileCode className="h-12 w-12 text-gray-700 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No products yet</h3>
            <p className="text-(--color-text-muted) mb-4">Upload your first product to start selling on CodeVault</p>
            <Link
              href="/seller/products/new"
              className="inline-flex items-center gap-2 bg-(--brand-primary) hover:opacity-90 text-white px-5 py-2.5 rounded-none font-medium transition-colors"
            >
              <Plus className="h-4 w-4" />
              Upload Product
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-(--color-elevated)">
                <tr>
                  <th className="text-left px-5 py-3 text-(--color-text-secondary) font-medium">Product</th>
                  <th className="text-left px-5 py-3 text-(--color-text-secondary) font-medium">Status</th>
                  <th className="text-right px-5 py-3 text-(--color-text-secondary) font-medium">Price</th>
                  <th className="text-right px-5 py-3 text-(--color-text-secondary) font-medium">Downloads</th>
                  <th className="text-right px-5 py-3 text-(--color-text-secondary) font-medium">Rating</th>
                  <th className="text-right px-5 py-3 text-(--color-text-secondary) font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {allProducts.map((product) => {
                  const config = statusConfig[product.status] || statusConfig.draft
                  const Icon = config.icon
                  return (
                    <tr key={product.id} className="hover:bg-(--color-elevated) transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {product.thumbnail_url ? (
                            <img src={product.thumbnail_url} alt="" className="w-10 h-10 rounded object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded bg-(--color-elevated) flex items-center justify-center">
                              <FileCode className="h-5 w-5 text-(--color-text-muted)" />
                            </div>
                          )}
                          <span className="font-medium text-(--color-text-primary) line-clamp-1">{product.title}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${config.color}`}>
                          <Icon className="h-3.5 w-3.5" />
                          {product.status.charAt(0).toUpperCase() + product.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right text-(--color-text-secondary)">
                        ${(product.price_cents / 100).toFixed(2)}
                      </td>
                      <td className="px-5 py-4 text-right text-(--color-text-secondary)">
                        {product.download_count || 0}
                      </td>
                      <td className="px-5 py-4 text-right text-(--color-text-secondary)">
                        {product.avg_rating ? `${Number(product.avg_rating).toFixed(1)} (${product.review_count})` : '-'}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/seller/products/${product.id}/edit`}
                          className="text-(--brand-primary) hover:text-(--brand-primary) text-xs font-medium"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

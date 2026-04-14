// Seller Tier computation — Sprint 2.2.
//
// Pulls live signals from products / product_analyses / orders / reviews /
// product_ownership_checks / users and writes a single `seller_stats` row
// per seller. A trigger on seller_stats keeps users.seller_tier in sync so
// the badge is cheap to render.
//
// Call sites:
//   - src/app/api/webhooks/stripe/route.ts     — after order marked complete
//   - src/lib/analysis/store.ts                — after a product analysis runs
//   - admin-triggered recompute endpoint (future)

import { getSupabaseAdmin } from '@/lib/supabase/server'

export type SellerTier = 'unverified' | 'verified' | 'pro' | 'elite'

export interface SellerStats {
  sellerId: string
  tier: SellerTier
  avgQualityScore: number | null
  qualityLetter: string | null
  totalProducts: number
  totalSales: number
  totalRevenueCents: number
  refundRate: number
  avgRating: number | null
  tenureDays: number
  verifiedOwnershipCount: number
  stolenProductCount: number
  nextTier: SellerTier | null
  nextTierRequirements: TierRequirement[]
}

export interface TierRequirement {
  label: string
  target: string
  current: string
  met: boolean
}

/**
 * Recompute a single seller's tier. Safe to call opportunistically from
 * webhooks; failures are swallowed (a missed tier refresh isn't worth
 * rolling back an order).
 */
export async function recomputeSellerTier(sellerId: string): Promise<SellerStats | null> {
  try {
    const stats = await collectStats(sellerId)
    if (!stats) return null
    const tier = decideTier(stats)
    const { nextTier, requirements } = progressToNextTier(stats, tier)

    const admin = getSupabaseAdmin()
    await admin
      .from('seller_stats')
      .upsert(
        {
          seller_id: sellerId,
          tier,
          avg_quality_score: stats.avgQualityScore,
          quality_letter: stats.qualityLetter,
          total_products: stats.totalProducts,
          total_sales: stats.totalSales,
          total_revenue_cents: stats.totalRevenueCents,
          refund_rate: stats.refundRate,
          avg_rating: stats.avgRating,
          tenure_days: stats.tenureDays,
          verified_ownership_count: stats.verifiedOwnershipCount,
          stolen_product_count: stats.stolenProductCount,
          next_tier: nextTier,
          next_tier_requirements: requirements,
          computed_at: new Date().toISOString(),
        },
        { onConflict: 'seller_id' },
      )

    return { ...stats, tier, sellerId, nextTier, nextTierRequirements: requirements }
  } catch {
    return null
  }
}

/**
 * Batch recompute. Used by admin endpoint or cron. Runs sequentially to
 * keep load predictable — a seller marketplace will have thousands of
 * sellers, not millions.
 */
export async function recomputeAllSellers(): Promise<{ updated: number; failed: number }> {
  const admin = getSupabaseAdmin()
  const { data } = await admin
    .from('users')
    .select('id')
    .in('role', ['seller', 'admin'])

  let updated = 0
  let failed = 0
  for (const row of data ?? []) {
    const res = await recomputeSellerTier(row.id)
    if (res) updated++
    else failed++
  }
  return { updated, failed }
}

// ─── Data collection ──────────────────────────────────────────────

interface RawStats {
  sellerId: string
  avgQualityScore: number | null
  qualityLetter: string | null
  totalProducts: number
  totalSales: number
  totalRevenueCents: number
  refundRate: number
  avgRating: number | null
  tenureDays: number
  verifiedOwnershipCount: number
  stolenProductCount: number
}

async function collectStats(sellerId: string): Promise<RawStats | null> {
  const admin = getSupabaseAdmin()

  const { data: user } = await admin
    .from('users')
    .select('id, created_at')
    .eq('id', sellerId)
    .maybeSingle()
  if (!user) return null

  const { data: products } = await admin
    .from('products')
    .select('id, avg_rating, review_count')
    .eq('seller_id', sellerId)
    .eq('status', 'approved')

  const productIds = (products ?? []).map((p) => p.id)
  const totalProducts = productIds.length

  // Quality: join on product_analyses for approved products only.
  let avgQualityScore: number | null = null
  if (productIds.length > 0) {
    const { data: analyses } = await admin
      .from('product_analyses')
      .select('quality_score')
      .in('product_id', productIds)
      .eq('status', 'completed')
    const scored = (analyses ?? []).filter((a) => typeof a.quality_score === 'number')
    if (scored.length > 0) {
      const sum = scored.reduce((s, a) => s + (a.quality_score ?? 0), 0)
      avgQualityScore = Math.round((sum / scored.length) * 100) / 100
    }
  }

  // Rating: weight by review_count so a 5.0 from 1 review doesn't beat 4.8 from 200.
  let avgRating: number | null = null
  const rated = (products ?? []).filter((p) => (p.review_count ?? 0) > 0)
  if (rated.length > 0) {
    const totalWeight = rated.reduce((s, p) => s + (p.review_count ?? 0), 0)
    const weighted = rated.reduce((s, p) => s + (p.avg_rating ?? 0) * (p.review_count ?? 0), 0)
    avgRating = totalWeight > 0 ? Math.round((weighted / totalWeight) * 100) / 100 : null
  }

  // Sales + refunds.
  let totalSales = 0
  let totalRevenueCents = 0
  let refundRate = 0
  if (productIds.length > 0) {
    const { data: orders } = await admin
      .from('orders')
      .select('status, seller_payout_cents')
      .in('product_id', productIds)

    const rows = orders ?? []
    const completed = rows.filter((o) => o.status === 'completed')
    const refunded = rows.filter((o) => o.status === 'refunded')
    totalSales = completed.length
    totalRevenueCents = completed.reduce((s, o) => s + (o.seller_payout_cents ?? 0), 0)
    const denom = completed.length + refunded.length
    refundRate = denom > 0 ? Math.round((refunded.length / denom) * 10_000) / 10_000 : 0
  }

  // Ownership verdicts from Phase 4.
  let verifiedOwnershipCount = 0
  let stolenProductCount = 0
  if (productIds.length > 0) {
    const { data: checks } = await admin
      .from('product_ownership_checks')
      .select('verdict')
      .in('product_id', productIds)
    for (const c of checks ?? []) {
      if (c.verdict === 'verified' || c.verdict === 'ok') verifiedOwnershipCount++
      if (c.verdict === 'stolen') stolenProductCount++
    }
  }

  const tenureDays = Math.floor(
    (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24),
  )

  return {
    sellerId,
    avgQualityScore,
    qualityLetter: scoreToLetter(avgQualityScore),
    totalProducts,
    totalSales,
    totalRevenueCents,
    refundRate,
    avgRating,
    tenureDays,
    verifiedOwnershipCount,
    stolenProductCount,
  }
}

function scoreToLetter(score: number | null): string | null {
  if (score === null) return null
  if (score >= 85) return 'A'
  if (score >= 70) return 'B'
  if (score >= 55) return 'C'
  if (score >= 40) return 'D'
  return 'F'
}

// ─── Tier decision ────────────────────────────────────────────────

const THRESHOLDS = {
  verified: { products: 1, tenureDays: 30 },
  pro: { products: 5, quality: 70, rating: 4.0, sales: 20, refundRate: 0.1, tenureDays: 60 },
  elite: { products: 10, quality: 82, rating: 4.5, sales: 100, refundRate: 0.05, tenureDays: 180 },
} as const

function decideTier(s: RawStats): SellerTier {
  // Any stolen product permanently blocks promotion beyond unverified.
  if (s.stolenProductCount > 0) return 'unverified'

  const elite = THRESHOLDS.elite
  if (
    s.totalProducts >= elite.products &&
    (s.avgQualityScore ?? 0) >= elite.quality &&
    (s.avgRating ?? 0) >= elite.rating &&
    s.totalSales >= elite.sales &&
    s.refundRate <= elite.refundRate &&
    s.tenureDays >= elite.tenureDays &&
    s.verifiedOwnershipCount >= 1
  ) {
    return 'elite'
  }

  const pro = THRESHOLDS.pro
  if (
    s.totalProducts >= pro.products &&
    (s.avgQualityScore ?? 0) >= pro.quality &&
    (s.avgRating ?? 0) >= pro.rating &&
    s.totalSales >= pro.sales &&
    s.refundRate <= pro.refundRate &&
    s.tenureDays >= pro.tenureDays
  ) {
    return 'pro'
  }

  const v = THRESHOLDS.verified
  if (s.totalProducts >= v.products && s.tenureDays >= v.tenureDays) {
    return 'verified'
  }

  return 'unverified'
}

// ─── Next-tier progress for the dashboard ─────────────────────────

function progressToNextTier(
  s: RawStats,
  current: SellerTier,
): { nextTier: SellerTier | null; requirements: TierRequirement[] } {
  if (current === 'elite') return { nextTier: null, requirements: [] }

  if (current === 'unverified') {
    const v = THRESHOLDS.verified
    return {
      nextTier: 'verified',
      requirements: [
        req('Approved products', `${v.products}`, `${s.totalProducts}`, s.totalProducts >= v.products),
        req('Days on platform', `${v.tenureDays}`, `${s.tenureDays}`, s.tenureDays >= v.tenureDays),
        req('No stolen verdicts', '0', `${s.stolenProductCount}`, s.stolenProductCount === 0),
      ],
    }
  }

  if (current === 'verified') {
    const p = THRESHOLDS.pro
    return {
      nextTier: 'pro',
      requirements: [
        req('Approved products', `${p.products}`, `${s.totalProducts}`, s.totalProducts >= p.products),
        req('Avg quality score', `≥${p.quality}`, formatScore(s.avgQualityScore), (s.avgQualityScore ?? 0) >= p.quality),
        req('Avg rating', `≥${p.rating.toFixed(1)}`, formatRating(s.avgRating), (s.avgRating ?? 0) >= p.rating),
        req('Completed sales', `≥${p.sales}`, `${s.totalSales}`, s.totalSales >= p.sales),
        req('Refund rate', `≤${(p.refundRate * 100).toFixed(0)}%`, formatRate(s.refundRate), s.refundRate <= p.refundRate),
        req('Tenure days', `≥${p.tenureDays}`, `${s.tenureDays}`, s.tenureDays >= p.tenureDays),
      ],
    }
  }

  // current === 'pro'
  const e = THRESHOLDS.elite
  return {
    nextTier: 'elite',
    requirements: [
      req('Approved products', `≥${e.products}`, `${s.totalProducts}`, s.totalProducts >= e.products),
      req('Avg quality score', `≥${e.quality}`, formatScore(s.avgQualityScore), (s.avgQualityScore ?? 0) >= e.quality),
      req('Avg rating', `≥${e.rating.toFixed(1)}`, formatRating(s.avgRating), (s.avgRating ?? 0) >= e.rating),
      req('Completed sales', `≥${e.sales}`, `${s.totalSales}`, s.totalSales >= e.sales),
      req('Refund rate', `≤${(e.refundRate * 100).toFixed(0)}%`, formatRate(s.refundRate), s.refundRate <= e.refundRate),
      req('Tenure days', `≥${e.tenureDays}`, `${s.tenureDays}`, s.tenureDays >= e.tenureDays),
      req('Verified ownership on ≥1 product', '≥1', `${s.verifiedOwnershipCount}`, s.verifiedOwnershipCount >= 1),
    ],
  }
}

function req(label: string, target: string, current: string, met: boolean): TierRequirement {
  return { label, target, current, met }
}

function formatScore(n: number | null): string {
  return n === null ? '—' : n.toFixed(0)
}
function formatRating(n: number | null): string {
  return n === null ? '—' : n.toFixed(2)
}
function formatRate(r: number): string {
  return (r * 100).toFixed(1) + '%'
}

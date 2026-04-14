// /my-journey — the seller's Far Cry-style progression map.
//
// The page is dark and moody by design. Locked regions show fog +
// the unlock condition. Unlocked regions glow. As the seller delivers
// orders, earns reviews, and gains XP, more of the map reveals.
//
// All data is derived server-side from existing tables — no new state
// is stored per-user. The "unlock" is a pure function of seller XP +
// order history.

import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Lock, Tent, Hammer, Store, ShieldCheck, Compass,
  Crown, Hexagon, Zap, Star, TrendingUp, ChevronRight,
} from 'lucide-react'
import { createClient, getSupabaseAdmin } from '@/lib/supabase/server'
import { requireBetaFeature } from '@/lib/feature-flags'
import {
  SellerRankBadge,
  type SellerRankKey,
} from '@/components/seller/seller-rank-badge'

export const dynamic = 'force-dynamic'

interface JourneyData {
  rankKey: SellerRankKey
  rankSort: number
  xp: number
  completedServiceOrders: number
  completedProductOrders: number
  fiveStarReviews: number
  approvedProducts: number
}

export default async function MyJourneyPage() {
  requireBetaFeature('journey')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/my-journey')

  const admin = getSupabaseAdmin()

  const [
    { data: profile },
    { count: serviceOrdersCount },
    { count: productOrdersCount },
    { count: fiveStarCount },
    { count: approvedCount },
  ] = await Promise.all([
    admin
      .from('users')
      .select('role, seller_rank_key, seller_rank_sort, seller_xp')
      .eq('id', user.id)
      .maybeSingle(),
    admin
      .from('service_orders')
      .select('*', { count: 'exact', head: true })
      .eq('seller_id', user.id)
      .eq('status', 'completed'),
    admin
      .from('orders')
      .select('*, products!inner(seller_id)', { count: 'exact', head: true })
      .eq('products.seller_id', user.id)
      .eq('status', 'completed'),
    admin
      .from('service_reviews')
      .select('*', { count: 'exact', head: true })
      .eq('seller_id', user.id)
      .gte('rating', 5),
    admin
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('seller_id', user.id)
      .eq('status', 'approved'),
  ])

  if (!profile || !['seller', 'admin'].includes(profile.role)) {
    redirect('/register?role=seller')
  }

  const journey: JourneyData = {
    rankKey: (profile.seller_rank_key ?? 'recruit') as SellerRankKey,
    rankSort: profile.seller_rank_sort ?? 1,
    xp: Number(profile.seller_xp ?? 0),
    completedServiceOrders: serviceOrdersCount ?? 0,
    completedProductOrders: productOrdersCount ?? 0,
    fiveStarReviews: fiveStarCount ?? 0,
    approvedProducts: approvedCount ?? 0,
  }

  const regions = computeRegions(journey)
  const totalRegions = regions.length
  const unlockedCount = regions.filter((r) => r.unlocked).length
  const pct = Math.round((unlockedCount / totalRegions) * 100)

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0f1c] via-[#0d1524] to-[#0a0f1c] text-white">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-white/5">
        <div
          aria-hidden
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 20% 0%, rgba(27,107,58,0.35), transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(232,134,26,0.25), transparent 50%)',
          }}
        />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center gap-2 text-xs text-white/50 uppercase tracking-[0.2em] mb-3">
            <Compass className="h-3.5 w-3.5" />
            Your journey
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            The map reveals itself.
          </h1>
          <p className="text-white/70 mt-3 max-w-xl">
            Every delivery, every five-star review, every milestone pulls back
            the fog. Seven regions. One legend.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-5">
            <SellerRankBadge rankKey={journey.rankKey} size="large" />
            <div className="flex-1 min-w-[240px] max-w-md">
              <div className="flex items-center justify-between text-xs text-white/60 mb-2">
                <span className="uppercase tracking-wider">Map progress</span>
                <span className="font-semibold text-white">
                  {unlockedCount} / {totalRegions} regions
                </span>
              </div>
              <div className="h-2 bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#1B6B3A] to-[#34D399] transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex items-center gap-3 mt-3 text-xs text-white/60">
                <span>
                  <span className="font-semibold text-white">
                    {journey.xp.toLocaleString()}
                  </span>{' '}
                  XP
                </span>
                <span>·</span>
                <span>
                  <span className="font-semibold text-white">
                    {journey.completedServiceOrders + journey.completedProductOrders}
                  </span>{' '}
                  deliveries
                </span>
                <span>·</span>
                <span>
                  <span className="font-semibold text-white">
                    {journey.fiveStarReviews}
                  </span>{' '}
                  five-stars
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Regions */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-4">
          {regions.map((region, idx) => (
            <RegionCard key={region.key} region={region} index={idx} />
          ))}
        </div>

        <div className="mt-12 border border-white/10 bg-white/[0.02] p-6">
          <div className="flex items-start gap-3">
            <TrendingUp className="h-5 w-5 text-[#34D399] mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Want to move faster?</p>
              <p className="text-sm text-white/60 mt-1">
                Every completed order is +50 XP. Every five-star review is +30
                XP. On-time delivery adds another +25 XP. The fog lifts with
                every delivery.
              </p>
              <Link
                href="/seller/dashboard"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[#34D399] hover:text-white"
              >
                Back to dashboard
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Region definitions + unlock logic ─────────────────────────────

interface Region {
  key: string
  name: string
  tagline: string
  Icon: typeof Tent
  accent: string
  unlocked: boolean
  completed: boolean
  unlockReq: string
  rewards: string[]
  progress?: { current: number; target: number; label: string }
}

function computeRegions(j: JourneyData): Region[] {
  const totalDeliveries = j.completedServiceOrders + j.completedProductOrders

  return [
    {
      key: 'base_camp',
      name: 'Base Camp',
      tagline: 'Where every Legend begins.',
      Icon: Tent,
      accent: '#9CA3AF',
      unlocked: true,
      completed: j.approvedProducts > 0 || totalDeliveries > 0,
      unlockReq: 'Always open.',
      rewards: ['Profile activated', 'Listing privileges'],
      progress: {
        current: Math.min(1, j.approvedProducts > 0 ? 1 : 0),
        target: 1,
        label: 'First approved listing',
      },
    },
    {
      key: 'the_forge',
      name: 'The Forge',
      tagline: 'First delivery. The hammer swings.',
      Icon: Hammer,
      accent: '#6B7280',
      unlocked: totalDeliveries >= 1,
      completed: j.fiveStarReviews >= 1,
      unlockReq: 'Complete your first order.',
      rewards: ['Cadet I rank', 'Delivery track record', 'Forge glyph'],
      progress: {
        current: Math.min(j.fiveStarReviews, 1),
        target: 1,
        label: 'First five-star review',
      },
    },
    {
      key: 'market_square',
      name: 'Market Square',
      tagline: 'The crowd notices you.',
      Icon: Store,
      accent: '#3B82F6',
      unlocked: j.rankSort >= 4, // Cadet III
      completed: totalDeliveries >= 10,
      unlockReq: 'Reach Cadet III (600 XP).',
      rewards: ['Increased visibility', 'Repeat-buyer badge'],
      progress: {
        current: Math.min(totalDeliveries, 10),
        target: 10,
        label: 'Complete 10 deliveries',
      },
    },
    {
      key: 'officers_barracks',
      name: "Officer's Barracks",
      tagline: 'Trusted with real client work.',
      Icon: ShieldCheck,
      accent: '#1D4ED8',
      unlocked: j.rankSort >= 5, // Officer I
      completed: j.rankSort >= 8,
      unlockReq: 'Reach Officer I (1,000 XP).',
      rewards: ['Featured placement eligibility', 'Officer glyph'],
      progress: {
        current: Math.min(j.rankSort, 8),
        target: 8,
        label: 'Reach Captain I',
      },
    },
    {
      key: 'captains_bridge',
      name: "Captain's Bridge",
      tagline: 'You run the delivery. It does not run you.',
      Icon: Crown,
      accent: '#7C3AED',
      unlocked: j.rankSort >= 8, // Captain I
      completed: j.rankSort >= 14,
      unlockReq: 'Reach Captain I (3,500 XP).',
      rewards: ['Premium service tier', 'Priority support'],
      progress: {
        current: Math.min(j.rankSort, 14),
        target: 14,
        label: 'Reach General I',
      },
    },
    {
      key: 'generals_citadel',
      name: "General's Citadel",
      tagline: 'Top 1%. The citadel is yours.',
      Icon: Star,
      accent: '#DC2626',
      unlocked: j.rankSort >= 14, // General I
      completed: j.rankSort >= 22,
      unlockReq: 'Reach General I (20,000 XP).',
      rewards: ['Ambassador program', 'Custom profile frame'],
      progress: {
        current: Math.min(j.rankSort, 22),
        target: 22,
        label: 'Reach Obsidian',
      },
    },
    {
      key: 'founders_summit',
      name: "Founder's Summit",
      tagline: 'Invite-only. Signed by the CEO.',
      Icon: Hexagon,
      accent: '#1B6B3A',
      unlocked: j.rankSort >= 25, // Founder or Legend
      completed: j.rankSort >= 26,
      unlockReq: 'Invitation from Solaris Empire leadership.',
      rewards: ['Founder rank', 'Legendary certificate', 'Apex cosmetics'],
    },
  ]
}

// ─── Region card component ─────────────────────────────────────────

function RegionCard({ region, index }: { region: Region; index: number }) {
  const Icon = region.Icon
  const pct = region.progress
    ? Math.round((region.progress.current / region.progress.target) * 100)
    : 0

  if (!region.unlocked) {
    return (
      <div className="relative border border-white/5 bg-white/[0.02] p-5 overflow-hidden">
        {/* Fog overlay */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, rgba(15,20,35,0.7) 0%, rgba(15,20,35,0.9) 100%)',
            backdropFilter: 'blur(1px)',
          }}
        />
        <div className="relative flex items-start gap-4">
          <div className="h-14 w-14 bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
            <Lock className="h-6 w-6 text-white/40" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-white/40 uppercase tracking-wider mb-1">
              Region {String(index + 1).padStart(2, '0')}
              <span>·</span>
              <span>Locked</span>
            </div>
            <p className="text-lg font-bold text-white/60 blur-[1px]">{region.name}</p>
            <p className="text-sm text-white/40 mt-1">{region.unlockReq}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="relative border p-5 overflow-hidden transition-all hover:border-white/20"
      style={{
        borderColor: `${region.accent}40`,
        background: `linear-gradient(135deg, ${region.accent}10 0%, rgba(255,255,255,0.01) 100%)`,
        boxShadow: region.completed ? `0 0 24px ${region.accent}25` : undefined,
      }}
    >
      <div className="flex items-start gap-4">
        <div
          className="h-14 w-14 flex items-center justify-center shrink-0 text-white"
          style={{
            backgroundColor: region.accent,
            boxShadow: region.completed ? `0 0 16px ${region.accent}80` : undefined,
          }}
        >
          <Icon className="h-7 w-7" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-white/50 uppercase tracking-wider mb-1">
            Region {String(index + 1).padStart(2, '0')}
            <span>·</span>
            {region.completed ? (
              <span className="text-[#34D399] font-semibold">Liberated</span>
            ) : (
              <span className="text-white/70">Unlocked</span>
            )}
          </div>
          <h3 className="text-xl font-bold">{region.name}</h3>
          <p className="text-sm text-white/70 mt-1">{region.tagline}</p>

          {region.progress && !region.completed && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-white/60 mb-1.5">
                <span>{region.progress.label}</span>
                <span className="font-semibold text-white">
                  {region.progress.current} / {region.progress.target}
                </span>
              </div>
              <div className="h-1.5 bg-white/10 overflow-hidden">
                <div
                  className="h-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: region.accent }}
                />
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {region.rewards.map((reward) => (
              <span
                key={reward}
                className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider px-2 py-1"
                style={{
                  color: region.accent,
                  backgroundColor: `${region.accent}15`,
                  border: `1px solid ${region.accent}30`,
                }}
              >
                <Zap className="h-2.5 w-2.5" />
                {reward}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

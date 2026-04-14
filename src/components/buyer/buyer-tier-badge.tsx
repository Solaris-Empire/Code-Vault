// Buyer tier badge — Explorer → Member → Regular → Trusted → VIP → Patron.
//
// Mirrors SellerRankBadge API so both sides of the marketplace feel
// cohesive. Shown in the account dropdown, buyer dashboard, and on
// review avatars so sellers can see they're dealing with a VIP.

import {
  Eye, UserPlus, Users, Heart, Crown, Gem,
  type LucideIcon,
} from 'lucide-react'

export type BuyerTier =
  | 'explorer'
  | 'member'
  | 'regular'
  | 'trusted'
  | 'vip'
  | 'patron'

interface TierMeta {
  label: string
  Icon: LucideIcon
  color: string
  glow?: string
  perks: string[]
}

const TIER_META: Record<BuyerTier, TierMeta> = {
  explorer: {
    label: 'Explorer',
    Icon: Eye,
    color: '#9CA3AF',
    perks: ['Browse the marketplace', 'Save for later'],
  },
  member: {
    label: 'Member',
    Icon: UserPlus,
    color: '#3B82F6',
    perks: ['Leave reviews', 'Purchase history', 'Wishlist'],
  },
  regular: {
    label: 'Regular',
    Icon: Users,
    color: '#1D4ED8',
    perks: ['5% off every purchase', 'Priority download queue'],
  },
  trusted: {
    label: 'Trusted',
    Icon: Heart,
    color: '#7C3AED',
    perks: ['Early access to new drops', '10% off', 'Trusted-buyer badge'],
  },
  vip: {
    label: 'VIP',
    Icon: Crown,
    color: '#DC2626',
    glow: '#F87171',
    perks: ['Priority support', '15% off', 'VIP badge on reviews'],
  },
  patron: {
    label: 'Patron',
    Icon: Gem,
    color: '#1B6B3A',
    glow: '#34D399',
    perks: ['All VIP perks', 'Exclusive map regions', 'Direct founder chat'],
  },
}

interface Props {
  tier: BuyerTier | null | undefined
  size?: 'inline' | 'pill' | 'large'
  className?: string
}

export function BuyerTierBadge({ tier, size = 'pill', className = '' }: Props) {
  const meta = TIER_META[tier ?? 'explorer'] ?? TIER_META.explorer
  const Icon = meta.Icon
  const isPremium = tier === 'vip' || tier === 'patron'

  if (size === 'inline') {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 text-white ${className}`}
        style={{
          backgroundColor: meta.color,
          boxShadow: isPremium && meta.glow ? `0 0 8px ${meta.glow}` : undefined,
        }}
        title={meta.label}
      >
        <Icon className="h-2.5 w-2.5" />
        {meta.label}
      </span>
    )
  }

  if (size === 'large') {
    return (
      <div
        className={`inline-flex flex-col gap-2 px-5 py-4 border text-white ${className}`}
        style={{
          backgroundColor: meta.color,
          borderColor: meta.glow ?? meta.color,
          boxShadow: isPremium && meta.glow ? `0 0 20px ${meta.glow}40` : undefined,
        }}
      >
        <div className="flex items-center gap-3">
          <Icon className="h-7 w-7" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] opacity-80">Buyer tier</p>
            <p className="font-display text-2xl font-bold leading-none mt-0.5">{meta.label}</p>
          </div>
        </div>
        <ul className="text-xs space-y-1 opacity-90">
          {meta.perks.map((perk) => (
            <li key={perk}>· {perk}</li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider px-2.5 py-1 text-white ${className}`}
      style={{
        backgroundColor: meta.color,
        boxShadow: isPremium && meta.glow ? `0 0 10px ${meta.glow}80` : undefined,
      }}
      title={meta.perks.join(' · ')}
    >
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  )
}

export function buyerTierMeta(tier: BuyerTier | null | undefined) {
  return TIER_META[tier ?? 'explorer'] ?? TIER_META.explorer
}

export const ALL_BUYER_TIERS: Array<{ tier: BuyerTier } & TierMeta> = (
  Object.entries(TIER_META) as Array<[BuyerTier, TierMeta]>
).map(([tier, meta]) => ({ tier, ...meta }))

// Reusable tier badge. Three sizes — avatar (inline with a name), pill
// (card-style), and large (dashboard header).

import { Sparkles, ShieldCheck, Award, Gem } from 'lucide-react'
import type { SellerTier } from '@/lib/seller/tier'

interface Props {
  tier: SellerTier
  size?: 'avatar' | 'pill' | 'large'
  className?: string
}

export function SellerTierBadge({ tier, size = 'pill', className = '' }: Props) {
  const cfg = tierStyles(tier)
  const Icon = cfg.Icon

  if (size === 'avatar') {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 ${cfg.bg} ${cfg.text} ${className}`}
        title={cfg.blurb}
      >
        <Icon className="h-2.5 w-2.5" />
        {cfg.label}
      </span>
    )
  }

  if (size === 'large') {
    return (
      <div className={`inline-flex items-center gap-3 px-4 py-3 ${cfg.bg} ${cfg.text} border ${cfg.border} ${className}`}>
        <Icon className="h-6 w-6" />
        <div>
          <p className="text-xs uppercase tracking-[0.15em] opacity-80">Seller tier</p>
          <p className="font-display text-xl font-bold leading-none mt-1">{cfg.label}</p>
        </div>
      </div>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider px-2.5 py-1 ${cfg.bg} ${cfg.text} ${className}`}
      title={cfg.blurb}
    >
      <Icon className="h-3.5 w-3.5" />
      {cfg.label}
    </span>
  )
}

function tierStyles(tier: SellerTier) {
  switch (tier) {
    case 'elite':
      return {
        Icon: Gem,
        label: 'Elite',
        bg: 'bg-gradient-to-r from-purple-500 to-pink-500',
        text: 'text-white',
        border: 'border-purple-300',
        blurb: 'Top tier: ≥10 products, A-grade quality, ≥100 sales, <5% refunds.',
      }
    case 'pro':
      return {
        Icon: Award,
        label: 'Pro',
        bg: 'bg-(--brand-amber)',
        text: 'text-white',
        border: 'border-amber-300',
        blurb: 'Pro tier: ≥5 products, B-grade quality, ≥20 sales, <10% refunds.',
      }
    case 'verified':
      return {
        Icon: ShieldCheck,
        label: 'Verified',
        bg: 'bg-(--brand-primary)',
        text: 'text-white',
        border: 'border-green-300',
        blurb: 'Verified seller: approved products, ≥30 days tenure, no stolen code.',
      }
    default:
      return {
        Icon: Sparkles,
        label: 'New',
        bg: 'bg-gray-100',
        text: 'text-gray-700',
        border: 'border-gray-200',
        blurb: 'New seller — still building a track record.',
      }
  }
}

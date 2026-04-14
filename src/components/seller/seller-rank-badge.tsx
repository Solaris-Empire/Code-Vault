// Seller rank badge — 26-rank progression ladder.
//
// Three sizes: inline (next to a name), pill (card), large (dashboard).
// Rank data is sourced from users.seller_rank_key; the icon/color/glow
// map lives here in the client so we don't need to fetch seller_ranks
// on every render.

import {
  Sparkles, Shield, ShieldCheck, Award, Crown, Star,
  Medal, Trophy, Gem, Flame, Zap, Hexagon, Infinity as InfinityIcon,
  type LucideIcon,
} from 'lucide-react'

export type SellerRankKey =
  | 'recruit'
  | 'cadet_1' | 'cadet_2' | 'cadet_3'
  | 'officer_1' | 'officer_2' | 'officer_3'
  | 'captain_1' | 'captain_2' | 'captain_3'
  | 'commander_1' | 'commander_2' | 'commander_3'
  | 'general_1' | 'general_2' | 'general_3'
  | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'obsidian'
  | 'mythic' | 'titan'
  | 'founder' | 'legend'

interface RankMeta {
  label: string
  Icon: LucideIcon
  color: string
  glow?: string
  group: 'recruit' | 'military' | 'metal' | 'prestige' | 'apex'
}

const RANK_META: Record<SellerRankKey, RankMeta> = {
  recruit:      { label: 'Recruit',       Icon: Sparkles,     color: '#9CA3AF', group: 'recruit' },
  cadet_1:      { label: 'Cadet I',       Icon: Shield,       color: '#6B7280', group: 'military' },
  cadet_2:      { label: 'Cadet II',      Icon: Shield,       color: '#6B7280', group: 'military' },
  cadet_3:      { label: 'Cadet III',     Icon: Shield,       color: '#6B7280', group: 'military' },
  officer_1:    { label: 'Officer I',     Icon: ShieldCheck,  color: '#3B82F6', group: 'military' },
  officer_2:    { label: 'Officer II',    Icon: ShieldCheck,  color: '#3B82F6', group: 'military' },
  officer_3:    { label: 'Officer III',   Icon: ShieldCheck,  color: '#3B82F6', group: 'military' },
  captain_1:    { label: 'Captain I',     Icon: Award,        color: '#1D4ED8', group: 'military' },
  captain_2:    { label: 'Captain II',    Icon: Award,        color: '#1D4ED8', group: 'military' },
  captain_3:    { label: 'Captain III',   Icon: Award,        color: '#1D4ED8', group: 'military' },
  commander_1:  { label: 'Commander I',   Icon: Crown,        color: '#7C3AED', group: 'military' },
  commander_2:  { label: 'Commander II',  Icon: Crown,        color: '#7C3AED', group: 'military' },
  commander_3:  { label: 'Commander III', Icon: Crown,        color: '#7C3AED', group: 'military' },
  general_1:    { label: 'General I',     Icon: Star,         color: '#DC2626', group: 'military' },
  general_2:    { label: 'General II',    Icon: Star,         color: '#DC2626', group: 'military' },
  general_3:    { label: 'General III',   Icon: Star,         color: '#DC2626', group: 'military' },
  bronze:       { label: 'Bronze',        Icon: Medal,        color: '#A16207', glow: '#F59E0B', group: 'metal' },
  silver:       { label: 'Silver',        Icon: Medal,        color: '#9CA3AF', glow: '#E5E7EB', group: 'metal' },
  gold:         { label: 'Gold',          Icon: Medal,        color: '#EAB308', glow: '#FDE047', group: 'metal' },
  platinum:     { label: 'Platinum',      Icon: Trophy,       color: '#06B6D4', glow: '#67E8F9', group: 'metal' },
  diamond:      { label: 'Diamond',       Icon: Gem,          color: '#8B5CF6', glow: '#C4B5FD', group: 'metal' },
  obsidian:     { label: 'Obsidian',      Icon: Gem,          color: '#18181B', glow: '#52525B', group: 'metal' },
  mythic:       { label: 'Mythic',        Icon: Flame,        color: '#F97316', glow: '#FB923C', group: 'prestige' },
  titan:        { label: 'Titan',         Icon: Zap,          color: '#10B981', glow: '#6EE7B7', group: 'prestige' },
  founder:      { label: 'Founder',       Icon: Hexagon,      color: '#1B6B3A', glow: '#34D399', group: 'apex' },
  legend:       { label: 'Legend',        Icon: InfinityIcon, color: '#B91C1C', glow: '#F87171', group: 'apex' },
}

interface Props {
  rankKey: SellerRankKey | null | undefined
  size?: 'inline' | 'pill' | 'large'
  className?: string
  showXp?: { current: number; nextThreshold: number } | null
}

export function SellerRankBadge({ rankKey, size = 'pill', className = '', showXp }: Props) {
  const meta = RANK_META[rankKey ?? 'recruit'] ?? RANK_META.recruit
  const Icon = meta.Icon
  const isPrestige = meta.group === 'prestige' || meta.group === 'apex'

  if (size === 'inline') {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 text-white ${className}`}
        style={{
          backgroundColor: meta.color,
          boxShadow: isPrestige && meta.glow ? `0 0 8px ${meta.glow}` : undefined,
        }}
        title={meta.label}
      >
        <Icon className="h-2.5 w-2.5" />
        {meta.label}
      </span>
    )
  }

  if (size === 'large') {
    const pct = showXp && showXp.nextThreshold > 0
      ? Math.min(100, Math.round((showXp.current / showXp.nextThreshold) * 100))
      : null

    return (
      <div
        className={`inline-flex flex-col gap-2 px-5 py-4 border text-white ${className}`}
        style={{
          backgroundColor: meta.color,
          borderColor: meta.glow ?? meta.color,
          boxShadow: isPrestige && meta.glow ? `0 0 20px ${meta.glow}40` : undefined,
        }}
      >
        <div className="flex items-center gap-3">
          <Icon className="h-7 w-7" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] opacity-80">Rank</p>
            <p className="font-display text-2xl font-bold leading-none mt-0.5">{meta.label}</p>
          </div>
        </div>
        {pct !== null && (
          <div className="w-full">
            <div className="h-1.5 bg-white/20 overflow-hidden">
              <div className="h-full bg-white" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-[10px] opacity-80 mt-1">{showXp!.current.toLocaleString()} / {showXp!.nextThreshold.toLocaleString()} XP</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider px-2.5 py-1 text-white ${className}`}
      style={{
        backgroundColor: meta.color,
        boxShadow: isPrestige && meta.glow ? `0 0 10px ${meta.glow}80` : undefined,
      }}
      title={meta.label}
    >
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  )
}

export function rankMeta(rankKey: SellerRankKey | null | undefined) {
  return RANK_META[rankKey ?? 'recruit'] ?? RANK_META.recruit
}

export const ALL_RANKS: Array<{ key: SellerRankKey } & RankMeta> = (
  Object.entries(RANK_META) as Array<[SellerRankKey, RankMeta]>
).map(([key, meta]) => ({ key, ...meta }))

// Shared types + helpers for the DevSocial feed.
//
// Hashtag / tech-stack extraction lives here so the API route and
// the client compose box stay in agreement on what counts as a tag.

import type { SellerRankKey } from '@/components/seller/seller-rank-badge'
import type { BuyerTier } from '@/components/buyer/buyer-tier-badge'

export type { BuyerTier } from '@/components/buyer/buyer-tier-badge'

export interface FeedPost {
  id: string
  author_id: string
  body: string
  code_snippet: string | null
  code_language: string | null
  image_url: string | null
  hashtags: string[]
  tech_stack_tags: string[]
  product_id: string | null
  like_count: number
  comment_count: number
  created_at: string
  author_name: string | null
  author_avatar: string | null
  author_role: string
  author_rank_key: SellerRankKey | null
  author_buyer_tier: BuyerTier | null
  viewer_liked: boolean
}

export const POST_MAX_LEN = 2000
export const COMMENT_MAX_LEN = 500
export const CODE_MAX_LEN = 8000
export const HASHTAG_MAX = 10
export const TECH_STACK_MAX = 8

// Small curated set — lets the compose box surface quick-pick chips.
// More can be typed by hand; this is just UX sugar.
export const TECH_STACK_OPTIONS = [
  'react', 'nextjs', 'vue', 'svelte', 'angular',
  'typescript', 'javascript', 'python', 'go', 'rust',
  'php', 'laravel', 'wordpress',
  'nodejs', 'bun', 'deno',
  'postgres', 'supabase', 'mysql', 'mongodb', 'redis',
  'tailwind', 'flutter', 'react-native',
  'docker', 'kubernetes', 'aws', 'vercel', 'cloudflare',
] as const

// Languages supported by most syntax highlighters; used in the
// compose box dropdown. Free-form values are still accepted.
export const CODE_LANGUAGES = [
  'typescript', 'tsx', 'javascript', 'jsx',
  'python', 'go', 'rust', 'php', 'ruby',
  'java', 'kotlin', 'swift', 'c', 'cpp', 'csharp',
  'sql', 'bash', 'json', 'yaml', 'html', 'css',
] as const

// Extract `#tags` from a body. Lowercased, deduped, capped.
export function extractHashtags(body: string): string[] {
  const matches = body.match(/#(\w{2,30})/g) ?? []
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of matches) {
    const tag = m.slice(1).toLowerCase()
    if (!seen.has(tag)) {
      seen.add(tag)
      out.push(tag)
      if (out.length >= HASHTAG_MAX) break
    }
  }
  return out
}

// Normalise user-supplied tech-stack chips: lowercase, dedupe, cap.
export function normaliseTechStack(tags: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of tags) {
    const t = raw.trim().toLowerCase()
    if (!t || t.length > 30 || seen.has(t)) continue
    seen.add(t)
    out.push(t)
    if (out.length >= TECH_STACK_MAX) break
  }
  return out
}

// "2 minutes ago" style stamps — tiny, no dayjs dependency.
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diffSec = Math.max(1, Math.floor((now - then) / 1000))
  if (diffSec < 60)     return `${diffSec}s ago`
  const min = Math.floor(diffSec / 60)
  if (min < 60)         return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24)          return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7)          return `${day}d ago`
  const wk = Math.floor(day / 7)
  if (wk < 5)           return `${wk}w ago`
  const mo = Math.floor(day / 30)
  if (mo < 12)          return `${mo}mo ago`
  const yr = Math.floor(day / 365)
  return `${yr}y ago`
}

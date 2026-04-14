// Seller rank + XP helpers.
//
// `awardSellerXp` wraps the `award_seller_xp` Postgres RPC. It is
// fire-and-forget from the caller's perspective: if the grant fails we
// log and keep going so a flaky XP update can never break an order
// completion / review / approval. Every caller must pass a stable
// dedup_key so webhook retries don't double-award.

import { getSupabaseAdmin } from '@/lib/supabase/server'
import type { SellerRankKey } from '@/components/seller/seller-rank-badge'

export const XP_REWARDS = {
  ORDER_COMPLETED: 50,
  FIVE_STAR_REVIEW: 30,
  ON_TIME_DELIVERY: 25,
  PRODUCT_APPROVED: 100,
  PRODUCT_ORDER_COMPLETED: 50,
} as const

export type XpEventType =
  | 'order_completed'
  | 'five_star'
  | 'on_time'
  | 'product_approved'
  | 'product_order_completed'
  | 'combo_bonus'
  | 'admin_grant'
  | 'invite_grant'

interface AwardInput {
  sellerId: string
  eventType: XpEventType
  xpDelta: number
  dedupKey: string
  sourceTable?: string
  sourceId?: string
  metadata?: Record<string, unknown>
}

interface AwardResult {
  newTotalXp: number
  rankKey: SellerRankKey
  rankName: string
  sortOrder: number
  promoted: boolean
}

export async function awardSellerXp(input: AwardInput): Promise<AwardResult | null> {
  try {
    const admin = getSupabaseAdmin()
    const { data, error } = await admin.rpc('award_seller_xp', {
      p_seller_id: input.sellerId,
      p_event_type: input.eventType,
      p_xp_delta: input.xpDelta,
      p_dedup_key: input.dedupKey,
      p_source_table: input.sourceTable ?? null,
      p_source_id: input.sourceId ?? null,
      p_metadata: input.metadata ?? null,
    })

    if (error) {
      console.error('[awardSellerXp] RPC error', { dedupKey: input.dedupKey, error: error.message })
      return null
    }

    const row = Array.isArray(data) ? data[0] : data
    if (!row) return null

    return {
      newTotalXp: Number(row.new_total_xp ?? 0),
      rankKey: row.rank_key as SellerRankKey,
      rankName: row.rank_name as string,
      sortOrder: Number(row.sort_order ?? 1),
      promoted: Boolean(row.promoted),
    }
  } catch (err) {
    console.error('[awardSellerXp] unexpected error', {
      dedupKey: input.dedupKey,
      err: err instanceof Error ? err.message : err,
    })
    return null
  }
}

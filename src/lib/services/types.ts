// Shared types for the hire-the-seller marketplace (Sprint 3).
// Mirrors public.seller_services / service_orders / service_messages.

import type { SellerTier } from '@/lib/seller/tier'
import type { SellerRankKey } from '@/components/seller/seller-rank-badge'

export type ServiceTier = 'vibe' | 'real'
export type ServicePricingModel = 'fixed' | 'hourly'
export type ServiceStatus = 'draft' | 'pending' | 'approved' | 'paused' | 'rejected'

export type ServiceOrderStatus =
  | 'awaiting_payment'
  | 'in_progress'
  | 'delivered'
  | 'revision_requested'
  | 'completed'
  | 'cancelled'
  | 'disputed'
  | 'refunded'

export interface SellerServiceRow {
  id: string
  seller_id: string
  tier: ServiceTier
  category_id: string | null
  title: string
  slug: string
  short_description: string | null
  description: string
  thumbnail_url: string | null
  tags: string[] | null
  pricing_model: ServicePricingModel
  price_cents: number
  hourly_rate_cents: number | null
  min_hours: number | null
  delivery_days: number
  revisions_included: number
  status: ServiceStatus
  rejection_reason: string | null
  order_count: number
  avg_rating: number | null
  review_count: number
  created_at: string
  updated_at: string
}

export interface SellerServiceListRow extends SellerServiceRow {
  seller?: {
    id: string
    display_name: string | null
    avatar_url: string | null
    seller_tier: SellerTier | null
    seller_rank_key: SellerRankKey | null
  } | null
  category?: { name: string; slug: string } | null
}

export interface ServiceOrderRow {
  id: string
  service_id: string
  buyer_id: string
  seller_id: string
  amount_cents: number
  platform_fee_cents: number
  seller_payout_cents: number
  stripe_payment_id: string | null
  stripe_transfer_id: string | null
  brief: string
  requirements: Record<string, unknown>
  delivery_due_at: string | null
  delivered_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  delivery_assets: unknown[]
  delivery_note: string | null
  revision_count: number
  status: ServiceOrderStatus
  created_at: string
  updated_at: string
}

export interface ServiceMessageRow {
  id: string
  order_id: string
  sender_id: string
  body: string
  attachments: unknown[]
  read_at: string | null
  created_at: string
}

export interface ServiceReviewRow {
  id: string
  order_id: string
  service_id: string
  buyer_id: string
  seller_id: string
  rating: number
  comment: string | null
  created_at: string
  updated_at: string
}

export type ServiceDisputeStatus =
  | 'open'
  | 'needs_info'
  | 'resolved_buyer'
  | 'resolved_seller'
  | 'cancelled'

export interface ServiceDisputeRow {
  id: string
  order_id: string
  opened_by: string
  reason: string
  evidence: unknown[]
  status: ServiceDisputeStatus
  admin_notes: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

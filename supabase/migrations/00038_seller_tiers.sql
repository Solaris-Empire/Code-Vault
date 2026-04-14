-- Seller Tier System — Sprint 2.2
--
-- Tiers reward sellers with measurably good code, strong sales, low refund
-- rate, verified ownership, and tenure. Tier is visible on avatars everywhere.
--
--   unverified → new seller or failing thresholds
--   verified   → ≥1 approved product, no stolen verdicts, ≥30 days
--   pro        → ≥5 products, avg quality ≥70, avg rating ≥4.0, ≥20 sales,
--                refund rate <10%, tenure ≥60 days
--   elite      → ≥10 products, avg quality ≥82, avg rating ≥4.5, ≥100 sales,
--                refund rate <5%, tenure ≥180 days, at least one 'verified'
--                ownership verdict
--
-- A seller_stats row is upserted whenever we recompute (order completion,
-- product analysis completion, or admin-triggered cron).

-- ─── ENUM ──────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.seller_tier AS ENUM ('unverified', 'verified', 'pro', 'elite');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ─── users.seller_tier denormalized column ─────────────────────────
-- Keeps the tier available for cheap avatar-badge rendering without
-- joining seller_stats on every product card query.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS seller_tier public.seller_tier NOT NULL DEFAULT 'unverified';

-- ─── seller_stats ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.seller_stats (
  seller_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,

  tier public.seller_tier NOT NULL DEFAULT 'unverified',

  -- Quality GPA: average of product_analyses.quality_score across all
  -- approved products. NULL when seller has no scored products.
  avg_quality_score NUMERIC(5,2),
  quality_letter CHAR(1),

  -- Sales / money
  total_products INTEGER NOT NULL DEFAULT 0,
  total_sales INTEGER NOT NULL DEFAULT 0,
  total_revenue_cents BIGINT NOT NULL DEFAULT 0,

  -- Trust
  refund_rate NUMERIC(5,4) NOT NULL DEFAULT 0,
  avg_rating NUMERIC(3,2),
  tenure_days INTEGER NOT NULL DEFAULT 0,

  -- Ownership health (Phase 4 signal)
  verified_ownership_count INTEGER NOT NULL DEFAULT 0,
  stolen_product_count INTEGER NOT NULL DEFAULT 0,

  -- Progress-to-next-tier metadata so dashboards can show a checklist.
  next_tier public.seller_tier,
  next_tier_requirements JSONB,

  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seller_stats_tier ON public.seller_stats(tier);
CREATE INDEX IF NOT EXISTS idx_seller_stats_computed ON public.seller_stats(computed_at);

-- ─── RLS ────────────────────────────────────────────────────────────

ALTER TABLE public.seller_stats ENABLE ROW LEVEL SECURITY;

-- Public read: tier badges + marketing numbers.
DROP POLICY IF EXISTS "Public can read seller stats" ON public.seller_stats;
CREATE POLICY "Public can read seller stats"
  ON public.seller_stats
  FOR SELECT
  USING (TRUE);

-- Writes only via service role (the compute function runs server-side).
DROP POLICY IF EXISTS "Service role can write seller stats" ON public.seller_stats;
CREATE POLICY "Service role can write seller stats"
  ON public.seller_stats
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- ─── Trigger: keep users.seller_tier in sync ────────────────────────
-- When seller_stats is upserted the denormalized column on users gets
-- updated in the same transaction. Buyers browsing product cards see
-- the new badge immediately.

CREATE OR REPLACE FUNCTION public.sync_user_seller_tier()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.users
     SET seller_tier = NEW.tier
   WHERE id = NEW.seller_id
     AND seller_tier IS DISTINCT FROM NEW.tier;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_user_seller_tier ON public.seller_stats;
CREATE TRIGGER trg_sync_user_seller_tier
  AFTER INSERT OR UPDATE OF tier ON public.seller_stats
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_seller_tier();

-- Buyer Perks — Phase 5 Sprint A.final
--
-- Buyers get their own progression: Explorer → Member → Regular →
-- Trusted → VIP → Patron. Tiers are auto-computed from completed
-- purchase count (product orders + service orders). Patron is a
-- paid-membership flag that bypasses the count gate.
--
-- Tier perks (rendered UI-side):
--   Explorer  (0)      — account created, browsing only
--   Member    (1+)     — can leave reviews, wishlist, purchase history
--   Regular   (3+)     — 5% platform discount code (future)
--   Trusted   (10+)    — early access to new drops + 10% off
--   VIP       (25+)    — priority support + 15% off + VIP badge
--   Patron    (premium)— all perks + exclusive map regions + founder chat

-- ─── ENUM ──────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.buyer_tier AS ENUM ('explorer', 'member', 'regular', 'trusted', 'vip', 'patron');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ─── users: denormalized buyer tier + counters ─────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS buyer_tier             public.buyer_tier NOT NULL DEFAULT 'explorer',
  ADD COLUMN IF NOT EXISTS buyer_purchase_count   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS buyer_total_spent_cents BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_premium             BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS premium_expires_at     TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_buyer_tier ON public.users(buyer_tier);
CREATE INDEX IF NOT EXISTS idx_users_is_premium ON public.users(is_premium) WHERE is_premium = TRUE;

-- ─── RPC: recompute_buyer_tier ─────────────────────────────────────
-- Idempotent recompute. Called after every completed order/service
-- order. Patron override wins unless premium_expires_at is in the past.

CREATE OR REPLACE FUNCTION public.recompute_buyer_tier(p_buyer_id UUID)
RETURNS public.buyer_tier
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_product_count INTEGER;
  v_service_count INTEGER;
  v_spent_cents   BIGINT;
  v_is_premium    BOOLEAN;
  v_premium_exp   TIMESTAMPTZ;
  v_total         INTEGER;
  v_tier          public.buyer_tier;
BEGIN
  SELECT is_premium, premium_expires_at
    INTO v_is_premium, v_premium_exp
    FROM public.users WHERE id = p_buyer_id;

  SELECT COUNT(*)::INTEGER, COALESCE(SUM(amount_cents), 0)::BIGINT
    INTO v_product_count, v_spent_cents
    FROM public.orders
   WHERE buyer_id = p_buyer_id AND status = 'completed';

  SELECT COUNT(*)::INTEGER
    INTO v_service_count
    FROM public.service_orders
   WHERE buyer_id = p_buyer_id AND status = 'completed';

  v_total := v_product_count + v_service_count;

  -- Premium membership — only valid if not expired.
  IF v_is_premium AND (v_premium_exp IS NULL OR v_premium_exp > NOW()) THEN
    v_tier := 'patron';
  ELSIF v_total >= 25 THEN
    v_tier := 'vip';
  ELSIF v_total >= 10 THEN
    v_tier := 'trusted';
  ELSIF v_total >= 3 THEN
    v_tier := 'regular';
  ELSIF v_total >= 1 THEN
    v_tier := 'member';
  ELSE
    v_tier := 'explorer';
  END IF;

  UPDATE public.users
     SET buyer_tier = v_tier,
         buyer_purchase_count = v_total,
         buyer_total_spent_cents = v_spent_cents
   WHERE id = p_buyer_id;

  RETURN v_tier;
END;
$$;

-- ─── Backfill: recompute tier for every existing user ──────────────
-- Safe to re-run. Skips rows with no orders (they stay at Explorer).

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT buyer_id AS id FROM public.orders WHERE status = 'completed'
    UNION
    SELECT DISTINCT buyer_id AS id FROM public.service_orders WHERE status = 'completed'
  LOOP
    PERFORM public.recompute_buyer_tier(r.id);
  END LOOP;
END $$;

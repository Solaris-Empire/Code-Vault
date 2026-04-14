-- Seller Rank Ladder — Phase 5 Sprint A
--
-- 26-rank progression ladder layered on top of the existing seller_tier
-- system. Tiers (unverified/verified/pro/elite) gate eligibility for
-- products and payouts; ranks are pure progression/gamification — a
-- visible number that ticks up and a badge that changes as the seller
-- delivers.
--
-- Progression groups:
--   1        Recruit              (Day 1)
--   2–4      Cadet   I/II/III     (military ascent)
--   5–7      Officer I/II/III
--   8–10     Captain I/II/III
--   11–13    Commander I/II/III
--   14–16    General I/II/III
--   17–22    Bronze → Silver → Gold → Platinum → Diamond → Obsidian   (metal ascent)
--   23       Mythic               (prestige)
--   24       Titan                (prestige)
--   25       Founder              (invite-only; CEO grants)
--   26       Legend               (all-time top-10 only)
--
-- XP sources (wired in Sprint A.5):
--   completed order                 +50 XP
--   5-star review                   +30 XP
--   on-time delivery (no revisions) +25 XP
--   approved product                +100 XP
--   combo streak milestone (x3/x5)  +bonus (Sprint C)
--
-- Rank is denormalized onto users.seller_rank_key for cheap badge
-- rendering on every product/service card.

-- ─── seller_ranks: static reference table ──────────────────────────

CREATE TABLE IF NOT EXISTS public.seller_ranks (
  rank_key          TEXT PRIMARY KEY,                  -- 'recruit', 'cadet_1', 'legend'
  rank_name         TEXT NOT NULL,                     -- 'Cadet I', 'Diamond', 'Legend'
  rank_group        TEXT NOT NULL,                     -- 'recruit' | 'military' | 'metal' | 'prestige' | 'apex'
  sort_order        INTEGER NOT NULL UNIQUE,           -- 1..26
  xp_required       INTEGER NOT NULL,                  -- cumulative XP to reach this rank
  badge_icon        TEXT NOT NULL,                     -- lucide icon name or emoji fallback
  badge_color_hex   TEXT NOT NULL,                     -- primary badge color
  badge_glow_hex    TEXT,                              -- optional outer glow (prestige+)
  invite_only       BOOLEAN NOT NULL DEFAULT FALSE,    -- founder/legend: XP alone is not enough
  description       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_seller_ranks_sort_order ON public.seller_ranks(sort_order);

-- ─── users: denormalized rank + XP columns ─────────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS seller_rank_key       TEXT REFERENCES public.seller_ranks(rank_key),
  ADD COLUMN IF NOT EXISTS seller_rank_sort      INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS seller_xp             BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seller_xp_updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_users_seller_rank_sort ON public.users(seller_rank_sort DESC);
CREATE INDEX IF NOT EXISTS idx_users_seller_xp ON public.users(seller_xp DESC);

-- ─── seller_xp_events: append-only XP ledger ──────────────────────
-- Every XP grant writes a row. Lets us replay totals, show the
-- seller's journey feed, and prevents double-counting via dedup_key.

CREATE TABLE IF NOT EXISTS public.seller_xp_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_type     TEXT NOT NULL,                        -- 'order_completed', 'five_star', 'on_time', 'product_approved', 'combo_bonus', 'admin_grant'
  xp_delta       INTEGER NOT NULL,                     -- positive or negative
  dedup_key      TEXT,                                 -- e.g. 'order:<uuid>:completed' — unique per seller
  source_table   TEXT,                                 -- 'service_orders' | 'orders' | 'reviews' | 'products'
  source_id      UUID,
  metadata       JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (seller_id, dedup_key)
);

CREATE INDEX IF NOT EXISTS idx_xp_events_seller_created ON public.seller_xp_events(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_xp_events_type ON public.seller_xp_events(event_type);

-- ─── RLS ────────────────────────────────────────────────────────────

ALTER TABLE public.seller_ranks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_xp_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read seller ranks" ON public.seller_ranks;
CREATE POLICY "Public can read seller ranks"
  ON public.seller_ranks FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Service role manages seller ranks" ON public.seller_ranks;
CREATE POLICY "Service role manages seller ranks"
  ON public.seller_ranks FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- XP events: sellers see their own ledger. No one writes from the client.
DROP POLICY IF EXISTS "Sellers read own xp events" ON public.seller_xp_events;
CREATE POLICY "Sellers read own xp events"
  ON public.seller_xp_events FOR SELECT
  USING (seller_id = auth.uid());

DROP POLICY IF EXISTS "Service role manages xp events" ON public.seller_xp_events;
CREATE POLICY "Service role manages xp events"
  ON public.seller_xp_events FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ─── RPC: award_seller_xp ──────────────────────────────────────────
-- Idempotent XP grant. Returns the seller's new total + current rank.
-- Callers: order completion webhook, review insert trigger, product
-- approval flow. Dedup key prevents double-awarding on retries.

CREATE OR REPLACE FUNCTION public.award_seller_xp(
  p_seller_id   UUID,
  p_event_type  TEXT,
  p_xp_delta    INTEGER,
  p_dedup_key   TEXT DEFAULT NULL,
  p_source_table TEXT DEFAULT NULL,
  p_source_id   UUID DEFAULT NULL,
  p_metadata    JSONB DEFAULT NULL
)
RETURNS TABLE (
  new_total_xp  BIGINT,
  rank_key      TEXT,
  rank_name     TEXT,
  sort_order    INTEGER,
  promoted      BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_id UUID;
  v_old_sort    INTEGER;
  v_new_total   BIGINT;
  v_rank        public.seller_ranks%ROWTYPE;
  v_promoted    BOOLEAN := FALSE;
BEGIN
  -- Dedup: if dedup_key already exists for this seller, short-circuit.
  IF p_dedup_key IS NOT NULL THEN
    SELECT id INTO v_existing_id
      FROM public.seller_xp_events
     WHERE seller_id = p_seller_id AND dedup_key = p_dedup_key
     LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      SELECT u.seller_xp, u.seller_rank_key, u.seller_rank_sort
        INTO v_new_total, v_rank.rank_key, v_rank.sort_order
        FROM public.users u
       WHERE u.id = p_seller_id;

      SELECT sr.rank_name INTO v_rank.rank_name
        FROM public.seller_ranks sr
       WHERE sr.rank_key = v_rank.rank_key;

      RETURN QUERY SELECT v_new_total, v_rank.rank_key, v_rank.rank_name, v_rank.sort_order, FALSE;
      RETURN;
    END IF;
  END IF;

  -- Capture old rank for promotion detection.
  SELECT seller_rank_sort INTO v_old_sort
    FROM public.users WHERE id = p_seller_id;

  -- Insert XP event.
  INSERT INTO public.seller_xp_events
    (seller_id, event_type, xp_delta, dedup_key, source_table, source_id, metadata)
  VALUES
    (p_seller_id, p_event_type, p_xp_delta, p_dedup_key, p_source_table, p_source_id, p_metadata);

  -- Bump total.
  UPDATE public.users
     SET seller_xp = seller_xp + p_xp_delta,
         seller_xp_updated_at = NOW()
   WHERE id = p_seller_id
  RETURNING seller_xp INTO v_new_total;

  -- Recompute rank: highest rank whose xp_required <= new total.
  -- Invite-only ranks (founder, legend) are excluded from auto-promotion.
  SELECT * INTO v_rank
    FROM public.seller_ranks
   WHERE xp_required <= v_new_total
     AND invite_only = FALSE
   ORDER BY sort_order DESC
   LIMIT 1;

  IF v_rank.rank_key IS NULL THEN
    -- Seller is below Recruit somehow; shouldn't happen after seed.
    SELECT * INTO v_rank FROM public.seller_ranks ORDER BY sort_order ASC LIMIT 1;
  END IF;

  -- Apply new rank if different.
  IF v_rank.sort_order > COALESCE(v_old_sort, 0) THEN
    v_promoted := TRUE;
  END IF;

  UPDATE public.users
     SET seller_rank_key  = v_rank.rank_key,
         seller_rank_sort = v_rank.sort_order
   WHERE id = p_seller_id
     AND (seller_rank_key IS DISTINCT FROM v_rank.rank_key);

  RETURN QUERY SELECT v_new_total, v_rank.rank_key, v_rank.rank_name, v_rank.sort_order, v_promoted;
END;
$$;

-- ─── RPC: grant_invite_rank ────────────────────────────────────────
-- Admin-only path to assign Founder or Legend. Bypasses XP gate.

CREATE OR REPLACE FUNCTION public.grant_invite_rank(
  p_seller_id  UUID,
  p_rank_key   TEXT,
  p_admin_id   UUID,
  p_reason     TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rank public.seller_ranks%ROWTYPE;
BEGIN
  -- Caller must be an admin (checked via users.role).
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Only admins can grant invite ranks';
  END IF;

  SELECT * INTO v_rank FROM public.seller_ranks WHERE rank_key = p_rank_key;
  IF v_rank.rank_key IS NULL THEN
    RAISE EXCEPTION 'Unknown rank: %', p_rank_key;
  END IF;

  IF NOT v_rank.invite_only THEN
    RAISE EXCEPTION 'Rank % is earned via XP, not granted', p_rank_key;
  END IF;

  UPDATE public.users
     SET seller_rank_key  = v_rank.rank_key,
         seller_rank_sort = v_rank.sort_order
   WHERE id = p_seller_id;

  INSERT INTO public.seller_xp_events
    (seller_id, event_type, xp_delta, dedup_key, metadata)
  VALUES
    (p_seller_id, 'invite_grant', 0,
     'invite:' || p_rank_key || ':' || p_admin_id::text || ':' || extract(epoch from now())::bigint::text,
     jsonb_build_object('admin_id', p_admin_id, 'rank', p_rank_key, 'reason', p_reason));
END;
$$;

-- ─── Seed: the 26 ranks ────────────────────────────────────────────

INSERT INTO public.seller_ranks (rank_key, rank_name, rank_group, sort_order, xp_required, badge_icon, badge_color_hex, badge_glow_hex, invite_only, description) VALUES
  ('recruit',       'Recruit',       'recruit',  1,       0, 'Sparkles',       '#9CA3AF', NULL,       FALSE, 'Welcome. Every Legend started here.'),
  ('cadet_1',       'Cadet I',       'military', 2,     100, 'Shield',         '#6B7280', NULL,       FALSE, 'First steps — a completed delivery on record.'),
  ('cadet_2',       'Cadet II',      'military', 3,     300, 'Shield',         '#6B7280', NULL,       FALSE, 'Reliability proven across multiple orders.'),
  ('cadet_3',       'Cadet III',     'military', 4,     600, 'Shield',         '#6B7280', NULL,       FALSE, 'Earned the right to stand at attention.'),
  ('officer_1',     'Officer I',     'military', 5,    1000, 'ShieldCheck',    '#3B82F6', NULL,       FALSE, 'Trusted with real client work.'),
  ('officer_2',     'Officer II',    'military', 6,    1600, 'ShieldCheck',    '#3B82F6', NULL,       FALSE, 'Clients ask for you by name.'),
  ('officer_3',     'Officer III',   'military', 7,    2400, 'ShieldCheck',    '#3B82F6', NULL,       FALSE, 'Squad leader material.'),
  ('captain_1',     'Captain I',     'military', 8,    3500, 'Award',          '#1D4ED8', NULL,       FALSE, 'You run the delivery, not the other way around.'),
  ('captain_2',     'Captain II',    'military', 9,    5000, 'Award',          '#1D4ED8', NULL,       FALSE, 'A record clients bet on.'),
  ('captain_3',     'Captain III',   'military',10,    7000, 'Award',          '#1D4ED8', NULL,       FALSE, 'Veteran of the marketplace.'),
  ('commander_1',   'Commander I',   'military',11,    9500, 'Crown',          '#7C3AED', NULL,       FALSE, 'Sought-after expertise.'),
  ('commander_2',   'Commander II',  'military',12,   12500, 'Crown',          '#7C3AED', NULL,       FALSE, 'Your queue is the one everyone wants in.'),
  ('commander_3',   'Commander III', 'military',13,   16000, 'Crown',          '#7C3AED', NULL,       FALSE, 'You set the standard others chase.'),
  ('general_1',     'General I',     'military',14,   20000, 'Star',           '#DC2626', NULL,       FALSE, 'Elite operator. The top floor.'),
  ('general_2',     'General II',    'military',15,   25000, 'Star',           '#DC2626', NULL,       FALSE, 'Your name moves deals.'),
  ('general_3',     'General III',   'military',16,   31000, 'Star',           '#DC2626', NULL,       FALSE, 'A flag officer of the marketplace.'),
  ('bronze',        'Bronze',        'metal',   17,   38000, 'Medal',          '#A16207', '#F59E0B',  FALSE, 'Tempered — the military ladder is behind you.'),
  ('silver',        'Silver',        'metal',   18,   46000, 'Medal',          '#9CA3AF', '#E5E7EB',  FALSE, 'Forged. Visible on every card.'),
  ('gold',          'Gold',          'metal',   19,   56000, 'Medal',          '#EAB308', '#FDE047',  FALSE, 'Gold standard. Buyers filter to you.'),
  ('platinum',      'Platinum',      'metal',   20,   70000, 'Trophy',         '#06B6D4', '#67E8F9',  FALSE, 'Rarified air. Premium pricing unlocks.'),
  ('diamond',       'Diamond',       'metal',   21,   88000, 'Gem',            '#8B5CF6', '#C4B5FD',  FALSE, 'Diamond-rank sellers get featured placement.'),
  ('obsidian',      'Obsidian',      'metal',   22,  110000, 'Gem',            '#18181B', '#52525B',  FALSE, 'Forged in pressure. Fewer than 1%.'),
  ('mythic',        'Mythic',        'prestige',23,  140000, 'Flame',          '#F97316', '#FB923C',  FALSE, 'Stories are told about your deliveries.'),
  ('titan',         'Titan',         'prestige',24,  180000, 'Zap',            '#10B981', '#6EE7B7',  FALSE, 'Titan — the rarest organic climb.'),
  ('founder',       'Founder',       'apex',    25,       0, 'Hexagon',        '#1B6B3A', '#34D399',  TRUE,  'Invite-only. Granted by Solaris Empire leadership.'),
  ('legend',        'Legend',        'apex',    26,       0, 'Infinity',       '#B91C1C', '#F87171',  TRUE,  'All-time top-10. Signed by the CEO.')
ON CONFLICT (rank_key) DO UPDATE
  SET rank_name       = EXCLUDED.rank_name,
      rank_group      = EXCLUDED.rank_group,
      sort_order      = EXCLUDED.sort_order,
      xp_required     = EXCLUDED.xp_required,
      badge_icon      = EXCLUDED.badge_icon,
      badge_color_hex = EXCLUDED.badge_color_hex,
      badge_glow_hex  = EXCLUDED.badge_glow_hex,
      invite_only     = EXCLUDED.invite_only,
      description     = EXCLUDED.description;

-- ─── Backfill: every existing user starts at Recruit ───────────────

UPDATE public.users
   SET seller_rank_key  = 'recruit',
       seller_rank_sort = 1
 WHERE seller_rank_key IS NULL;

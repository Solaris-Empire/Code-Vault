-- Hire-the-seller marketplace — Sprint 3 Phase 1
--
-- Two service tiers, both powered by the same tables:
--   'vibe' — Fiverr-style fixed-scope gigs. Any seller can list.
--   'real' — Toptal-style vetted hires. Pro or Elite tier only.
--
-- Three tables:
--   seller_services   — the listing (title, price, delivery_days, tier, status)
--   service_orders    — a buyer hires a seller (includes brief + Stripe)
--   service_messages  — per-order chat thread between buyer and seller
--
-- RLS: public can read approved services, authenticated sellers manage
-- their own, buyers + sellers can read their own orders + messages.

-- ─── ENUMS ─────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.service_tier AS ENUM ('vibe', 'real');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.service_status AS ENUM ('draft', 'pending', 'approved', 'paused', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.service_pricing_model AS ENUM ('fixed', 'hourly');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.service_order_status AS ENUM (
    'awaiting_payment', 'in_progress', 'delivered', 'revision_requested',
    'completed', 'cancelled', 'disputed', 'refunded'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ─── seller_services ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.seller_services (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id          uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tier               public.service_tier NOT NULL,
  category_id        uuid REFERENCES public.categories(id) ON DELETE SET NULL,

  title              text NOT NULL,
  slug               text NOT NULL UNIQUE,
  short_description  text,
  description        text NOT NULL,
  thumbnail_url      text,
  tags               text[],

  pricing_model      public.service_pricing_model NOT NULL DEFAULT 'fixed',
  price_cents        integer NOT NULL CHECK (price_cents >= 0),
  hourly_rate_cents  integer CHECK (hourly_rate_cents IS NULL OR hourly_rate_cents >= 0),
  min_hours          integer CHECK (min_hours IS NULL OR min_hours > 0),

  delivery_days      integer NOT NULL CHECK (delivery_days BETWEEN 1 AND 365),
  revisions_included integer NOT NULL DEFAULT 1 CHECK (revisions_included >= 0),

  status             public.service_status NOT NULL DEFAULT 'draft',
  rejection_reason   text,

  order_count        integer NOT NULL DEFAULT 0,
  avg_rating         numeric(3,2),
  review_count       integer NOT NULL DEFAULT 0,

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seller_services_seller ON public.seller_services(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_services_status ON public.seller_services(status);
CREATE INDEX IF NOT EXISTS idx_seller_services_tier   ON public.seller_services(tier);
CREATE INDEX IF NOT EXISTS idx_seller_services_cat    ON public.seller_services(category_id);
CREATE INDEX IF NOT EXISTS idx_seller_services_tags   ON public.seller_services USING gin(tags);

-- Touch updated_at on every UPDATE.
CREATE OR REPLACE FUNCTION public.tg_seller_services_touch()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_seller_services_touch ON public.seller_services;
CREATE TRIGGER tg_seller_services_touch
  BEFORE UPDATE ON public.seller_services
  FOR EACH ROW EXECUTE FUNCTION public.tg_seller_services_touch();

-- ─── service_orders ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.service_orders (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id            uuid NOT NULL REFERENCES public.seller_services(id) ON DELETE RESTRICT,
  buyer_id              uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  seller_id             uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,

  amount_cents          integer NOT NULL CHECK (amount_cents >= 0),
  platform_fee_cents    integer NOT NULL CHECK (platform_fee_cents >= 0),
  seller_payout_cents   integer NOT NULL CHECK (seller_payout_cents >= 0),

  stripe_payment_id     text,
  stripe_transfer_id    text,

  brief                 text NOT NULL,
  requirements          jsonb NOT NULL DEFAULT '{}'::jsonb,

  delivery_due_at       timestamptz,
  delivered_at          timestamptz,
  completed_at          timestamptz,
  cancelled_at          timestamptz,

  delivery_assets       jsonb NOT NULL DEFAULT '[]'::jsonb,
  delivery_note         text,
  revision_count        integer NOT NULL DEFAULT 0,

  status                public.service_order_status NOT NULL DEFAULT 'awaiting_payment',

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_orders_service ON public.service_orders(service_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_buyer   ON public.service_orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_seller  ON public.service_orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_status  ON public.service_orders(status);

CREATE OR REPLACE FUNCTION public.tg_service_orders_touch()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_service_orders_touch ON public.service_orders;
CREATE TRIGGER tg_service_orders_touch
  BEFORE UPDATE ON public.service_orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_service_orders_touch();

-- ─── service_messages ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.service_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  sender_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body          text NOT NULL,
  attachments   jsonb NOT NULL DEFAULT '[]'::jsonb,
  read_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_messages_order   ON public.service_messages(order_id);
CREATE INDEX IF NOT EXISTS idx_service_messages_sender  ON public.service_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_service_messages_created ON public.service_messages(created_at);

-- ─── RLS ───────────────────────────────────────────────────────────

ALTER TABLE public.seller_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_messages ENABLE ROW LEVEL SECURITY;

-- seller_services: anyone can read APPROVED, sellers manage their own.
DROP POLICY IF EXISTS seller_services_public_read ON public.seller_services;
CREATE POLICY seller_services_public_read ON public.seller_services
  FOR SELECT USING (status = 'approved' OR seller_id = auth.uid());

DROP POLICY IF EXISTS seller_services_seller_write ON public.seller_services;
CREATE POLICY seller_services_seller_write ON public.seller_services
  FOR ALL USING (seller_id = auth.uid()) WITH CHECK (seller_id = auth.uid());

-- service_orders: buyer or seller on the order can read; nothing else.
DROP POLICY IF EXISTS service_orders_participant_read ON public.service_orders;
CREATE POLICY service_orders_participant_read ON public.service_orders
  FOR SELECT USING (buyer_id = auth.uid() OR seller_id = auth.uid());

DROP POLICY IF EXISTS service_orders_buyer_insert ON public.service_orders;
CREATE POLICY service_orders_buyer_insert ON public.service_orders
  FOR INSERT WITH CHECK (buyer_id = auth.uid());

DROP POLICY IF EXISTS service_orders_participant_update ON public.service_orders;
CREATE POLICY service_orders_participant_update ON public.service_orders
  FOR UPDATE USING (buyer_id = auth.uid() OR seller_id = auth.uid());

-- service_messages: only participants of the parent order.
DROP POLICY IF EXISTS service_messages_read ON public.service_messages;
CREATE POLICY service_messages_read ON public.service_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.service_orders o
      WHERE o.id = order_id
        AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS service_messages_insert ON public.service_messages;
CREATE POLICY service_messages_insert ON public.service_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.service_orders o
      WHERE o.id = order_id
        AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

-- ─── Tier gate enforcement ─────────────────────────────────────────
-- Block 'real' services unless the seller is pro or elite. Vibe is open.
-- Checked on INSERT/UPDATE so sellers can't bypass via draft→approve.

CREATE OR REPLACE FUNCTION public.tg_seller_services_tier_gate()
RETURNS TRIGGER AS $$
DECLARE
  tier_val public.seller_tier;
BEGIN
  IF NEW.tier = 'real' THEN
    SELECT seller_tier INTO tier_val FROM public.users WHERE id = NEW.seller_id;
    IF tier_val IS NULL OR tier_val NOT IN ('pro', 'elite') THEN
      RAISE EXCEPTION 'Real Coder listings require Pro or Elite seller tier';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_seller_services_tier_gate ON public.seller_services;
CREATE TRIGGER tg_seller_services_tier_gate
  BEFORE INSERT OR UPDATE OF tier, seller_id ON public.seller_services
  FOR EACH ROW EXECUTE FUNCTION public.tg_seller_services_tier_gate();

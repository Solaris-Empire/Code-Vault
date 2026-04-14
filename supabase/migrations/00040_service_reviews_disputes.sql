-- Sprint 3 Phase 4 — service reviews + dispute flow.
--
-- service_reviews   — one per completed service_order, by the buyer.
-- service_disputes  — opened by either participant from delivered/in_progress;
--                     flips the order to 'disputed' until admin resolution.
--
-- Triggers keep seller_services.avg_rating / review_count in sync.

-- ─── ENUMS ─────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.service_dispute_status AS ENUM (
    'open', 'needs_info', 'resolved_buyer', 'resolved_seller', 'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ─── service_reviews ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.service_reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL UNIQUE REFERENCES public.service_orders(id) ON DELETE CASCADE,
  service_id  uuid NOT NULL REFERENCES public.seller_services(id) ON DELETE CASCADE,
  buyer_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  seller_id   uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,

  rating      smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     text,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_reviews_service ON public.service_reviews(service_id);
CREATE INDEX IF NOT EXISTS idx_service_reviews_seller  ON public.service_reviews(seller_id);
CREATE INDEX IF NOT EXISTS idx_service_reviews_buyer   ON public.service_reviews(buyer_id);

-- ─── service_disputes ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.service_disputes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  opened_by     uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  reason        text NOT NULL,
  evidence      jsonb NOT NULL DEFAULT '[]'::jsonb,
  status        public.service_dispute_status NOT NULL DEFAULT 'open',
  admin_notes   text,
  resolved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_disputes_order  ON public.service_disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_service_disputes_status ON public.service_disputes(status);

-- Touch updated_at on UPDATE.
CREATE OR REPLACE FUNCTION public.tg_service_reviews_touch()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_service_reviews_touch ON public.service_reviews;
CREATE TRIGGER tg_service_reviews_touch
  BEFORE UPDATE ON public.service_reviews
  FOR EACH ROW EXECUTE FUNCTION public.tg_service_reviews_touch();

DROP TRIGGER IF EXISTS tg_service_disputes_touch ON public.service_disputes;
CREATE TRIGGER tg_service_disputes_touch
  BEFORE UPDATE ON public.service_disputes
  FOR EACH ROW EXECUTE FUNCTION public.tg_service_reviews_touch();

-- ─── Rating rollup trigger ─────────────────────────────────────────
-- Recomputes seller_services.avg_rating + review_count after insert/
-- update/delete of a review. Cheap even on popular listings.

CREATE OR REPLACE FUNCTION public.tg_service_reviews_rollup()
RETURNS TRIGGER AS $$
DECLARE
  target_service uuid := COALESCE(NEW.service_id, OLD.service_id);
  new_avg numeric(3,2);
  new_count integer;
BEGIN
  SELECT
    ROUND(AVG(rating)::numeric, 2),
    COUNT(*)
  INTO new_avg, new_count
  FROM public.service_reviews
  WHERE service_id = target_service;

  UPDATE public.seller_services
  SET avg_rating   = new_avg,
      review_count = COALESCE(new_count, 0)
  WHERE id = target_service;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_service_reviews_rollup ON public.service_reviews;
CREATE TRIGGER tg_service_reviews_rollup
  AFTER INSERT OR UPDATE OR DELETE ON public.service_reviews
  FOR EACH ROW EXECUTE FUNCTION public.tg_service_reviews_rollup();

-- ─── RLS ───────────────────────────────────────────────────────────

ALTER TABLE public.service_reviews  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_disputes ENABLE ROW LEVEL SECURITY;

-- service_reviews: public read (transparency), buyer on a completed order
-- can insert. Update/delete limited to the original buyer.
DROP POLICY IF EXISTS service_reviews_public_read ON public.service_reviews;
CREATE POLICY service_reviews_public_read ON public.service_reviews
  FOR SELECT USING (true);

DROP POLICY IF EXISTS service_reviews_buyer_insert ON public.service_reviews;
CREATE POLICY service_reviews_buyer_insert ON public.service_reviews
  FOR INSERT WITH CHECK (
    buyer_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.service_orders o
      WHERE o.id = order_id
        AND o.buyer_id = auth.uid()
        AND o.status = 'completed'
    )
  );

DROP POLICY IF EXISTS service_reviews_buyer_update ON public.service_reviews;
CREATE POLICY service_reviews_buyer_update ON public.service_reviews
  FOR UPDATE USING (buyer_id = auth.uid()) WITH CHECK (buyer_id = auth.uid());

DROP POLICY IF EXISTS service_reviews_buyer_delete ON public.service_reviews;
CREATE POLICY service_reviews_buyer_delete ON public.service_reviews
  FOR DELETE USING (buyer_id = auth.uid());

-- service_disputes: participants on the parent order can read/insert.
DROP POLICY IF EXISTS service_disputes_participant_read ON public.service_disputes;
CREATE POLICY service_disputes_participant_read ON public.service_disputes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.service_orders o
      WHERE o.id = order_id
        AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS service_disputes_participant_insert ON public.service_disputes;
CREATE POLICY service_disputes_participant_insert ON public.service_disputes
  FOR INSERT WITH CHECK (
    opened_by = auth.uid() AND EXISTS (
      SELECT 1 FROM public.service_orders o
      WHERE o.id = order_id
        AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

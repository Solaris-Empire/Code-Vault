-- Hire marketplace hardening — Phase 2 audit fixes.
--
-- Covers:
--   C2: service_orders UPDATE policy too permissive — drop it. All state
--       changes must go through server routes (service_role bypasses RLS).
--   C3: admin policy for service_disputes so admins can resolve them.
--   C4: UNIQUE(stripe_payment_id) on service_orders to prevent duplicate
--       order rows from webhook retries or client double-submit races.
--   H3: revisions_included_snapshot on service_orders — cap the buyer's
--       revisions at the value that was in force when the order was placed,
--       so the seller can't retroactively change the rules.

-- ── C2 ─────────────────────────────────────────────────────────────
-- The participant UPDATE policy allowed a logged-in buyer OR seller to
-- write to ANY column on their own row — including status, amount_cents,
-- stripe_payment_id, etc. No production code path uses the anon/auth key
-- to update service_orders (all transitions go through server routes
-- using the service role). Remove the policy outright.
DROP POLICY IF EXISTS service_orders_participant_update ON public.service_orders;

-- ── C3 ─────────────────────────────────────────────────────────────
-- Admin-only UPDATE on service_disputes. Participants can still INSERT
-- (open a dispute) and SELECT (read it), but only admins flip status,
-- write admin_notes, or set resolved_at.
DROP POLICY IF EXISTS service_disputes_admin_update ON public.service_disputes;
CREATE POLICY service_disputes_admin_update ON public.service_disputes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- ── C4 ─────────────────────────────────────────────────────────────
-- A Stripe PaymentIntent maps to exactly one service_order. Enforce at
-- the DB level so webhook retries / client double-submits can't ever
-- create duplicate paid orders. NULL is allowed (and repeatable) for
-- awaiting_payment rows that haven't been linked yet.
CREATE UNIQUE INDEX IF NOT EXISTS uq_service_orders_stripe_payment_id
  ON public.service_orders(stripe_payment_id)
  WHERE stripe_payment_id IS NOT NULL;

-- ── H3 ─────────────────────────────────────────────────────────────
-- Snapshot the revisions_included value at the time the order is placed
-- so that later edits to seller_services.revisions_included can't change
-- the cap for an in-flight order. Populate existing rows from the parent
-- service; new rows get populated by the order-creation endpoint.
ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS revisions_included_snapshot integer;

UPDATE public.service_orders so
   SET revisions_included_snapshot = COALESCE(s.revisions_included, 1)
  FROM public.seller_services s
 WHERE s.id = so.service_id
   AND so.revisions_included_snapshot IS NULL;

-- Once backfilled, tighten to NOT NULL with a safe default.
ALTER TABLE public.service_orders
  ALTER COLUMN revisions_included_snapshot SET DEFAULT 1,
  ALTER COLUMN revisions_included_snapshot SET NOT NULL;

-- ── M1 ─────────────────────────────────────────────────────────────
-- Same treatment for delivery_days: snapshot the promised turnaround at
-- order-creation time so the webhook computes delivery_due_at from the
-- value the buyer actually agreed to, not whatever the seller edited it
-- to between checkout and payment confirmation.
ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS delivery_days_snapshot integer;

UPDATE public.service_orders so
   SET delivery_days_snapshot = COALESCE(s.delivery_days, 7)
  FROM public.seller_services s
 WHERE s.id = so.service_id
   AND so.delivery_days_snapshot IS NULL;

ALTER TABLE public.service_orders
  ALTER COLUMN delivery_days_snapshot SET DEFAULT 7,
  ALTER COLUMN delivery_days_snapshot SET NOT NULL;

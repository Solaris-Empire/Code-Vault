-- ─── 00048: RLS & RPC hardening ─────────────────────────────────────
--
-- Two fixes surfaced by the Phase 11 RLS audit:
--
--   1. recompute_buyer_tier is SECURITY DEFINER and, by PostgreSQL
--      default, EXECUTE is granted to PUBLIC. That means any
--      authenticated user could call it via PostgREST RPC with an
--      arbitrary p_buyer_id and corrupt another user's tier / spend /
--      purchase count. The function is only ever invoked from server
--      routes holding the service-role key (checkout webhook + services
--      accept), so lock execute down to service_role.
--
--   2. product_fingerprints has RLS enabled but no policies, so it's
--      implicit-deny for everyone-but-service_role. Functionally
--      correct, but an explicit service-role policy documents intent
--      and survives a future accidental "FORCE RLS".
--
-- Safe to run repeatedly.

-- ─── 1. Lock down recompute_buyer_tier ─────────────────────────────

REVOKE ALL ON FUNCTION public.recompute_buyer_tier(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recompute_buyer_tier(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.recompute_buyer_tier(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_buyer_tier(UUID) TO service_role;

-- ─── 2. Document fingerprint intent with an explicit policy ────────

DROP POLICY IF EXISTS "service role only" ON public.product_fingerprints;
CREATE POLICY "service role only"
  ON public.product_fingerprints
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

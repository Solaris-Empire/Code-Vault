-- ─── 00049: SECURITY DEFINER lockdown ───────────────────────────────
--
-- Phase 12 audit found 8 SECURITY DEFINER functions with the same bug
-- class already fixed for recompute_buyer_tier in 00048: PostgreSQL
-- grants EXECUTE to PUBLIC by default, so any authenticated user could
-- call them via PostgREST RPC (/rest/v1/rpc/<name>) with arbitrary
-- parameters — bypassing RLS because SECURITY DEFINER runs as the
-- function owner.
--
-- Concrete exploits these close:
--   - create_notification(p_user_id, ...)     → spam any user's inbox
--   - track_product_view(p_user_id, ...)      → pollute anyone's view history
--   - clear_recently_viewed(p_user_id)        → wipe anyone's view history
--   - send_chat_message(..., p_sender_id, …)  → inject into any conversation
--   - close_chat_conversation(p_conv_id, …)   → close any conversation
--   - start_chat_conversation(p_user_id, …)   → open chat as any user
--   - log_audit_action(p_user_id, …)          → poison the audit trail
--   - award_seller_xp(p_seller_id, …)         → promote any seller to top rank
--   - grant_invite_rank(p_seller_id, …)       → same, via the admin path
--
-- Callers today: only award_seller_xp is invoked from code, and that
-- code already uses the service-role key (src/lib/seller/rank.ts). The
-- others appear only in auto-generated types — no runtime callers —
-- so locking to service_role breaks nothing.
--
-- Safe to run repeatedly.

-- ─── Notifications (00014) ─────────────────────────────────────────

REVOKE ALL ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT) TO service_role;

-- ─── Recently-viewed (00015) ───────────────────────────────────────

REVOKE ALL ON FUNCTION public.track_product_view(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_product_view(UUID, UUID, TEXT, TEXT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.clear_recently_viewed(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_recently_viewed(UUID) TO service_role;

-- ─── Live chat (00017) ─────────────────────────────────────────────
-- Signatures vary; revoke on the function *name* across all overloads.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('send_chat_message', 'close_chat_conversation', 'start_chat_conversation')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

-- ─── Audit log (00020) ─────────────────────────────────────────────

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'log_audit_action'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

-- ─── Seller rank ladder (00041) ────────────────────────────────────

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('award_seller_xp', 'grant_invite_rank')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

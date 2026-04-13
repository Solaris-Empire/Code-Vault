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
--   - create_notification        → spam any user's inbox
--   - track_product_view         → pollute anyone's view history
--   - clear_recently_viewed      → wipe anyone's view history
--   - send_chat_message          → inject into any conversation
--   - close_chat_conversation    → close any conversation
--   - start_chat_conversation    → open chat as any user
--   - log_audit_action           → poison the audit trail
--   - award_seller_xp            → promote any seller to top rank
--   - grant_invite_rank          → same, via the admin path
--
-- Runtime callers: only award_seller_xp is invoked from code, and that
-- path (src/lib/seller/rank.ts) already uses the service-role key. The
-- others appear only in auto-generated types — no runtime callers —
-- so restricting EXECUTE to service_role breaks nothing.
--
-- Uses a catalog loop to match by function NAME across all overloads
-- and to silently skip any function that doesn't exist in this
-- database. Safe to run repeatedly.

DO $$
DECLARE
  r RECORD;
  target_names TEXT[] := ARRAY[
    'create_notification',
    'track_product_view',
    'clear_recently_viewed',
    'send_chat_message',
    'close_chat_conversation',
    'start_chat_conversation',
    'log_audit_action',
    'award_seller_xp',
    'grant_invite_rank'
  ];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY(target_names)
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
    RAISE NOTICE 'Locked down: %', r.sig;
  END LOOP;
END $$;

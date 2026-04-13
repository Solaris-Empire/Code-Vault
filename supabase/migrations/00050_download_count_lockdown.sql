-- ─── 00050: lock increment_product_download_count ──────────────────
--
-- Drift found by Phase 12 post-apply verification: migration 00046
-- did `GRANT EXECUTE ... TO authenticated, service_role` but didn't
-- `REVOKE ... FROM PUBLIC` first. PostgreSQL keeps the default PUBLIC
-- grant, so anon + authenticated + PUBLIC can all call this RPC via
-- /rest/v1/rpc/increment_product_download_count and spam the counter
-- on any product id — corrupting the trending/popularity signals the
-- ladder and homepage depend on.
--
-- Only caller is src/app/api/downloads/[productId]/route.ts and it
-- already uses the service-role client, so restrict EXECUTE to
-- service_role. Safe to run repeatedly.

REVOKE ALL ON FUNCTION public.increment_product_download_count(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_product_download_count(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.increment_product_download_count(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.increment_product_download_count(UUID) TO service_role;

-- Atomic download counter.
--
-- Before: /api/downloads/[productId] read products.download_count, added 1,
-- and wrote it back. Two concurrent downloads could both read N, both
-- write N+1, losing an increment. The counter is only used for analytics,
-- but this is easy to get right.
--
-- After: a single UPDATE handled by this RPC, so the DB serialises.

CREATE OR REPLACE FUNCTION public.increment_product_download_count(
  p_product_id UUID
) RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.products
     SET download_count = COALESCE(download_count, 0) + 1
   WHERE id = p_product_id;
$$;

GRANT EXECUTE ON FUNCTION public.increment_product_download_count(UUID) TO authenticated, service_role;

-- Fix: Enable RLS on returns and fraud_checks tables
-- Drop existing policies first to avoid conflicts
-- =====================================================================

-- =====================================================================
-- 1. RETURNS TABLE - RLS
-- =====================================================================

ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own returns" ON public.returns;
CREATE POLICY "Users can view own returns" ON public.returns
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create own returns" ON public.returns;
CREATE POLICY "Users can create own returns" ON public.returns
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage all returns" ON public.returns;
CREATE POLICY "Admins can manage all returns" ON public.returns
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Service role full access returns" ON public.returns;
CREATE POLICY "Service role full access returns" ON public.returns
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================================
-- 2. RETURN_ITEMS TABLE - RLS
-- =====================================================================

ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own return items" ON public.return_items;
CREATE POLICY "Users can view own return items" ON public.return_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.returns r
      WHERE r.id = return_items.return_id
        AND r.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create own return items" ON public.return_items;
CREATE POLICY "Users can create own return items" ON public.return_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.returns r
      WHERE r.id = return_items.return_id
        AND r.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can manage all return items" ON public.return_items;
CREATE POLICY "Admins can manage all return items" ON public.return_items
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Service role full access return items" ON public.return_items;
CREATE POLICY "Service role full access return items" ON public.return_items
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================================
-- 3. RETURN_STATUS_HISTORY TABLE - RLS
-- =====================================================================

ALTER TABLE public.return_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own return status history" ON public.return_status_history;
CREATE POLICY "Users can view own return status history" ON public.return_status_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.returns r
      WHERE r.id = return_status_history.return_id
        AND r.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can manage all return status history" ON public.return_status_history;
CREATE POLICY "Admins can manage all return status history" ON public.return_status_history
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Service role full access return status history" ON public.return_status_history;
CREATE POLICY "Service role full access return status history" ON public.return_status_history
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================================
-- 4. FRAUD_CHECKS TABLE - RLS (admin-only table)
-- =====================================================================

ALTER TABLE public.fraud_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage fraud checks" ON public.fraud_checks;
CREATE POLICY "Admins can manage fraud checks" ON public.fraud_checks
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Service role full access fraud checks" ON public.fraud_checks;
CREATE POLICY "Service role full access fraud checks" ON public.fraud_checks
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

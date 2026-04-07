-- Database Audit Fixes
-- Addresses critical issues found during comprehensive database audit
-- =====================================================================

-- =====================================================================
-- 1. UNIQUE CONSTRAINT on profiles.email
-- Prevents duplicate email registrations at the database level
-- =====================================================================

-- Add index first (supports the unique constraint and speeds up email lookups)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_unique
  ON public.profiles (email)
  WHERE email IS NOT NULL;

-- =====================================================================
-- 2. FIX RLS POLICIES: Use is_admin() instead of role = 'admin'
-- Ensures super_admin role works everywhere admin does
-- =====================================================================

-- Fix order_items admin policy
DROP POLICY IF EXISTS "Admins can view all order items" ON public.order_items;
CREATE POLICY "Admins can view all order items" ON public.order_items
  FOR SELECT USING (public.is_admin());

-- Fix orders admin update policy (line 341 in initial schema)
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
CREATE POLICY "Admins can update orders" ON public.orders
  FOR UPDATE USING (public.is_admin());

-- Fix delivery_slots admin policy
DROP POLICY IF EXISTS "Admins can manage delivery slots" ON public.delivery_slots;
CREATE POLICY "Admins can manage delivery slots" ON public.delivery_slots
  FOR ALL USING (public.is_admin());

-- =====================================================================
-- 3. FIX RLS POLICIES on credit_transactions
-- Policies exist (migration 00010) but admin policy uses role = 'admin'
-- instead of is_admin(), blocking super_admin access
-- =====================================================================

-- Fix admin policy to include super_admin
DROP POLICY IF EXISTS "Admins can view all transactions" ON public.credit_transactions;
CREATE POLICY "Admins can view all transactions" ON public.credit_transactions
  FOR SELECT USING (public.is_admin());

-- Add full admin management (insert/update/delete for refunds etc.)
CREATE POLICY "Admins can manage all credit transactions" ON public.credit_transactions
  FOR ALL USING (public.is_admin());

-- Service role full access (for server-side operations)
CREATE POLICY "Service role full access credit transactions" ON public.credit_transactions
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================================
-- 4. MISSING updated_at TRIGGERS
-- Several tables have updated_at columns but no auto-update trigger
-- =====================================================================

DROP TRIGGER IF EXISTS update_vendors_updated_at ON public.vendors;
CREATE TRIGGER update_vendors_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_coupons_updated_at ON public.coupons;
CREATE TRIGGER update_coupons_updated_at
  BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_returns_updated_at ON public.returns;
CREATE TRIGGER update_returns_updated_at
  BEFORE UPDATE ON public.returns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_invoices_updated_at ON public.invoices;
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_gift_cards_updated_at ON public.gift_cards;
CREATE TRIGGER update_gift_cards_updated_at
  BEFORE UPDATE ON public.gift_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_chat_conversations_updated_at ON public.chat_conversations;
CREATE TRIGGER update_chat_conversations_updated_at
  BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_vendor_applications_updated_at ON public.vendor_applications;
CREATE TRIGGER update_vendor_applications_updated_at
  BEFORE UPDATE ON public.vendor_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_newsletter_subscribers_updated_at ON public.newsletter_subscribers;
CREATE TRIGGER update_newsletter_subscribers_updated_at
  BEFORE UPDATE ON public.newsletter_subscribers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_store_settings_updated_at ON public.store_settings;
CREATE TRIGGER update_store_settings_updated_at
  BEFORE UPDATE ON public.store_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =====================================================================
-- 5. MISSING FOREIGN KEYS
-- =====================================================================

-- support_tickets.order_id -> orders.id (nullable FK)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_support_tickets_order'
      AND table_name = 'support_tickets'
  ) THEN
    ALTER TABLE public.support_tickets
      ADD CONSTRAINT fk_support_tickets_order
      FOREIGN KEY (order_id) REFERENCES public.orders(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- invoices.order_id -> orders.id (nullable FK)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_invoices_order'
      AND table_name = 'invoices'
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT fk_invoices_order
      FOREIGN KEY (order_id) REFERENCES public.orders(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- =====================================================================
-- 6. ADDITIONAL PERFORMANCE INDEXES
-- =====================================================================

-- Profiles email for login lookups (covered by unique index above)

-- Orders user_id (may already exist via composite, adding standalone)
CREATE INDEX IF NOT EXISTS idx_orders_user_id
  ON public.orders (user_id);

-- Coupon usage: user + coupon (check per-user limits)
CREATE INDEX IF NOT EXISTS idx_coupon_usage_user_coupon
  ON public.coupon_usage (user_id, coupon_id);

-- Returns: order_id lookup
CREATE INDEX IF NOT EXISTS idx_returns_order_id
  ON public.returns (order_id);

-- Return items: return_id lookup
CREATE INDEX IF NOT EXISTS idx_return_items_return_id
  ON public.return_items (return_id);

-- Return items: product_id lookup (vendor returns filtering)
CREATE INDEX IF NOT EXISTS idx_return_items_product_id
  ON public.return_items (product_id);

-- Chat conversations: user_id for customer chat list
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id
  ON public.chat_conversations (user_id, created_at DESC);

-- Chat conversations: vendor_id for vendor chat list
CREATE INDEX IF NOT EXISTS idx_chat_conversations_vendor_id
  ON public.chat_conversations (vendor_id, created_at DESC)
  WHERE vendor_id IS NOT NULL;

-- Chat messages: conversation lookup (chronological)
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation
  ON public.chat_messages (conversation_id, created_at ASC);

-- =====================================================================
-- 7. REFRESH STATISTICS
-- =====================================================================
ANALYZE public.profiles;
ANALYZE public.orders;
ANALYZE public.order_items;
ANALYZE public.returns;
ANALYZE public.return_items;
ANALYZE public.credit_transactions;
ANALYZE public.chat_conversations;
ANALYZE public.chat_messages;

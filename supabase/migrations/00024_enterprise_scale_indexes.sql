-- Enterprise Scale: Advanced Indexes & Partitioning Prep
-- Targets: 50,000+ products, 1,000+ vendors, 100,000+ users
-- =====================================================================

-- =====================================================================
-- 1. COMPOSITE INDEXES for common query patterns
-- =====================================================================

-- Products: vendor + active (vendor product listings)
CREATE INDEX IF NOT EXISTS idx_products_vendor_active
  ON products (vendor_id, is_active)
  WHERE vendor_id IS NOT NULL;

-- Products: category + active + created (category pages with sorting)
CREATE INDEX IF NOT EXISTS idx_products_category_active_created
  ON products (category_id, is_active, created_at DESC);

-- Products: active + featured (homepage featured products)
CREATE INDEX IF NOT EXISTS idx_products_active_featured
  ON products (is_active, is_featured)
  WHERE is_featured = true;

-- Products: price range queries (common filter)
CREATE INDEX IF NOT EXISTS idx_products_active_price
  ON products (is_active, price)
  WHERE is_active = true;

-- Products: brand filtering (brand pages)
CREATE INDEX IF NOT EXISTS idx_products_brand_active
  ON products (brand, is_active)
  WHERE brand IS NOT NULL;

-- Products: stock tracking (low stock alerts)
CREATE INDEX IF NOT EXISTS idx_products_low_stock
  ON products (stock)
  WHERE is_active = true AND stock < 10;

-- Products: full-text search optimization
CREATE INDEX IF NOT EXISTS idx_products_search_gin
  ON products USING gin (to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(brand, '')));

-- =====================================================================
-- 2. ORDER INDEXES for high-volume order queries
-- =====================================================================

-- Orders: user + status (account order history)
CREATE INDEX IF NOT EXISTS idx_orders_user_status
  ON orders (user_id, status, created_at DESC);

-- Orders: vendor + status + created (vendor order dashboard)
CREATE INDEX IF NOT EXISTS idx_orders_vendor_status_created
  ON orders (vendor_id, status, created_at DESC)
  WHERE vendor_id IS NOT NULL;

-- Orders: status + created (admin order management)
CREATE INDEX IF NOT EXISTS idx_orders_status_created
  ON orders (status, created_at DESC);

-- Orders: date range queries (reporting)
CREATE INDEX IF NOT EXISTS idx_orders_created_at
  ON orders (created_at DESC);

-- Order items: order lookup
CREATE INDEX IF NOT EXISTS idx_order_items_order
  ON order_items (order_id);

-- Order items: product lookup (product sales analytics)
CREATE INDEX IF NOT EXISTS idx_order_items_product
  ON order_items (product_id);

-- =====================================================================
-- 3. VENDOR INDEXES for marketplace scale
-- =====================================================================

-- Vendors: status + created (admin vendor management)
CREATE INDEX IF NOT EXISTS idx_vendors_status
  ON vendors (status, created_at DESC);

-- Vendors: stripe account lookups
CREATE INDEX IF NOT EXISTS idx_vendors_stripe_account
  ON vendors (stripe_account_id)
  WHERE stripe_account_id IS NOT NULL;

-- =====================================================================
-- 4. USER & ENGAGEMENT INDEXES
-- =====================================================================

-- Profiles: role-based queries (admin user management)
CREATE INDEX IF NOT EXISTS idx_profiles_role
  ON profiles (role);

-- Reviews: product + approved (product review listings)
CREATE INDEX IF NOT EXISTS idx_reviews_product_status
  ON reviews (product_id, status, created_at DESC);

-- Reviews: user reviews (account page)
CREATE INDEX IF NOT EXISTS idx_reviews_user
  ON reviews (user_id, created_at DESC);

-- Wishlist items: user lookup
CREATE INDEX IF NOT EXISTS idx_wishlist_items_user
  ON wishlist_items (user_id);

-- Stock alerts: product lookup (back-in-stock notifications)
CREATE INDEX IF NOT EXISTS idx_stock_alerts_product_active
  ON stock_alerts (product_id, notified)
  WHERE notified = false;

-- Notifications: user + read status (notification bell)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, is_read, created_at DESC);

-- =====================================================================
-- 5. SUPPORT & CHAT INDEXES
-- =====================================================================

-- Tickets: user + status (account tickets)
CREATE INDEX IF NOT EXISTS idx_tickets_user_status
  ON tickets (user_id, status, created_at DESC);

-- Tickets: assigned agent (agent dashboard)
CREATE INDEX IF NOT EXISTS idx_tickets_assigned
  ON tickets (assigned_to, status)
  WHERE assigned_to IS NOT NULL;

-- Live chat: active conversations
CREATE INDEX IF NOT EXISTS idx_live_chat_status
  ON live_chat_conversations (status, created_at DESC);

-- =====================================================================
-- 6. MARKETING & DEALS INDEXES
-- =====================================================================

-- Deals: active deals by date range
CREATE INDEX IF NOT EXISTS idx_deals_active_dates
  ON deals (is_active, start_date, end_date)
  WHERE is_active = true;

-- Coupons: code lookup (checkout validation)
CREATE INDEX IF NOT EXISTS idx_coupons_code
  ON coupons (code)
  WHERE is_active = true;

-- Newsletter: email lookup (dedup)
CREATE INDEX IF NOT EXISTS idx_newsletter_email
  ON newsletter_subscribers (email);

-- =====================================================================
-- 7. AUDIT & LOGGING INDEXES
-- =====================================================================

-- Audit logs: entity lookup (entity history)
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON audit_logs (entity_type, entity_id, created_at DESC);

-- Audit logs: user actions (user activity)
CREATE INDEX IF NOT EXISTS idx_audit_logs_user
  ON audit_logs (user_id, created_at DESC);

-- Audit logs: date-based cleanup
CREATE INDEX IF NOT EXISTS idx_audit_logs_created
  ON audit_logs (created_at DESC);

-- =====================================================================
-- 8. DELIVERY INDEXES
-- =====================================================================

-- Delivery slots: date + availability
CREATE INDEX IF NOT EXISTS idx_delivery_slots_date_available
  ON delivery_slots (date, is_available)
  WHERE is_available = true;

-- =====================================================================
-- 9. STATISTICS REFRESH
-- =====================================================================

-- Update planner statistics for all critical tables
ANALYZE products;
ANALYZE orders;
ANALYZE order_items;
ANALYZE profiles;
ANALYZE vendors;
ANALYZE reviews;
ANALYZE categories;
ANALYZE notifications;
ANALYZE audit_logs;

-- =====================================================================
-- 10. DATABASE CONFIGURATION for scale
-- =====================================================================

-- Increase work_mem for complex queries (sorting large product lists)
-- ALTER DATABASE postgres SET work_mem = '256MB'; -- Uncomment for self-hosted
-- ALTER DATABASE postgres SET maintenance_work_mem = '512MB'; -- Uncomment for self-hosted
-- ALTER DATABASE postgres SET effective_cache_size = '4GB'; -- Uncomment for self-hosted

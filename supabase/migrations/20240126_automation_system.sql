-- Automation System Migration
-- Advanced automation tables for UK Grocery Store

-- ============================================
-- 1. PRICE HISTORY TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price_pence INTEGER NOT NULL,
  compare_at_price_pence INTEGER,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_history_product ON price_history(product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_recorded ON price_history(recorded_at DESC);

-- ============================================
-- 2. PRICE ALERTS
-- ============================================

CREATE TABLE IF NOT EXISTS price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  target_price_pence INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_price_alerts_user ON price_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_product ON price_alerts(product_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_active ON price_alerts(is_active) WHERE is_active = TRUE;

-- ============================================
-- 3. LOYALTY POINTS SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS loyalty_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_points INTEGER NOT NULL DEFAULT 0,
  lifetime_points INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_points_user ON loyalty_points(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_points_tier ON loyalty_points(tier);

CREATE TABLE IF NOT EXISTS points_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('earn', 'redeem', 'expire', 'adjust')),
  action TEXT NOT NULL,
  points INTEGER NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  reference TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_points_transactions_user ON points_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_points_transactions_order ON points_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_points_transactions_created ON points_transactions(created_at DESC);

-- ============================================
-- 4. FRAUD DETECTION
-- ============================================

CREATE TABLE IF NOT EXISTS fraud_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  signals JSONB NOT NULL DEFAULT '[]',
  should_block BOOLEAN DEFAULT FALSE,
  should_review BOOLEAN DEFAULT FALSE,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  review_decision TEXT CHECK (review_decision IN ('approved', 'rejected', 'pending')),
  review_notes TEXT,
  ip_address INET,
  user_agent TEXT,
  device_fingerprint TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fraud_checks_order ON fraud_checks(order_id);
CREATE INDEX IF NOT EXISTS idx_fraud_checks_user ON fraud_checks(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_checks_risk ON fraud_checks(risk_level);
CREATE INDEX IF NOT EXISTS idx_fraud_checks_review ON fraud_checks(should_review) WHERE should_review = TRUE;

CREATE TABLE IF NOT EXISTS payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  amount_pence INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'successful', 'failed', 'refunded')),
  payment_method TEXT,
  failure_reason TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_user ON payment_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_status ON payment_attempts(status);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_created ON payment_attempts(created_at DESC);

-- ============================================
-- 5. VENDOR METRICS
-- ============================================

CREATE TABLE IF NOT EXISTS vendor_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,

  -- Order metrics
  total_orders INTEGER DEFAULT 0,
  orders_last_30_days INTEGER DEFAULT 0,
  total_revenue_pence BIGINT DEFAULT 0,
  revenue_last_30_days_pence BIGINT DEFAULT 0,

  -- Fulfillment metrics
  on_time_delivery_rate DECIMAL(5,2) DEFAULT 100.00,
  order_accuracy_rate DECIMAL(5,2) DEFAULT 100.00,
  average_processing_time_hours DECIMAL(8,2) DEFAULT 0,

  -- Customer satisfaction
  average_rating DECIMAL(3,2) DEFAULT 5.00,
  total_reviews INTEGER DEFAULT 0,
  positive_review_rate DECIMAL(5,2) DEFAULT 100.00,

  -- Return/refund metrics
  return_rate DECIMAL(5,2) DEFAULT 0.00,
  refund_rate DECIMAL(5,2) DEFAULT 0.00,

  -- Product metrics
  active_products INTEGER DEFAULT 0,
  out_of_stock_products INTEGER DEFAULT 0,
  stock_availability_rate DECIMAL(5,2) DEFAULT 100.00,

  -- Response metrics
  average_response_time_hours DECIMAL(8,2) DEFAULT 0,
  question_answer_rate DECIMAL(5,2) DEFAULT 100.00,

  -- Overall performance
  performance_score INTEGER DEFAULT 100 CHECK (performance_score >= 0 AND performance_score <= 100),
  performance_grade CHAR(1) DEFAULT 'A' CHECK (performance_grade IN ('A', 'B', 'C', 'D', 'F')),
  trend TEXT DEFAULT 'stable' CHECK (trend IN ('up', 'down', 'stable')),

  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_metrics_vendor ON vendor_metrics(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_metrics_calculated ON vendor_metrics(calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_metrics_score ON vendor_metrics(performance_score DESC);

-- Add performance columns to vendors table if not exists
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS performance_score INTEGER DEFAULT 100;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS performance_grade CHAR(1) DEFAULT 'A';

-- ============================================
-- 6. PRODUCT DISCOUNTS (for expiry system)
-- ============================================

CREATE TABLE IF NOT EXISTS product_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('expiry', 'clearance', 'promotion', 'bulk')),
  discount_percent INTEGER NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  discounted_price_pence INTEGER NOT NULL,
  reason TEXT,
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_discounts_product ON product_discounts(product_id);
CREATE INDEX IF NOT EXISTS idx_product_discounts_active ON product_discounts(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_product_discounts_expires ON product_discounts(expires_at);

-- Add expiry date column to products if not exists
ALTER TABLE products ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 10;
ALTER TABLE products ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_products_expiry ON products(expiry_date) WHERE expiry_date IS NOT NULL;

-- ============================================
-- 7. NOTIFICATION PREFERENCES
-- ============================================

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Email preferences
  order_updates BOOLEAN DEFAULT TRUE,
  promotions BOOLEAN DEFAULT TRUE,
  price_alerts BOOLEAN DEFAULT TRUE,
  stock_alerts BOOLEAN DEFAULT TRUE,
  reorder_reminders BOOLEAN DEFAULT TRUE,
  review_requests BOOLEAN DEFAULT TRUE,

  -- Push preferences
  push_enabled BOOLEAN DEFAULT FALSE,
  push_order_updates BOOLEAN DEFAULT TRUE,
  push_promotions BOOLEAN DEFAULT FALSE,

  -- SMS preferences
  sms_enabled BOOLEAN DEFAULT FALSE,
  sms_order_updates BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON notification_preferences(user_id);

-- ============================================
-- 8. WISHLISTS (for price drop alerts)
-- ============================================

CREATE TABLE IF NOT EXISTS wishlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  notify_price_drop BOOLEAN DEFAULT TRUE,
  notify_back_in_stock BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlists_user ON wishlists(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_product ON wishlists(product_id);

-- ============================================
-- 9. RLS POLICIES
-- ============================================

ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;

-- Price history - anyone can view
CREATE POLICY "Anyone can view price history" ON price_history
  FOR SELECT USING (true);

-- Price alerts - users can manage their own
CREATE POLICY "Users can manage own price alerts" ON price_alerts
  FOR ALL USING (auth.uid() = user_id);

-- Loyalty points - users can view their own
CREATE POLICY "Users can view own loyalty points" ON loyalty_points
  FOR SELECT USING (auth.uid() = user_id);

-- Points transactions - users can view their own
CREATE POLICY "Users can view own points transactions" ON points_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Notification preferences - users can manage their own
CREATE POLICY "Users can manage own notification preferences" ON notification_preferences
  FOR ALL USING (auth.uid() = user_id);

-- Wishlists - users can manage their own
CREATE POLICY "Users can manage own wishlists" ON wishlists
  FOR ALL USING (auth.uid() = user_id);

-- Product discounts - anyone can view active discounts
CREATE POLICY "Anyone can view active discounts" ON product_discounts
  FOR SELECT USING (is_active = TRUE);

-- ============================================
-- 10. TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_automation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_loyalty_points_timestamp
  BEFORE UPDATE ON loyalty_points
  FOR EACH ROW EXECUTE FUNCTION update_automation_timestamp();

CREATE TRIGGER update_notification_prefs_timestamp
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_automation_timestamp();

CREATE TRIGGER update_product_discounts_timestamp
  BEFORE UPDATE ON product_discounts
  FOR EACH ROW EXECUTE FUNCTION update_automation_timestamp();

-- Initialize loyalty points for new users
CREATE OR REPLACE FUNCTION initialize_user_loyalty()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO loyalty_points (user_id, current_points, lifetime_points)
  VALUES (NEW.id, 100, 100) -- Welcome bonus of 100 points
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER initialize_new_user_loyalty
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION initialize_user_loyalty();

-- Track price changes automatically
CREATE OR REPLACE FUNCTION track_product_price_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.price_pence IS DISTINCT FROM NEW.price_pence THEN
    INSERT INTO price_history (product_id, price_pence, compare_at_price_pence)
    VALUES (NEW.id, NEW.price_pence, NEW.compare_at_price_pence);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_price_changes
  AFTER UPDATE ON products
  FOR EACH ROW
  WHEN (OLD.price_pence IS DISTINCT FROM NEW.price_pence)
  EXECUTE FUNCTION track_product_price_change();

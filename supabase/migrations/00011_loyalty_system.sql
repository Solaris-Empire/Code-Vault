-- =====================================================
-- LOYALTY POINTS SYSTEM MIGRATION
-- =====================================================

-- Loyalty tiers table
CREATE TABLE IF NOT EXISTS loyalty_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  min_points INT NOT NULL DEFAULT 0,
  points_multiplier DECIMAL(3,2) NOT NULL DEFAULT 1.00,
  benefits JSONB DEFAULT '[]',
  icon TEXT,
  color TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User loyalty accounts
CREATE TABLE IF NOT EXISTS loyalty_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  tier_id UUID REFERENCES loyalty_tiers(id),
  current_points INT NOT NULL DEFAULT 0,
  lifetime_points INT NOT NULL DEFAULT 0,
  points_expiring_soon INT DEFAULT 0,
  next_expiry_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Points transactions
CREATE TABLE IF NOT EXISTS points_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  points INT NOT NULL, -- Positive for earn, negative for redeem/expire
  balance_after INT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('earn_purchase', 'earn_review', 'earn_referral', 'earn_bonus', 'redeem', 'expire', 'adjustment')),
  reference_type TEXT, -- 'order', 'review', 'referral', 'promotion', 'admin'
  reference_id UUID,
  description TEXT,
  multiplier_applied DECIMAL(3,2) DEFAULT 1.00,
  expires_at DATE, -- For earned points
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Points redemption rules
CREATE TABLE IF NOT EXISTS points_redemption_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  points_required INT NOT NULL,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('discount_fixed', 'discount_percentage', 'free_shipping', 'free_product')),
  reward_value INT NOT NULL, -- Pence for fixed, percentage for %, product_id for free product
  min_order_pence INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Points earning rules
CREATE TABLE IF NOT EXISTS points_earning_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'review', 'referral', 'birthday', 'signup', 'custom')),
  points_per_pound INT DEFAULT 1, -- For purchase type
  fixed_points INT DEFAULT 0, -- For other types
  min_order_pence INT DEFAULT 0,
  max_points_per_order INT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_user ON loyalty_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_tier ON loyalty_accounts(tier_id);
CREATE INDEX IF NOT EXISTS idx_points_transactions_user ON points_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_points_transactions_type ON points_transactions(type);
CREATE INDEX IF NOT EXISTS idx_points_transactions_expires ON points_transactions(expires_at);

-- RLS Policies
ALTER TABLE loyalty_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_redemption_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_earning_rules ENABLE ROW LEVEL SECURITY;

-- Public can view tiers and rules
CREATE POLICY "Anyone can view loyalty tiers"
  ON loyalty_tiers FOR SELECT
  USING (is_active = true);

CREATE POLICY "Anyone can view redemption rules"
  ON points_redemption_rules FOR SELECT
  USING (is_active = true);

CREATE POLICY "Anyone can view earning rules"
  ON points_earning_rules FOR SELECT
  USING (is_active = true);

-- Users can view their own loyalty data
CREATE POLICY "Users can view their loyalty account"
  ON loyalty_accounts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can view their points transactions"
  ON points_transactions FOR SELECT
  USING (user_id = auth.uid());

-- Admins can manage everything
CREATE POLICY "Admins can manage loyalty tiers"
  ON loyalty_tiers FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage loyalty accounts"
  ON loyalty_accounts FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage points transactions"
  ON points_transactions FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage redemption rules"
  ON points_redemption_rules FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage earning rules"
  ON points_earning_rules FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- System can insert transactions
CREATE POLICY "System can insert points transactions"
  ON points_transactions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can manage loyalty accounts"
  ON loyalty_accounts FOR ALL
  USING (true)
  WITH CHECK (true);

-- Insert default loyalty tiers
INSERT INTO loyalty_tiers (name, slug, min_points, points_multiplier, benefits, icon, color, sort_order) VALUES
  ('Bronze', 'bronze', 0, 1.00, '["1 point per £1 spent", "Birthday bonus points", "Early access to sales"]', 'medal', '#CD7F32', 1),
  ('Silver', 'silver', 1000, 1.25, '["1.25x points on all purchases", "Free standard delivery", "Exclusive member discounts", "Priority customer support"]', 'medal', '#C0C0C0', 2),
  ('Gold', 'gold', 5000, 1.50, '["1.5x points on all purchases", "Free express delivery", "Double points on birthdays", "VIP customer support", "Early access to new products"]', 'crown', '#FFD700', 3),
  ('Platinum', 'platinum', 15000, 2.00, '["2x points on all purchases", "Free same-day delivery", "Exclusive platinum offers", "Personal shopping assistant", "Invitation to VIP events"]', 'gem', '#E5E4E2', 4)
ON CONFLICT (slug) DO NOTHING;

-- Insert default earning rules
INSERT INTO points_earning_rules (name, type, points_per_pound, fixed_points, min_order_pence, is_active) VALUES
  ('Purchase Points', 'purchase', 1, 0, 500, true),
  ('Review Bonus', 'review', 0, 50, 0, true),
  ('Photo Review Bonus', 'review', 0, 100, 0, true),
  ('Referral Bonus', 'referral', 0, 200, 0, true),
  ('Birthday Bonus', 'birthday', 0, 500, 0, true),
  ('Signup Bonus', 'signup', 0, 100, 0, true)
ON CONFLICT DO NOTHING;

-- Insert default redemption rules
INSERT INTO points_redemption_rules (name, points_required, reward_type, reward_value, min_order_pence, sort_order) VALUES
  ('£5 Off', 500, 'discount_fixed', 500, 2000, 1),
  ('£10 Off', 1000, 'discount_fixed', 1000, 3000, 2),
  ('£25 Off', 2500, 'discount_fixed', 2500, 5000, 3),
  ('Free Standard Delivery', 300, 'free_shipping', 399, 1500, 4),
  ('10% Off Order', 800, 'discount_percentage', 10, 2000, 5),
  ('15% Off Order', 1500, 'discount_percentage', 15, 4000, 6)
ON CONFLICT DO NOTHING;

-- Function to get or create loyalty account
CREATE OR REPLACE FUNCTION get_or_create_loyalty_account(p_user_id UUID)
RETURNS loyalty_accounts
LANGUAGE plpgsql
AS $$
DECLARE
  v_account loyalty_accounts;
  v_bronze_tier_id UUID;
BEGIN
  -- Try to get existing account
  SELECT * INTO v_account FROM loyalty_accounts WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    -- Get bronze tier ID
    SELECT id INTO v_bronze_tier_id FROM loyalty_tiers WHERE slug = 'bronze';

    -- Create new account
    INSERT INTO loyalty_accounts (user_id, tier_id, current_points, lifetime_points)
    VALUES (p_user_id, v_bronze_tier_id, 0, 0)
    RETURNING * INTO v_account;
  END IF;

  RETURN v_account;
END;
$$;

-- Function to add points
CREATE OR REPLACE FUNCTION add_loyalty_points(
  p_user_id UUID,
  p_points INT,
  p_type TEXT,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_expires_in_days INT DEFAULT 365
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_account loyalty_accounts;
  v_new_balance INT;
  v_multiplier DECIMAL(3,2);
  v_tier loyalty_tiers;
  v_adjusted_points INT;
BEGIN
  -- Get or create account
  v_account := get_or_create_loyalty_account(p_user_id);

  -- Get tier multiplier
  SELECT * INTO v_tier FROM loyalty_tiers WHERE id = v_account.tier_id;
  v_multiplier := COALESCE(v_tier.points_multiplier, 1.00);

  -- Apply multiplier for earned points
  IF p_points > 0 AND p_type LIKE 'earn_%' THEN
    v_adjusted_points := FLOOR(p_points * v_multiplier);
  ELSE
    v_adjusted_points := p_points;
  END IF;

  -- Update account balance
  UPDATE loyalty_accounts
  SET
    current_points = current_points + v_adjusted_points,
    lifetime_points = CASE WHEN v_adjusted_points > 0 THEN lifetime_points + v_adjusted_points ELSE lifetime_points END,
    updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING current_points INTO v_new_balance;

  -- Record transaction
  INSERT INTO points_transactions (
    user_id, points, balance_after, type, reference_type, reference_id, description, multiplier_applied, expires_at
  ) VALUES (
    p_user_id,
    v_adjusted_points,
    v_new_balance,
    p_type,
    p_reference_type,
    p_reference_id,
    p_description,
    v_multiplier,
    CASE WHEN v_adjusted_points > 0 THEN CURRENT_DATE + p_expires_in_days ELSE NULL END
  );

  -- Check for tier upgrade
  PERFORM update_loyalty_tier(p_user_id);

  RETURN v_new_balance;
END;
$$;

-- Function to update loyalty tier based on lifetime points
CREATE OR REPLACE FUNCTION update_loyalty_tier(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_account loyalty_accounts;
  v_new_tier_id UUID;
BEGIN
  SELECT * INTO v_account FROM loyalty_accounts WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Find the highest tier the user qualifies for
  SELECT id INTO v_new_tier_id
  FROM loyalty_tiers
  WHERE min_points <= v_account.lifetime_points AND is_active = true
  ORDER BY min_points DESC
  LIMIT 1;

  -- Update tier if changed
  IF v_new_tier_id IS DISTINCT FROM v_account.tier_id THEN
    UPDATE loyalty_accounts
    SET tier_id = v_new_tier_id, updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;
END;
$$;

-- Function to redeem points
CREATE OR REPLACE FUNCTION redeem_loyalty_points(
  p_user_id UUID,
  p_rule_id UUID,
  p_order_id UUID DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  reward_type TEXT,
  reward_value INT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_account loyalty_accounts;
  v_rule points_redemption_rules;
BEGIN
  -- Get account
  SELECT * INTO v_account FROM loyalty_accounts WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Loyalty account not found'::TEXT, NULL::TEXT, 0;
    RETURN;
  END IF;

  -- Get redemption rule
  SELECT * INTO v_rule FROM points_redemption_rules WHERE id = p_rule_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Invalid redemption option'::TEXT, NULL::TEXT, 0;
    RETURN;
  END IF;

  -- Check points balance
  IF v_account.current_points < v_rule.points_required THEN
    RETURN QUERY SELECT false, 'Not enough points'::TEXT, NULL::TEXT, 0;
    RETURN;
  END IF;

  -- Deduct points
  PERFORM add_loyalty_points(
    p_user_id,
    -v_rule.points_required,
    'redeem',
    'order',
    p_order_id,
    'Redeemed: ' || v_rule.name
  );

  RETURN QUERY SELECT true, 'Points redeemed successfully'::TEXT, v_rule.reward_type, v_rule.reward_value::INT;
END;
$$;

-- Trigger to award points on order payment
CREATE OR REPLACE FUNCTION award_purchase_points()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_points_per_pound INT;
  v_points_to_award INT;
BEGIN
  -- Only award for paid orders
  IF NEW.payment_status != 'paid' THEN
    RETURN NEW;
  END IF;

  -- Skip if already awarded (check for existing transaction)
  IF EXISTS (
    SELECT 1 FROM points_transactions
    WHERE reference_type = 'order' AND reference_id = NEW.id AND type = 'earn_purchase'
  ) THEN
    RETURN NEW;
  END IF;

  -- Get points per pound from rules
  SELECT points_per_pound INTO v_points_per_pound
  FROM points_earning_rules
  WHERE type = 'purchase' AND is_active = true
  LIMIT 1;

  IF v_points_per_pound IS NULL THEN
    v_points_per_pound := 1;
  END IF;

  -- Calculate points (1 point per £1 = 100 pence)
  v_points_to_award := FLOOR(NEW.total_pence / 100) * v_points_per_pound;

  IF v_points_to_award > 0 AND NEW.user_id IS NOT NULL THEN
    PERFORM add_loyalty_points(
      NEW.user_id,
      v_points_to_award,
      'earn_purchase',
      'order',
      NEW.id,
      'Points earned from order #' || NEW.order_number
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_award_purchase_points ON orders;
CREATE TRIGGER trigger_award_purchase_points
  AFTER INSERT OR UPDATE OF payment_status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION award_purchase_points();

-- Add points columns to orders if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'points_earned') THEN
    ALTER TABLE orders ADD COLUMN points_earned INT DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'points_redeemed') THEN
    ALTER TABLE orders ADD COLUMN points_redeemed INT DEFAULT 0;
  END IF;
END $$;

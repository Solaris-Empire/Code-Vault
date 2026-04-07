-- =====================================================
-- COUPONS SYSTEM MIGRATION
-- =====================================================

-- Coupons table
CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount', 'free_shipping')),
  discount_value DECIMAL(10,2) NOT NULL,
  min_order_pence INT DEFAULT 0,
  max_discount_pence INT,
  usage_limit INT,
  usage_count INT DEFAULT 0,
  per_user_limit INT DEFAULT 1,
  applies_to TEXT DEFAULT 'all' CHECK (applies_to IN ('all', 'products', 'categories', 'vendors')),
  applicable_ids UUID[],
  exclude_sale_items BOOLEAN DEFAULT FALSE,
  first_order_only BOOLEAN DEFAULT FALSE,
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Coupon usage tracking
CREATE TABLE IF NOT EXISTS coupon_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID REFERENCES coupons(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  discount_pence INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(is_active, starts_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_user ON coupon_usage(user_id, coupon_id);

-- Add coupon fields to orders if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'coupon_id') THEN
    ALTER TABLE orders ADD COLUMN coupon_id UUID REFERENCES coupons(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'coupon_code') THEN
    ALTER TABLE orders ADD COLUMN coupon_code TEXT;
  END IF;
END $$;

-- RLS Policies
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_usage ENABLE ROW LEVEL SECURITY;

-- Coupons - public can view active coupons, admin can manage
CREATE POLICY "Anyone can view active coupons"
  ON coupons FOR SELECT
  USING (is_active = true AND (starts_at IS NULL OR starts_at <= NOW()) AND (expires_at IS NULL OR expires_at > NOW()));

CREATE POLICY "Admins can manage coupons"
  ON coupons FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Vendors can manage their coupons"
  ON coupons FOR ALL
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  );

-- Coupon usage - users can see their own usage
CREATE POLICY "Users can view their coupon usage"
  ON coupon_usage FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "System can insert coupon usage"
  ON coupon_usage FOR INSERT
  WITH CHECK (true);

-- Function to validate coupon
CREATE OR REPLACE FUNCTION validate_coupon(
  p_code TEXT,
  p_user_id UUID,
  p_subtotal_pence INT
)
RETURNS TABLE (
  valid BOOLEAN,
  coupon_id UUID,
  discount_type TEXT,
  discount_value DECIMAL,
  discount_pence INT,
  error_message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_coupon RECORD;
  v_user_usage_count INT;
  v_calculated_discount INT;
BEGIN
  -- Get the coupon
  SELECT * INTO v_coupon
  FROM coupons
  WHERE code = UPPER(p_code)
  AND is_active = true
  AND (starts_at IS NULL OR starts_at <= NOW())
  AND (expires_at IS NULL OR expires_at > NOW());

  -- Check if coupon exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::DECIMAL, 0, 'Invalid or expired coupon code'::TEXT;
    RETURN;
  END IF;

  -- Check usage limit
  IF v_coupon.usage_limit IS NOT NULL AND v_coupon.usage_count >= v_coupon.usage_limit THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::DECIMAL, 0, 'Coupon usage limit reached'::TEXT;
    RETURN;
  END IF;

  -- Check per-user limit
  IF p_user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_user_usage_count
    FROM coupon_usage
    WHERE coupon_id = v_coupon.id AND user_id = p_user_id;

    IF v_user_usage_count >= v_coupon.per_user_limit THEN
      RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::DECIMAL, 0, 'You have already used this coupon'::TEXT;
      RETURN;
    END IF;

    -- Check first order only
    IF v_coupon.first_order_only THEN
      IF EXISTS (SELECT 1 FROM orders WHERE user_id = p_user_id AND payment_status = 'paid') THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::DECIMAL, 0, 'This coupon is for first orders only'::TEXT;
        RETURN;
      END IF;
    END IF;
  END IF;

  -- Check minimum order
  IF p_subtotal_pence < v_coupon.min_order_pence THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::DECIMAL, 0,
      FORMAT('Minimum order of %s required', (v_coupon.min_order_pence / 100.0)::TEXT)::TEXT;
    RETURN;
  END IF;

  -- Calculate discount
  IF v_coupon.discount_type = 'percentage' THEN
    v_calculated_discount := FLOOR(p_subtotal_pence * (v_coupon.discount_value / 100));
  ELSIF v_coupon.discount_type = 'fixed_amount' THEN
    v_calculated_discount := FLOOR(v_coupon.discount_value * 100);
  ELSE -- free_shipping
    v_calculated_discount := 0; -- Handled separately in checkout
  END IF;

  -- Apply max discount cap
  IF v_coupon.max_discount_pence IS NOT NULL AND v_calculated_discount > v_coupon.max_discount_pence THEN
    v_calculated_discount := v_coupon.max_discount_pence;
  END IF;

  -- Don't exceed subtotal
  IF v_calculated_discount > p_subtotal_pence THEN
    v_calculated_discount := p_subtotal_pence;
  END IF;

  RETURN QUERY SELECT
    true,
    v_coupon.id,
    v_coupon.discount_type,
    v_coupon.discount_value,
    v_calculated_discount,
    NULL::TEXT;
END;
$$;

-- Function to apply coupon (increment usage)
CREATE OR REPLACE FUNCTION apply_coupon(
  p_coupon_id UUID,
  p_user_id UUID,
  p_order_id UUID,
  p_discount_pence INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  -- Increment coupon usage count
  UPDATE coupons
  SET usage_count = usage_count + 1,
      updated_at = NOW()
  WHERE id = p_coupon_id;

  -- Record usage
  INSERT INTO coupon_usage (coupon_id, user_id, order_id, discount_pence)
  VALUES (p_coupon_id, p_user_id, p_order_id, p_discount_pence);

  RETURN true;
END;
$$;

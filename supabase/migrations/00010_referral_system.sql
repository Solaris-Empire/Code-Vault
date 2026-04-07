-- =====================================================
-- REFERRAL SYSTEM MIGRATION
-- =====================================================

-- Referral codes table
CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  reward_type TEXT NOT NULL DEFAULT 'credit' CHECK (reward_type IN ('credit', 'discount', 'points')),
  referrer_reward_pence INT NOT NULL DEFAULT 500, -- £5 default
  referee_reward_pence INT NOT NULL DEFAULT 500,  -- £5 default for new user
  max_referrals INT, -- NULL means unlimited
  total_referrals INT DEFAULT 0,
  total_earned_pence INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Referrals tracking table
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id UUID NOT NULL REFERENCES referral_codes(id) ON DELETE CASCADE,
  referrer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'qualified', 'rewarded', 'expired', 'cancelled')),
  qualifying_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  referrer_reward_pence INT NOT NULL,
  referee_reward_pence INT NOT NULL,
  referrer_credited_at TIMESTAMPTZ,
  referee_credited_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(referee_id) -- Each user can only be referred once
);

-- User credits/wallet table
CREATE TABLE IF NOT EXISTS user_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  balance_pence INT NOT NULL DEFAULT 0,
  lifetime_earned_pence INT NOT NULL DEFAULT 0,
  lifetime_spent_pence INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Credit transactions table
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount_pence INT NOT NULL, -- Positive for credit, negative for debit
  balance_after_pence INT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('referral_bonus', 'referee_bonus', 'order_credit', 'order_refund', 'admin_adjustment', 'expiry', 'loyalty_points')),
  reference_type TEXT, -- 'referral', 'order', 'admin', etc.
  reference_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_referral_codes_user ON referral_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referee ON referrals(referee_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON credit_transactions(user_id);

-- Add referred_by to profiles if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'referred_by_code') THEN
    ALTER TABLE profiles ADD COLUMN referred_by_code TEXT;
  END IF;
END $$;

-- Add credits used to orders if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'credits_used_pence') THEN
    ALTER TABLE orders ADD COLUMN credits_used_pence INT DEFAULT 0;
  END IF;
END $$;

-- RLS Policies
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- Referral codes policies
CREATE POLICY "Users can view their own referral codes"
  ON referral_codes FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own referral code"
  ON referral_codes FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage all referral codes"
  ON referral_codes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Referrals policies
CREATE POLICY "Users can view referrals they're involved in"
  ON referrals FOR SELECT
  USING (referrer_id = auth.uid() OR referee_id = auth.uid());

CREATE POLICY "Admins can manage all referrals"
  ON referrals FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- User credits policies
CREATE POLICY "Users can view their own credits"
  ON user_credits FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "System can manage credits"
  ON user_credits FOR ALL
  USING (true)
  WITH CHECK (true);

-- Credit transactions policies
CREATE POLICY "Users can view their own transactions"
  ON credit_transactions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all transactions"
  ON credit_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Function to generate unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
  v_user_name TEXT;
BEGIN
  -- Get user's first name or use random
  SELECT UPPER(SUBSTRING(COALESCE(full_name, 'USER') FROM 1 FOR 4))
  INTO v_user_name
  FROM profiles WHERE id = p_user_id;

  -- Generate unique code
  LOOP
    v_code := v_user_name || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));

    SELECT EXISTS(SELECT 1 FROM referral_codes WHERE code = v_code) INTO v_exists;

    IF NOT v_exists THEN
      EXIT;
    END IF;
  END LOOP;

  RETURN v_code;
END;
$$;

-- Function to create or get user's referral code
CREATE OR REPLACE FUNCTION get_or_create_referral_code(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  code TEXT,
  referrer_reward_pence INT,
  referee_reward_pence INT,
  total_referrals INT,
  total_earned_pence INT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing RECORD;
  v_new_code TEXT;
  v_new_id UUID;
BEGIN
  -- Check for existing active code
  SELECT rc.* INTO v_existing
  FROM referral_codes rc
  WHERE rc.user_id = p_user_id AND rc.is_active = true
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT v_existing.id, v_existing.code, v_existing.referrer_reward_pence,
      v_existing.referee_reward_pence, v_existing.total_referrals, v_existing.total_earned_pence;
  ELSE
    -- Create new code
    v_new_code := generate_referral_code(p_user_id);

    INSERT INTO referral_codes (user_id, code)
    VALUES (p_user_id, v_new_code)
    RETURNING referral_codes.id INTO v_new_id;

    RETURN QUERY SELECT v_new_id, v_new_code, 500, 500, 0, 0;
  END IF;
END;
$$;

-- Function to apply referral code for new user
CREATE OR REPLACE FUNCTION apply_referral_code(
  p_referee_id UUID,
  p_code TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  referrer_name TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_referral_code RECORD;
  v_referrer RECORD;
BEGIN
  -- Find the referral code
  SELECT rc.*, p.full_name as referrer_name
  INTO v_referral_code
  FROM referral_codes rc
  JOIN profiles p ON p.id = rc.user_id
  WHERE rc.code = UPPER(p_code) AND rc.is_active = true;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Invalid referral code'::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  -- Check if referring self
  IF v_referral_code.user_id = p_referee_id THEN
    RETURN QUERY SELECT false, 'You cannot use your own referral code'::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  -- Check if already referred
  IF EXISTS (SELECT 1 FROM referrals WHERE referee_id = p_referee_id) THEN
    RETURN QUERY SELECT false, 'You have already used a referral code'::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  -- Check if max referrals reached
  IF v_referral_code.max_referrals IS NOT NULL AND v_referral_code.total_referrals >= v_referral_code.max_referrals THEN
    RETURN QUERY SELECT false, 'This referral code has reached its limit'::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  -- Create the referral (pending until first order)
  INSERT INTO referrals (
    referral_code_id,
    referrer_id,
    referee_id,
    referrer_reward_pence,
    referee_reward_pence
  ) VALUES (
    v_referral_code.id,
    v_referral_code.user_id,
    p_referee_id,
    v_referral_code.referrer_reward_pence,
    v_referral_code.referee_reward_pence
  );

  -- Update profile with referral code
  UPDATE profiles SET referred_by_code = UPPER(p_code) WHERE id = p_referee_id;

  -- Immediately credit referee with their bonus
  PERFORM add_user_credit(
    p_referee_id,
    v_referral_code.referee_reward_pence,
    'referee_bonus',
    'referral',
    v_referral_code.id,
    'Welcome bonus from referral by ' || v_referral_code.referrer_name
  );

  -- Update referral as referee credited
  UPDATE referrals
  SET referee_credited_at = NOW(), updated_at = NOW()
  WHERE referee_id = p_referee_id AND referral_code_id = v_referral_code.id;

  RETURN QUERY SELECT true, 'Referral code applied! You received £' || (v_referral_code.referee_reward_pence / 100.0)::TEXT || ' credit!'::TEXT, v_referral_code.referrer_name;
END;
$$;

-- Function to add credit to user
CREATE OR REPLACE FUNCTION add_user_credit(
  p_user_id UUID,
  p_amount_pence INT,
  p_type TEXT,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_balance INT;
BEGIN
  -- Ensure user has a credit record
  INSERT INTO user_credits (user_id, balance_pence, lifetime_earned_pence)
  VALUES (p_user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Update balance
  UPDATE user_credits
  SET
    balance_pence = balance_pence + p_amount_pence,
    lifetime_earned_pence = CASE WHEN p_amount_pence > 0 THEN lifetime_earned_pence + p_amount_pence ELSE lifetime_earned_pence END,
    lifetime_spent_pence = CASE WHEN p_amount_pence < 0 THEN lifetime_spent_pence + ABS(p_amount_pence) ELSE lifetime_spent_pence END,
    updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING balance_pence INTO v_new_balance;

  -- Record transaction
  INSERT INTO credit_transactions (user_id, amount_pence, balance_after_pence, type, reference_type, reference_id, description)
  VALUES (p_user_id, p_amount_pence, v_new_balance, p_type, p_reference_type, p_reference_id, p_description);

  RETURN v_new_balance;
END;
$$;

-- Function to process referral reward when referee makes first order
CREATE OR REPLACE FUNCTION process_referral_reward()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_referral RECORD;
BEGIN
  -- Only process paid orders
  IF NEW.payment_status != 'paid' THEN
    RETURN NEW;
  END IF;

  -- Find pending referral for this user
  SELECT * INTO v_referral
  FROM referrals
  WHERE referee_id = NEW.user_id
    AND status = 'pending'
    AND qualifying_order_id IS NULL;

  IF FOUND THEN
    -- Update referral as qualified
    UPDATE referrals
    SET
      status = 'rewarded',
      qualifying_order_id = NEW.id,
      referrer_credited_at = NOW(),
      updated_at = NOW()
    WHERE id = v_referral.id;

    -- Credit the referrer
    PERFORM add_user_credit(
      v_referral.referrer_id,
      v_referral.referrer_reward_pence,
      'referral_bonus',
      'referral',
      v_referral.id,
      'Referral reward - friend made their first purchase'
    );

    -- Update referral code stats
    UPDATE referral_codes
    SET
      total_referrals = total_referrals + 1,
      total_earned_pence = total_earned_pence + v_referral.referrer_reward_pence,
      updated_at = NOW()
    WHERE id = v_referral.referral_code_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for referral processing
DROP TRIGGER IF EXISTS trigger_process_referral_reward ON orders;
CREATE TRIGGER trigger_process_referral_reward
  AFTER INSERT OR UPDATE OF payment_status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION process_referral_reward();

-- Insert default settings for referral program
INSERT INTO store_settings (key, value, description)
VALUES
  ('referral_enabled', 'true', 'Enable/disable referral program'),
  ('referral_reward_referrer', '500', 'Reward for referrer in pence'),
  ('referral_reward_referee', '500', 'Reward for new user in pence'),
  ('referral_min_order', '2000', 'Minimum order value for referral to qualify in pence')
ON CONFLICT (key) DO NOTHING;

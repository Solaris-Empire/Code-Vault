-- Migration: High Priority Features
-- 1. Product Q&A
-- 2. Abandoned Cart Recovery
-- 3. Invoice Generation
-- 4. Gift Cards
-- 5. Back-in-Stock Alerts

-- ============================================
-- 1. PRODUCT Q&A SYSTEM
-- ============================================

-- Product Questions
CREATE TABLE IF NOT EXISTS product_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  guest_name TEXT,
  guest_email TEXT,
  question TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'answered')),
  is_featured BOOLEAN DEFAULT FALSE,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Product Answers
CREATE TABLE IF NOT EXISTS product_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES product_questions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  is_official BOOLEAN DEFAULT FALSE,
  answer TEXT NOT NULL,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Q&A Votes (for helpful/not helpful)
CREATE TABLE IF NOT EXISTS qa_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question_id UUID REFERENCES product_questions(id) ON DELETE CASCADE,
  answer_id UUID REFERENCES product_answers(id) ON DELETE CASCADE,
  is_helpful BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT qa_vote_target CHECK (
    (question_id IS NOT NULL AND answer_id IS NULL) OR
    (question_id IS NULL AND answer_id IS NOT NULL)
  ),
  UNIQUE (user_id, question_id),
  UNIQUE (user_id, answer_id)
);

-- Add Q&A count to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS question_count INTEGER DEFAULT 0;

-- ============================================
-- 2. ABANDONED CART RECOVERY
-- ============================================

-- Abandoned Carts tracking
CREATE TABLE IF NOT EXISTS abandoned_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  session_id TEXT,
  guest_email TEXT,
  cart_items JSONB NOT NULL DEFAULT '[]',
  cart_total_pence INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'GBP',
  recovery_status TEXT DEFAULT 'abandoned' CHECK (recovery_status IN ('abandoned', 'reminded', 'recovered', 'expired')),
  reminder_count INTEGER DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  recovered_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  abandoned_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cart Recovery Emails
CREATE TABLE IF NOT EXISTS cart_recovery_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  abandoned_cart_id UUID NOT NULL REFERENCES abandoned_carts(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL CHECK (email_type IN ('reminder_1', 'reminder_2', 'reminder_3', 'final_offer')),
  subject TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  discount_code TEXT,
  discount_percent INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cart Recovery Settings
CREATE TABLE IF NOT EXISTS cart_recovery_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default recovery settings
INSERT INTO cart_recovery_settings (setting_key, setting_value) VALUES
  ('is_enabled', 'true'),
  ('reminder_1_delay_hours', '1'),
  ('reminder_2_delay_hours', '24'),
  ('reminder_3_delay_hours', '72'),
  ('final_offer_delay_hours', '168'),
  ('final_offer_discount_percent', '10'),
  ('min_cart_value_pence', '1000')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================
-- 3. INVOICE GENERATION
-- ============================================

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Billing details
  billing_name TEXT NOT NULL,
  billing_email TEXT NOT NULL,
  billing_address JSONB NOT NULL,
  billing_phone TEXT,

  -- Company details (for business customers)
  company_name TEXT,
  company_vat_number TEXT,
  company_registration TEXT,

  -- Invoice amounts
  subtotal_pence INTEGER NOT NULL,
  discount_pence INTEGER DEFAULT 0,
  shipping_pence INTEGER DEFAULT 0,
  tax_pence INTEGER DEFAULT 0,
  total_pence INTEGER NOT NULL,

  -- VAT breakdown
  vat_rate DECIMAL(5,2) DEFAULT 20.00,
  vat_amount_pence INTEGER DEFAULT 0,

  -- Invoice details
  currency TEXT DEFAULT 'GBP',
  status TEXT DEFAULT 'issued' CHECK (status IN ('draft', 'issued', 'paid', 'cancelled', 'refunded')),
  issue_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  paid_date DATE,

  -- PDF storage
  pdf_url TEXT,
  pdf_generated_at TIMESTAMPTZ,

  -- Notes
  notes TEXT,
  terms TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoice Items
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price_pence INTEGER NOT NULL,
  total_pence INTEGER NOT NULL,
  vat_rate DECIMAL(5,2) DEFAULT 20.00,
  vat_amount_pence INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoice sequence for generating invoice numbers
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START WITH 1001;

-- Function to generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-' || LPAD(nextval('invoice_number_seq')::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. GIFT CARDS
-- ============================================

-- Gift Cards
CREATE TABLE IF NOT EXISTS gift_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,

  -- Value
  initial_value_pence INTEGER NOT NULL,
  current_balance_pence INTEGER NOT NULL,
  currency TEXT DEFAULT 'GBP',

  -- Purchaser
  purchased_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  purchased_by_email TEXT,
  purchase_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,

  -- Recipient
  recipient_email TEXT,
  recipient_name TEXT,
  gift_message TEXT,

  -- Delivery
  delivery_method TEXT DEFAULT 'email' CHECK (delivery_method IN ('email', 'print', 'physical')),
  email_sent_at TIMESTAMPTZ,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('pending', 'active', 'used', 'expired', 'cancelled')),
  activated_at TIMESTAMPTZ,

  -- Validity
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 year'),

  -- Design
  design_template TEXT DEFAULT 'default',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Gift Card Transactions
CREATE TABLE IF NOT EXISTS gift_card_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_card_id UUID NOT NULL REFERENCES gift_cards(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'redemption', 'refund', 'adjustment', 'expiry')),
  amount_pence INTEGER NOT NULL,
  balance_after_pence INTEGER NOT NULL,
  description TEXT,
  performed_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Gift Card Designs
CREATE TABLE IF NOT EXISTS gift_card_designs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  image_url TEXT NOT NULL,
  background_color TEXT DEFAULT '#10B981',
  text_color TEXT DEFAULT '#FFFFFF',
  is_active BOOLEAN DEFAULT TRUE,
  is_seasonal BOOLEAN DEFAULT FALSE,
  season TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default gift card designs
INSERT INTO gift_card_designs (name, slug, image_url, background_color) VALUES
  ('Classic Green', 'classic-green', '/images/gift-cards/classic-green.png', '#10B981'),
  ('Birthday', 'birthday', '/images/gift-cards/birthday.png', '#EC4899'),
  ('Thank You', 'thank-you', '/images/gift-cards/thank-you.png', '#6366F1'),
  ('Celebration', 'celebration', '/images/gift-cards/celebration.png', '#F59E0B'),
  ('Holiday', 'holiday', '/images/gift-cards/holiday.png', '#EF4444')
ON CONFLICT (slug) DO NOTHING;

-- Function to generate gift card code
CREATE OR REPLACE FUNCTION generate_gift_card_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..16 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
    IF i IN (4, 8, 12) THEN
      result := result || '-';
    END IF;
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. BACK-IN-STOCK ALERTS
-- ============================================

-- Stock Alert Subscriptions
CREATE TABLE IF NOT EXISTS stock_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  phone TEXT,
  notify_via TEXT DEFAULT 'email' CHECK (notify_via IN ('email', 'sms', 'push', 'all')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'notified', 'purchased', 'cancelled')),
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (product_id, email)
);

-- Stock Alert History (for analytics)
CREATE TABLE IF NOT EXISTS stock_alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_alert_id UUID REFERENCES stock_alerts(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('email', 'sms', 'push')),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  converted_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add stock alert count to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_alert_count INTEGER DEFAULT 0;

-- ============================================
-- INDEXES
-- ============================================

-- Product Q&A indexes
CREATE INDEX IF NOT EXISTS idx_product_questions_product ON product_questions(product_id);
CREATE INDEX IF NOT EXISTS idx_product_questions_status ON product_questions(status);
CREATE INDEX IF NOT EXISTS idx_product_answers_question ON product_answers(question_id);

-- Abandoned cart indexes
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_user ON abandoned_carts(user_id);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_status ON abandoned_carts(recovery_status);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_email ON abandoned_carts(guest_email);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_abandoned_at ON abandoned_carts(abandoned_at);

-- Invoice indexes
CREATE INDEX IF NOT EXISTS idx_invoices_order ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- Gift card indexes
CREATE INDEX IF NOT EXISTS idx_gift_cards_code ON gift_cards(code);
CREATE INDEX IF NOT EXISTS idx_gift_cards_status ON gift_cards(status);
CREATE INDEX IF NOT EXISTS idx_gift_cards_recipient ON gift_cards(recipient_email);
CREATE INDEX IF NOT EXISTS idx_gift_card_transactions_card ON gift_card_transactions(gift_card_id);

-- Stock alert indexes
CREATE INDEX IF NOT EXISTS idx_stock_alerts_product ON stock_alerts(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_email ON stock_alerts(email);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_status ON stock_alerts(status);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE product_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE abandoned_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_card_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_alerts ENABLE ROW LEVEL SECURITY;

-- Product Q&A policies
CREATE POLICY "Anyone can view approved questions" ON product_questions
  FOR SELECT USING (status = 'approved' OR status = 'answered');

CREATE POLICY "Users can create questions" ON product_questions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own questions" ON product_questions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Anyone can view answers" ON product_answers
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can answer" ON product_answers
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Abandoned cart policies
CREATE POLICY "Users can view own abandoned carts" ON abandoned_carts
  FOR SELECT USING (user_id = auth.uid());

-- Invoice policies
CREATE POLICY "Users can view own invoices" ON invoices
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can view own invoice items" ON invoice_items
  FOR SELECT USING (
    invoice_id IN (SELECT id FROM invoices WHERE user_id = auth.uid())
  );

-- Gift card policies
CREATE POLICY "Users can view purchased gift cards" ON gift_cards
  FOR SELECT USING (purchased_by_user_id = auth.uid() OR recipient_email = auth.jwt()->>'email');

-- Stock alert policies
CREATE POLICY "Users can manage own alerts" ON stock_alerts
  FOR ALL USING (user_id = auth.uid() OR email = auth.jwt()->>'email');

-- ============================================
-- TRIGGERS
-- ============================================

-- Update question count when question is approved
CREATE OR REPLACE FUNCTION update_product_question_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status IN ('approved', 'answered') THEN
    UPDATE products SET question_count = question_count + 1 WHERE id = NEW.product_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status NOT IN ('approved', 'answered') AND NEW.status IN ('approved', 'answered') THEN
      UPDATE products SET question_count = question_count + 1 WHERE id = NEW.product_id;
    ELSIF OLD.status IN ('approved', 'answered') AND NEW.status NOT IN ('approved', 'answered') THEN
      UPDATE products SET question_count = GREATEST(0, question_count - 1) WHERE id = NEW.product_id;
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.status IN ('approved', 'answered') THEN
    UPDATE products SET question_count = GREATEST(0, question_count - 1) WHERE id = OLD.product_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_question_count
  AFTER INSERT OR UPDATE OR DELETE ON product_questions
  FOR EACH ROW EXECUTE FUNCTION update_product_question_count();

-- Update stock alert count
CREATE OR REPLACE FUNCTION update_stock_alert_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE products SET stock_alert_count = stock_alert_count + 1 WHERE id = NEW.product_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE products SET stock_alert_count = GREATEST(0, stock_alert_count - 1) WHERE id = OLD.product_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_stock_alert_count
  AFTER INSERT OR DELETE ON stock_alerts
  FOR EACH ROW EXECUTE FUNCTION update_stock_alert_count();

-- Auto-create invoice when order is completed
CREATE OR REPLACE FUNCTION auto_create_invoice()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_number TEXT;
  v_invoice_id UUID;
BEGIN
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    -- Generate invoice number
    v_invoice_number := generate_invoice_number();

    -- Create invoice
    INSERT INTO invoices (
      invoice_number,
      order_id,
      user_id,
      billing_name,
      billing_email,
      billing_address,
      billing_phone,
      subtotal_pence,
      discount_pence,
      shipping_pence,
      tax_pence,
      total_pence,
      vat_amount_pence,
      status,
      paid_date
    ) VALUES (
      v_invoice_number,
      NEW.id,
      NEW.user_id,
      COALESCE(NEW.shipping_address->>'name', 'Customer'),
      COALESCE(NEW.shipping_address->>'email', ''),
      NEW.shipping_address,
      NEW.shipping_address->>'phone',
      NEW.subtotal_pence,
      COALESCE(NEW.discount_pence, 0),
      COALESCE(NEW.shipping_pence, 0),
      0,
      NEW.total_pence,
      ROUND(NEW.total_pence * 0.20 / 1.20),
      'paid',
      NOW()
    ) RETURNING id INTO v_invoice_id;

    -- Create invoice items from order items
    INSERT INTO invoice_items (invoice_id, product_id, description, quantity, unit_price_pence, total_pence)
    SELECT
      v_invoice_id,
      oi.product_id,
      oi.product_name,
      oi.quantity,
      oi.price_pence,
      oi.quantity * oi.price_pence
    FROM order_items oi
    WHERE oi.order_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_create_invoice
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION auto_create_invoice();

-- Check for back in stock and notify
CREATE OR REPLACE FUNCTION check_back_in_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- If product was out of stock and now has stock
  IF OLD.stock_quantity = 0 AND NEW.stock_quantity > 0 THEN
    -- Update stock alerts to notified status (actual notification sent by background job)
    UPDATE stock_alerts
    SET status = 'notified', notified_at = NOW(), updated_at = NOW()
    WHERE product_id = NEW.id AND status = 'active';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_back_in_stock
  AFTER UPDATE ON products
  FOR EACH ROW
  WHEN (OLD.stock_quantity = 0 AND NEW.stock_quantity > 0)
  EXECUTE FUNCTION check_back_in_stock();

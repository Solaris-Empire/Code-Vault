-- =====================================================
-- Store Settings Table
-- =====================================================

CREATE TABLE public.store_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast key lookup
CREATE INDEX idx_store_settings_key ON public.store_settings(key);
CREATE INDEX idx_store_settings_category ON public.store_settings(category);

-- Enable RLS
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

-- Public read for certain settings
CREATE POLICY "Public settings are viewable" ON public.store_settings
  FOR SELECT USING (
    category IN ('store', 'delivery', 'features')
  );

-- Admins can manage all settings
CREATE POLICY "Admins can manage settings" ON public.store_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Updated at trigger
CREATE TRIGGER update_store_settings_updated_at
  BEFORE UPDATE ON public.store_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Seed default settings
INSERT INTO public.store_settings (key, value, description, category) VALUES
-- Store Info
('store_name', '"FreshMart UK"', 'Name of the store', 'store'),
('store_email', '"support@freshmart.co.uk"', 'Contact email address', 'store'),
('store_phone', '"+44 20 1234 5678"', 'Contact phone number', 'store'),
('store_address', '"London, United Kingdom"', 'Store address', 'store'),
('currency', '"GBP"', 'Store currency', 'store'),
('timezone', '"Europe/London"', 'Store timezone', 'store'),

-- Delivery
('min_order_value', '1500', 'Minimum order value in pence', 'delivery'),
('free_delivery_threshold', '5000', 'Free delivery threshold in pence', 'delivery'),
('default_delivery_fee', '399', 'Default delivery fee in pence', 'delivery'),

-- Payments
('tax_rate', '20', 'Tax rate percentage', 'payments'),

-- Notifications
('order_confirmation_email', 'true', 'Send order confirmation emails', 'notifications'),
('low_stock_alert', 'true', 'Enable low stock alerts', 'notifications'),
('low_stock_threshold', '10', 'Low stock threshold quantity', 'notifications'),

-- Features
('enable_reviews', 'true', 'Enable product reviews', 'features'),
('enable_wishlist', 'true', 'Enable wishlist feature', 'features'),
('enable_guest_checkout', 'true', 'Allow guest checkout', 'features'),

-- Security
('maintenance_mode', 'false', 'Enable maintenance mode', 'security');

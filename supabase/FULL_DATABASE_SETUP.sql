-- ================================================================
-- UK GROCERY STORE - COMPLETE DATABASE SETUP
-- Combined Migration File
-- Generated: 2026-01-24T07:08:30.694Z
-- ================================================================

-- IMPORTANT: Run this in your Supabase SQL Editor
-- Go to: https://supabase.com/dashboard > Your Project > SQL Editor


-- ================================================================
-- MIGRATION: 00001_initial_schema.sql
-- ================================================================

-- =====================================================
-- UK Grocery E-Commerce Database Schema
-- =====================================================

-- =====================================================
-- USERS & AUTHENTICATION (extends Supabase auth.users)
-- =====================================================

-- Customer profiles (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  phone TEXT,
  role TEXT DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer delivery addresses
CREATE TABLE public.addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  label TEXT DEFAULT 'Home',
  address_line_1 TEXT NOT NULL,
  address_line_2 TEXT,
  city TEXT NOT NULL,
  county TEXT,
  postcode TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  delivery_instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PRODUCT CATALOG
-- =====================================================

-- Product categories
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  image_url TEXT,
  parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  short_description TEXT,
  sku TEXT UNIQUE,
  barcode TEXT,

  -- Pricing (GBP in pence)
  price_pence INT NOT NULL,
  compare_at_price_pence INT,
  cost_price_pence INT,

  -- Inventory
  stock_quantity INT DEFAULT 0,
  low_stock_threshold INT DEFAULT 10,
  track_inventory BOOLEAN DEFAULT TRUE,
  allow_backorder BOOLEAN DEFAULT FALSE,

  -- Product details
  unit TEXT DEFAULT 'each',
  unit_value DECIMAL(10,3),
  brand TEXT,

  -- Dietary/allergen info
  is_vegan BOOLEAN DEFAULT FALSE,
  is_vegetarian BOOLEAN DEFAULT FALSE,
  is_gluten_free BOOLEAN DEFAULT FALSE,
  is_organic BOOLEAN DEFAULT FALSE,
  allergens TEXT[],
  nutritional_info JSONB,

  -- Media
  image_url TEXT,
  images TEXT[],

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,

  -- SEO
  meta_title TEXT,
  meta_description TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Product-Category relationship (many-to-many)
CREATE TABLE public.product_categories (
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, category_id)
);

-- =====================================================
-- SHOPPING CART
-- =====================================================

-- Shopping carts
CREATE TABLE public.carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT user_or_session CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
);

-- Cart items
CREATE TABLE public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID REFERENCES public.carts(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (cart_id, product_id)
);

-- =====================================================
-- ORDERS
-- =====================================================

-- Delivery time slots
CREATE TABLE public.delivery_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_orders INT DEFAULT 20,
  current_orders INT DEFAULT 0,
  delivery_fee_pence INT DEFAULT 399,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (date, start_time, end_time)
);

-- Orders
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Customer info
  customer_email TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,

  -- Delivery address
  delivery_address_line_1 TEXT NOT NULL,
  delivery_address_line_2 TEXT,
  delivery_city TEXT NOT NULL,
  delivery_county TEXT,
  delivery_postcode TEXT NOT NULL,
  delivery_instructions TEXT,

  -- Delivery scheduling
  delivery_slot_id UUID REFERENCES public.delivery_slots(id),
  delivery_date DATE,
  delivery_time_start TIME,
  delivery_time_end TIME,

  -- Pricing (in pence)
  subtotal_pence INT NOT NULL,
  delivery_fee_pence INT DEFAULT 0,
  discount_pence INT DEFAULT 0,
  total_pence INT NOT NULL,

  -- Payment
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  payment_status TEXT DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'partially_refunded')),

  -- Order status
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'processing', 'ready_for_delivery',
                      'out_for_delivery', 'delivered', 'cancelled')),

  -- Timestamps
  paid_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  dispatched_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order items
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,

  -- Denormalized product info
  product_name TEXT NOT NULL,
  product_sku TEXT,
  product_image_url TEXT,

  quantity INT NOT NULL,
  unit_price_pence INT NOT NULL,
  total_price_pence INT NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_products_slug ON public.products(slug);
CREATE INDEX idx_products_is_active ON public.products(is_active);
CREATE INDEX idx_products_is_featured ON public.products(is_featured);
CREATE INDEX idx_product_categories_category ON public.product_categories(category_id);
CREATE INDEX idx_categories_slug ON public.categories(slug);
CREATE INDEX idx_categories_parent ON public.categories(parent_id);
CREATE INDEX idx_orders_user ON public.orders(user_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_number ON public.orders(order_number);
CREATE INDEX idx_cart_user ON public.carts(user_id);
CREATE INDEX idx_cart_session ON public.carts(session_id);
CREATE INDEX idx_delivery_slots_date ON public.delivery_slots(date);
CREATE INDEX idx_addresses_user ON public.addresses(user_id);

-- Full-text search for products
CREATE INDEX idx_products_search ON public.products
  USING GIN (to_tsvector('english', name || ' ' || COALESCE(description, '') || ' ' || COALESCE(brand, '')));

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_slots ENABLE ROW LEVEL SECURITY;

-- Products: Public read, admin write
CREATE POLICY "Products are viewable by everyone" ON public.products
  FOR SELECT USING (true);
CREATE POLICY "Admins can insert products" ON public.products
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Admins can update products" ON public.products
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Admins can delete products" ON public.products
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Categories: Public read, admin write
CREATE POLICY "Categories are viewable by everyone" ON public.categories
  FOR SELECT USING (true);
CREATE POLICY "Admins can manage categories" ON public.categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Product categories: Public read
CREATE POLICY "Product categories are viewable by everyone" ON public.product_categories
  FOR SELECT USING (true);
CREATE POLICY "Admins can manage product categories" ON public.product_categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Profiles: Users can view/edit their own, admins can view all
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Addresses: Users can manage their own
CREATE POLICY "Users can view own addresses" ON public.addresses
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own addresses" ON public.addresses
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own addresses" ON public.addresses
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own addresses" ON public.addresses
  FOR DELETE USING (auth.uid() = user_id);

-- Carts: Users can manage their own, guests use session
CREATE POLICY "Users can manage own cart" ON public.carts
  FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

-- Cart items: Based on cart ownership
CREATE POLICY "Users can manage cart items" ON public.cart_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.carts
      WHERE id = cart_id AND (user_id = auth.uid() OR user_id IS NULL)
    )
  );

-- Orders: Users can view their own, admins can view/manage all
CREATE POLICY "Users can view own orders" ON public.orders
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all orders" ON public.orders
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Users can insert orders" ON public.orders
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Admins can update orders" ON public.orders
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Order items: Based on order ownership
CREATE POLICY "Users can view own order items" ON public.order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND user_id = auth.uid())
  );
CREATE POLICY "Admins can view all order items" ON public.order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Order items can be inserted" ON public.order_items
  FOR INSERT WITH CHECK (true);

-- Delivery slots: Public read, admin manage
CREATE POLICY "Delivery slots are viewable by everyone" ON public.delivery_slots
  FOR SELECT USING (true);
CREATE POLICY "Admins can manage delivery slots" ON public.delivery_slots
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_addresses_updated_at
  BEFORE UPDATE ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_carts_updated_at
  BEFORE UPDATE ON public.carts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_cart_items_updated_at
  BEFORE UPDATE ON public.cart_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =====================================================
-- SEED DATA: Sample Categories
-- =====================================================

INSERT INTO public.categories (name, slug, description, display_order) VALUES
('Fruits & Vegetables', 'fruits-vegetables', 'Fresh fruits and vegetables', 1),
('Dairy & Eggs', 'dairy-eggs', 'Milk, cheese, eggs and more', 2),
('Meat & Seafood', 'meat-seafood', 'Fresh meat and seafood', 3),
('Bakery', 'bakery', 'Fresh bread and baked goods', 4),
('Frozen Foods', 'frozen-foods', 'Frozen meals and ingredients', 5),
('Beverages', 'beverages', 'Drinks and refreshments', 6),
('Snacks', 'snacks', 'Crisps, nuts and treats', 7),
('Pantry', 'pantry', 'Cooking essentials and dry goods', 8),
('Household', 'household', 'Cleaning and household supplies', 9),
('Health & Beauty', 'health-beauty', 'Personal care products', 10);

-- Sample subcategories
INSERT INTO public.categories (name, slug, description, parent_id, display_order) VALUES
('Fresh Fruits', 'fresh-fruits', 'Fresh seasonal fruits', (SELECT id FROM public.categories WHERE slug = 'fruits-vegetables'), 1),
('Fresh Vegetables', 'fresh-vegetables', 'Fresh vegetables', (SELECT id FROM public.categories WHERE slug = 'fruits-vegetables'), 2),
('Milk', 'milk', 'Fresh milk and alternatives', (SELECT id FROM public.categories WHERE slug = 'dairy-eggs'), 1),
('Cheese', 'cheese', 'Various cheeses', (SELECT id FROM public.categories WHERE slug = 'dairy-eggs'), 2),
('Eggs', 'eggs', 'Free range and organic eggs', (SELECT id FROM public.categories WHERE slug = 'dairy-eggs'), 3);

-- =====================================================
-- SEED DATA: Sample Products
-- =====================================================

INSERT INTO public.products (name, slug, description, short_description, price_pence, stock_quantity, unit, unit_value, image_url, is_featured) VALUES
('Organic Bananas', 'organic-bananas', 'Sweet and ripe organic bananas, perfect for snacking or baking.', 'Organic bananas bunch', 149, 100, 'bunch', 6, '/images/products/bananas.jpg', true),
('British Whole Milk 2L', 'british-whole-milk-2l', 'Fresh British whole milk from local farms.', 'Fresh whole milk', 185, 50, 'bottle', 2, '/images/products/milk.jpg', true),
('Free Range Eggs 12 Pack', 'free-range-eggs-12', 'Farm fresh free range eggs from happy hens.', 'Free range eggs', 350, 40, 'pack', 12, '/images/products/eggs.jpg', true),
('Sourdough Bread Loaf', 'sourdough-bread-loaf', 'Artisan sourdough bread, freshly baked daily.', 'Fresh sourdough loaf', 320, 25, 'each', 1, '/images/products/sourdough.jpg', true),
('British Chicken Breast 500g', 'british-chicken-breast-500g', 'Premium British chicken breast fillets.', 'Chicken breast fillets', 549, 30, 'pack', 500, '/images/products/chicken.jpg', true),
('Atlantic Salmon Fillets 280g', 'atlantic-salmon-fillets', 'Fresh Atlantic salmon fillets, responsibly sourced.', 'Fresh salmon fillets', 650, 20, 'pack', 280, '/images/products/salmon.jpg', false),
('Cheddar Cheese 400g', 'cheddar-cheese-400g', 'Mature British cheddar cheese, aged for full flavor.', 'Mature cheddar', 420, 35, 'pack', 400, '/images/products/cheddar.jpg', false),
('Broccoli', 'broccoli', 'Fresh green broccoli, packed with vitamins.', 'Fresh broccoli', 99, 60, 'each', 1, '/images/products/broccoli.jpg', false),
('Carrots 1kg', 'carrots-1kg', 'Sweet and crunchy carrots, perfect for cooking or snacking.', 'Fresh carrots', 85, 70, 'bag', 1000, '/images/products/carrots.jpg', false),
('Semi-Skimmed Milk 1L', 'semi-skimmed-milk-1l', 'Fresh British semi-skimmed milk.', 'Semi-skimmed milk', 115, 45, 'bottle', 1, '/images/products/semi-milk.jpg', false);

-- Link products to categories
INSERT INTO public.product_categories (product_id, category_id) VALUES
((SELECT id FROM public.products WHERE slug = 'organic-bananas'), (SELECT id FROM public.categories WHERE slug = 'fruits-vegetables')),
((SELECT id FROM public.products WHERE slug = 'organic-bananas'), (SELECT id FROM public.categories WHERE slug = 'fresh-fruits')),
((SELECT id FROM public.products WHERE slug = 'british-whole-milk-2l'), (SELECT id FROM public.categories WHERE slug = 'dairy-eggs')),
((SELECT id FROM public.products WHERE slug = 'british-whole-milk-2l'), (SELECT id FROM public.categories WHERE slug = 'milk')),
((SELECT id FROM public.products WHERE slug = 'free-range-eggs-12'), (SELECT id FROM public.categories WHERE slug = 'dairy-eggs')),
((SELECT id FROM public.products WHERE slug = 'free-range-eggs-12'), (SELECT id FROM public.categories WHERE slug = 'eggs')),
((SELECT id FROM public.products WHERE slug = 'sourdough-bread-loaf'), (SELECT id FROM public.categories WHERE slug = 'bakery')),
((SELECT id FROM public.products WHERE slug = 'british-chicken-breast-500g'), (SELECT id FROM public.categories WHERE slug = 'meat-seafood')),
((SELECT id FROM public.products WHERE slug = 'atlantic-salmon-fillets'), (SELECT id FROM public.categories WHERE slug = 'meat-seafood')),
((SELECT id FROM public.products WHERE slug = 'cheddar-cheese-400g'), (SELECT id FROM public.categories WHERE slug = 'dairy-eggs')),
((SELECT id FROM public.products WHERE slug = 'cheddar-cheese-400g'), (SELECT id FROM public.categories WHERE slug = 'cheese')),
((SELECT id FROM public.products WHERE slug = 'broccoli'), (SELECT id FROM public.categories WHERE slug = 'fruits-vegetables')),
((SELECT id FROM public.products WHERE slug = 'broccoli'), (SELECT id FROM public.categories WHERE slug = 'fresh-vegetables')),
((SELECT id FROM public.products WHERE slug = 'carrots-1kg'), (SELECT id FROM public.categories WHERE slug = 'fruits-vegetables')),
((SELECT id FROM public.products WHERE slug = 'carrots-1kg'), (SELECT id FROM public.categories WHERE slug = 'fresh-vegetables')),
((SELECT id FROM public.products WHERE slug = 'semi-skimmed-milk-1l'), (SELECT id FROM public.categories WHERE slug = 'dairy-eggs')),
((SELECT id FROM public.products WHERE slug = 'semi-skimmed-milk-1l'), (SELECT id FROM public.categories WHERE slug = 'milk'));

-- =====================================================
-- SEED DATA: Sample Delivery Slots (Next 7 days)
-- =====================================================

INSERT INTO public.delivery_slots (date, start_time, end_time, max_orders, delivery_fee_pence)
SELECT
  CURRENT_DATE + i,
  slot_time::TIME,
  (slot_time::TIME + INTERVAL '2 hours')::TIME,
  20,
  CASE
    WHEN slot_time = '08:00' THEN 499
    WHEN slot_time = '18:00' THEN 499
    ELSE 399
  END
FROM generate_series(1, 7) AS i,
     unnest(ARRAY['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00']) AS slot_time;



-- ================================================================
-- MIGRATION: 00002_hero_slides.sql
-- ================================================================

-- =====================================================
-- Hero Slides Table for Homepage Banners
-- =====================================================

CREATE TABLE public.hero_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT,
  image_url TEXT NOT NULL,
  button_text TEXT,
  button_link TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for ordering
CREATE INDEX idx_hero_slides_order ON public.hero_slides(display_order);
CREATE INDEX idx_hero_slides_active ON public.hero_slides(is_active);

-- Enable RLS
ALTER TABLE public.hero_slides ENABLE ROW LEVEL SECURITY;

-- Public read policy
CREATE POLICY "Hero slides are viewable by everyone" ON public.hero_slides
  FOR SELECT USING (true);

-- Admin manage policy
CREATE POLICY "Admins can manage hero slides" ON public.hero_slides
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Updated at trigger
CREATE TRIGGER update_hero_slides_updated_at
  BEFORE UPDATE ON public.hero_slides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Seed sample hero slides
INSERT INTO public.hero_slides (title, subtitle, image_url, button_text, button_link, is_active, display_order) VALUES
('Fresh Groceries Delivered', 'Get 20% off your first order with code FRESH20', 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1920&h=600&fit=crop', 'Shop Now', '/products', true, 1),
('Organic & Local', 'Support local farmers with our organic produce range', 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=1920&h=600&fit=crop', 'Explore Organic', '/products?category=fruits-vegetables', true, 2),
('Free Delivery Over £50', 'Fresh food delivered to your door', 'https://images.unsplash.com/photo-1534723452862-4c874018d66d?w=1920&h=600&fit=crop', 'Start Shopping', '/products', true, 3);



-- ================================================================
-- MIGRATION: 00003_store_settings.sql
-- ================================================================

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



-- ================================================================
-- MIGRATION: 00004_multibuy_offers.sql
-- ================================================================

-- =====================================================
-- Multi-Buy Offers Table (2 for £X, 3 for £X deals)
-- =====================================================

CREATE TABLE public.multibuy_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,

  -- Offer details
  quantity INT NOT NULL CHECK (quantity >= 2),
  offer_price_pence INT NOT NULL CHECK (offer_price_pence > 0),

  -- Optional: Apply to category instead of single product
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,

  -- Offer validity
  is_active BOOLEAN DEFAULT TRUE,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,

  -- Display
  badge_text TEXT, -- e.g., "2 for £5" or "Buy 2 Save 20%"

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Either product_id or category_id must be set
  CONSTRAINT product_or_category CHECK (
    (product_id IS NOT NULL AND category_id IS NULL) OR
    (product_id IS NULL AND category_id IS NOT NULL)
  )
);

-- Indexes
CREATE INDEX idx_multibuy_product ON public.multibuy_offers(product_id);
CREATE INDEX idx_multibuy_category ON public.multibuy_offers(category_id);
CREATE INDEX idx_multibuy_active ON public.multibuy_offers(is_active);
CREATE INDEX idx_multibuy_dates ON public.multibuy_offers(start_date, end_date);

-- Enable RLS
ALTER TABLE public.multibuy_offers ENABLE ROW LEVEL SECURITY;

-- Public read policy for active offers
CREATE POLICY "Active offers are viewable by everyone" ON public.multibuy_offers
  FOR SELECT USING (
    is_active = true AND
    (start_date IS NULL OR start_date <= NOW()) AND
    (end_date IS NULL OR end_date >= NOW())
  );

-- Admin manage policy
CREATE POLICY "Admins can manage offers" ON public.multibuy_offers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Updated at trigger
CREATE TRIGGER update_multibuy_offers_updated_at
  BEFORE UPDATE ON public.multibuy_offers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Add offer fields to products table for quick display
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS has_offer BOOLEAN DEFAULT FALSE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS offer_badge TEXT;

-- Function to auto-generate badge text
CREATE OR REPLACE FUNCTION generate_offer_badge()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.badge_text IS NULL OR NEW.badge_text = '' THEN
    NEW.badge_text := NEW.quantity || ' for £' || (NEW.offer_price_pence::DECIMAL / 100)::TEXT;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_generate_badge
  BEFORE INSERT OR UPDATE ON public.multibuy_offers
  FOR EACH ROW EXECUTE FUNCTION generate_offer_badge();

-- Seed sample multi-buy offers
INSERT INTO public.multibuy_offers (product_id, quantity, offer_price_pence, is_active, badge_text) VALUES
((SELECT id FROM public.products WHERE slug = 'organic-bananas'), 2, 250, true, '2 for £2.50'),
((SELECT id FROM public.products WHERE slug = 'british-whole-milk-2l'), 2, 300, true, '2 for £3'),
((SELECT id FROM public.products WHERE slug = 'free-range-eggs-12'), 2, 600, true, '2 for £6'),
((SELECT id FROM public.products WHERE slug = 'sourdough-bread-loaf'), 2, 500, true, '2 for £5');

-- Update products with offers
UPDATE public.products SET has_offer = true, offer_badge = '2 for £2.50' WHERE slug = 'organic-bananas';
UPDATE public.products SET has_offer = true, offer_badge = '2 for £3' WHERE slug = 'british-whole-milk-2l';
UPDATE public.products SET has_offer = true, offer_badge = '2 for £6' WHERE slug = 'free-range-eggs-12';
UPDATE public.products SET has_offer = true, offer_badge = '2 for £5' WHERE slug = 'sourdough-bread-loaf';



-- ================================================================
-- MIGRATION: 00005_add_weight_grams.sql
-- ================================================================

-- Add weight_grams column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_grams INTEGER DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN products.weight_grams IS 'Product weight in grams';



-- ================================================================
-- MIGRATION: 00006_add_category_emoji.sql
-- ================================================================

-- Add emoji column to categories table
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS emoji TEXT;

-- Update existing categories with emojis
UPDATE public.categories SET emoji = '🥬' WHERE slug = 'fruits-vegetables';
UPDATE public.categories SET emoji = '🥩' WHERE slug = 'meat-poultry';
UPDATE public.categories SET emoji = '🐟' WHERE slug = 'fish-seafood';
UPDATE public.categories SET emoji = '🥛' WHERE slug = 'dairy-eggs';
UPDATE public.categories SET emoji = '🥐' WHERE slug = 'bakery';
UPDATE public.categories SET emoji = '🧊' WHERE slug = 'frozen';
UPDATE public.categories SET emoji = '🥫' WHERE slug = 'pantry';
UPDATE public.categories SET emoji = '🍹' WHERE slug = 'drinks';
UPDATE public.categories SET emoji = '🍿' WHERE slug = 'snacks-sweets';
UPDATE public.categories SET emoji = '🍷' WHERE slug = 'alcohol';
UPDATE public.categories SET emoji = '🧹' WHERE slug = 'household';
UPDATE public.categories SET emoji = '💊' WHERE slug = 'health-beauty';

-- Alternative slug mappings
UPDATE public.categories SET emoji = '🥩' WHERE slug = 'meat-seafood' AND emoji IS NULL;
UPDATE public.categories SET emoji = '🧊' WHERE slug = 'frozen-foods' AND emoji IS NULL;
UPDATE public.categories SET emoji = '🍹' WHERE slug = 'beverages' AND emoji IS NULL;
UPDATE public.categories SET emoji = '🍿' WHERE slug = 'snacks' AND emoji IS NULL;



-- ================================================================
-- MIGRATION: 00007_vendors_multivendor.sql
-- ================================================================

-- =====================================================
-- MULTI-VENDOR MARKETPLACE SCHEMA
-- =====================================================

-- 1. VENDORS TABLE
CREATE TABLE public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  business_name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  logo_url TEXT,
  banner_url TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  address_line_1 TEXT,
  address_line_2 TEXT,
  city TEXT,
  postcode TEXT,
  country TEXT DEFAULT 'United Kingdom',

  -- Business Details
  company_number TEXT,
  vat_number TEXT,

  -- Stripe Connect
  stripe_account_id TEXT,
  stripe_onboarding_complete BOOLEAN DEFAULT FALSE,
  stripe_charges_enabled BOOLEAN DEFAULT FALSE,
  stripe_payouts_enabled BOOLEAN DEFAULT FALSE,

  -- Status & Verification
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'suspended', 'rejected')),
  is_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,

  -- Commission (percentage platform takes)
  commission_rate DECIMAL(5,2) DEFAULT 15.00,

  -- Stats (updated via triggers)
  total_sales_pence BIGINT DEFAULT 0,
  total_orders INT DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0,
  review_count INT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. VENDOR APPLICATIONS
CREATE TABLE public.vendor_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  business_type TEXT CHECK (business_type IN ('sole_trader', 'limited_company', 'partnership', 'other')),
  description TEXT,
  product_categories TEXT[],
  expected_monthly_sales TEXT,
  website_url TEXT,
  phone TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. UPDATE PRODUCTS - Add vendor relationship
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- 4. VENDOR ORDERS (portion of order belonging to vendor)
CREATE TABLE public.vendor_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE,

  -- Amounts (in pence)
  total_amount INT NOT NULL,
  commission_amount INT NOT NULL,
  vendor_amount INT NOT NULL,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'transferred', 'pending_payout', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),

  -- Stripe Transfer
  stripe_transfer_id TEXT,

  -- Shipping
  shipped_at TIMESTAMPTZ,
  tracking_number TEXT,
  tracking_url TEXT,
  carrier TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. VENDOR PAYOUTS
CREATE TABLE public.vendor_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
  amount_pence INT NOT NULL,
  currency TEXT DEFAULT 'GBP',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  stripe_transfer_id TEXT,
  stripe_payout_id TEXT,
  period_start DATE,
  period_end DATE,
  orders_count INT DEFAULT 0,
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. UPDATE ORDER ITEMS - Add vendor tracking
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES public.vendors(id);
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS vendor_payout_pence INT;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS commission_pence INT;

-- 7. UPDATE PROFILES - Add vendor reference
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES public.vendors(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_vendor BOOLEAN DEFAULT FALSE;

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_vendors_user_id ON public.vendors(user_id);
CREATE INDEX IF NOT EXISTS idx_vendors_slug ON public.vendors(slug);
CREATE INDEX IF NOT EXISTS idx_vendors_status ON public.vendors(status);
CREATE INDEX IF NOT EXISTS idx_vendors_stripe_account ON public.vendors(stripe_account_id);
CREATE INDEX IF NOT EXISTS idx_products_vendor ON public.products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_orders_order ON public.vendor_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_vendor_orders_vendor ON public.vendor_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payouts_vendor ON public.vendor_payouts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_applications_user ON public.vendor_applications(user_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_payouts ENABLE ROW LEVEL SECURITY;

-- Vendors: Public can view approved, vendors can manage own
CREATE POLICY "Approved vendors are viewable by everyone" ON public.vendors
  FOR SELECT USING (status = 'approved');

CREATE POLICY "Vendors can view own profile" ON public.vendors
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Vendors can update own profile" ON public.vendors
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all vendors" ON public.vendors
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Vendor Applications
CREATE POLICY "Users can view own applications" ON public.vendor_applications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create applications" ON public.vendor_applications
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage applications" ON public.vendor_applications
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Vendor Orders
CREATE POLICY "Vendors can view own orders" ON public.vendor_orders
  FOR SELECT USING (
    vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())
  );

CREATE POLICY "Vendors can update own orders" ON public.vendor_orders
  FOR UPDATE USING (
    vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can manage all vendor orders" ON public.vendor_orders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Vendor Payouts
CREATE POLICY "Vendors can view own payouts" ON public.vendor_payouts
  FOR SELECT USING (
    vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can manage payouts" ON public.vendor_payouts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- =====================================================
-- TRIGGERS
-- =====================================================
CREATE TRIGGER update_vendors_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_vendor_orders_updated_at
  BEFORE UPDATE ON public.vendor_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



-- ================================================================
-- MIGRATION: 00008_marketplace_features.sql
-- ================================================================

-- =====================================================
-- MARKETPLACE FEATURES: REVIEWS, WISHLISTS, FLASH DEALS
-- =====================================================

-- 1. PRODUCT REVIEWS
CREATE TABLE public.product_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  content TEXT,
  images TEXT[] DEFAULT '{}',
  is_verified_purchase BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  helpful_count INT DEFAULT 0,
  not_helpful_count INT DEFAULT 0,
  admin_notes TEXT,
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. REVIEW VOTES (helpful/not helpful)
CREATE TABLE public.review_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.product_reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_helpful BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (review_id, user_id)
);

-- 3. WISHLISTS
CREATE TABLE public.wishlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT DEFAULT 'My Wishlist',
  is_public BOOLEAN DEFAULT FALSE,
  share_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. WISHLIST ITEMS
CREATE TABLE public.wishlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wishlist_id UUID NOT NULL REFERENCES public.wishlists(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  added_price_pence INT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (wishlist_id, product_id)
);

-- 5. FLASH DEALS
CREATE TABLE public.flash_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  deal_price_pence INT NOT NULL,
  original_price_pence INT NOT NULL,
  discount_percentage INT GENERATED ALWAYS AS (
    CASE WHEN original_price_pence > 0
    THEN ROUND(((original_price_pence - deal_price_pence)::DECIMAL / original_price_pence) * 100)
    ELSE 0 END
  ) STORED,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  max_quantity INT,
  claimed_quantity INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  banner_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ADD RATING FIELDS TO PRODUCTS
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS avg_rating DECIMAL(3,2) DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS review_count INT DEFAULT 0;

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON public.product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_user ON public.product_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_status ON public.product_reviews(status);
CREATE INDEX IF NOT EXISTS idx_product_reviews_rating ON public.product_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_product_reviews_created ON public.product_reviews(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_review_votes_review ON public.review_votes(review_id);
CREATE INDEX IF NOT EXISTS idx_review_votes_user ON public.review_votes(user_id);

CREATE INDEX IF NOT EXISTS idx_wishlists_user ON public.wishlists(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_share_token ON public.wishlists(share_token);

CREATE INDEX IF NOT EXISTS idx_wishlist_items_wishlist ON public.wishlist_items(wishlist_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_items_product ON public.wishlist_items(product_id);

CREATE INDEX IF NOT EXISTS idx_flash_deals_product ON public.flash_deals(product_id);
CREATE INDEX IF NOT EXISTS idx_flash_deals_slug ON public.flash_deals(slug);
CREATE INDEX IF NOT EXISTS idx_flash_deals_active ON public.flash_deals(is_active, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_flash_deals_featured ON public.flash_deals(is_featured, is_active);

CREATE INDEX IF NOT EXISTS idx_products_rating ON public.products(avg_rating DESC);
CREATE INDEX IF NOT EXISTS idx_products_review_count ON public.products(review_count DESC);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flash_deals ENABLE ROW LEVEL SECURITY;

-- Product Reviews Policies
CREATE POLICY "Approved reviews are viewable by everyone" ON public.product_reviews
  FOR SELECT USING (status = 'approved');

CREATE POLICY "Users can view own reviews" ON public.product_reviews
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create reviews" ON public.product_reviews
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own pending reviews" ON public.product_reviews
  FOR UPDATE USING (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "Users can delete own reviews" ON public.product_reviews
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all reviews" ON public.product_reviews
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Review Votes Policies
CREATE POLICY "Review votes are viewable by everyone" ON public.review_votes
  FOR SELECT USING (true);

CREATE POLICY "Users can create votes" ON public.review_votes
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own votes" ON public.review_votes
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own votes" ON public.review_votes
  FOR DELETE USING (user_id = auth.uid());

-- Wishlists Policies
CREATE POLICY "Users can view own wishlists" ON public.wishlists
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Public wishlists are viewable by everyone" ON public.wishlists
  FOR SELECT USING (is_public = true);

CREATE POLICY "Users can create wishlists" ON public.wishlists
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own wishlists" ON public.wishlists
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own wishlists" ON public.wishlists
  FOR DELETE USING (user_id = auth.uid());

-- Wishlist Items Policies
CREATE POLICY "Users can view own wishlist items" ON public.wishlist_items
  FOR SELECT USING (
    wishlist_id IN (SELECT id FROM public.wishlists WHERE user_id = auth.uid())
  );

CREATE POLICY "Public wishlist items are viewable" ON public.wishlist_items
  FOR SELECT USING (
    wishlist_id IN (SELECT id FROM public.wishlists WHERE is_public = true)
  );

CREATE POLICY "Users can manage own wishlist items" ON public.wishlist_items
  FOR ALL USING (
    wishlist_id IN (SELECT id FROM public.wishlists WHERE user_id = auth.uid())
  );

-- Flash Deals Policies
CREATE POLICY "Active deals are viewable by everyone" ON public.flash_deals
  FOR SELECT USING (is_active = true AND starts_at <= NOW() AND ends_at >= NOW());

CREATE POLICY "Admins can manage deals" ON public.flash_deals
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update product rating when review is approved/deleted
CREATE OR REPLACE FUNCTION public.update_product_rating()
RETURNS TRIGGER AS $$
DECLARE
  new_avg DECIMAL(3,2);
  new_count INT;
BEGIN
  -- Calculate new average and count for the product
  SELECT
    COALESCE(ROUND(AVG(rating)::DECIMAL, 2), 0),
    COUNT(*)
  INTO new_avg, new_count
  FROM public.product_reviews
  WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
    AND status = 'approved';

  -- Update the product
  UPDATE public.products
  SET
    avg_rating = new_avg,
    review_count = new_count,
    updated_at = NOW()
  WHERE id = COALESCE(NEW.product_id, OLD.product_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_product_rating_on_review
  AFTER INSERT OR UPDATE OR DELETE ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_product_rating();

-- Update review helpful counts
CREATE OR REPLACE FUNCTION public.update_review_helpful_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.product_reviews
    SET
      helpful_count = (SELECT COUNT(*) FROM public.review_votes WHERE review_id = OLD.review_id AND is_helpful = true),
      not_helpful_count = (SELECT COUNT(*) FROM public.review_votes WHERE review_id = OLD.review_id AND is_helpful = false),
      updated_at = NOW()
    WHERE id = OLD.review_id;
    RETURN OLD;
  ELSE
    UPDATE public.product_reviews
    SET
      helpful_count = (SELECT COUNT(*) FROM public.review_votes WHERE review_id = NEW.review_id AND is_helpful = true),
      not_helpful_count = (SELECT COUNT(*) FROM public.review_votes WHERE review_id = NEW.review_id AND is_helpful = false),
      updated_at = NOW()
    WHERE id = NEW.review_id;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_review_helpful_counts_on_vote
  AFTER INSERT OR UPDATE OR DELETE ON public.review_votes
  FOR EACH ROW EXECUTE FUNCTION public.update_review_helpful_counts();

-- Update timestamps
CREATE TRIGGER update_product_reviews_updated_at
  BEFORE UPDATE ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_wishlists_updated_at
  BEFORE UPDATE ON public.wishlists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_flash_deals_updated_at
  BEFORE UPDATE ON public.flash_deals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Check if user has purchased a product
CREATE OR REPLACE FUNCTION public.has_purchased_product(p_user_id UUID, p_product_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    WHERE o.user_id = p_user_id
      AND oi.product_id = p_product_id
      AND o.payment_status = 'paid'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get active deal for a product
CREATE OR REPLACE FUNCTION public.get_active_deal(p_product_id UUID)
RETURNS TABLE (
  id UUID,
  deal_price_pence INT,
  discount_percentage INT,
  ends_at TIMESTAMPTZ,
  max_quantity INT,
  claimed_quantity INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fd.id,
    fd.deal_price_pence,
    fd.discount_percentage,
    fd.ends_at,
    fd.max_quantity,
    fd.claimed_quantity
  FROM public.flash_deals fd
  WHERE fd.product_id = p_product_id
    AND fd.is_active = true
    AND fd.starts_at <= NOW()
    AND fd.ends_at >= NOW()
    AND (fd.max_quantity IS NULL OR fd.claimed_quantity < fd.max_quantity)
  ORDER BY fd.ends_at ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;



-- ================================================================
-- MIGRATION: 00009_coupons_system.sql
-- ================================================================

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



-- ================================================================
-- MIGRATION: 00010_referral_system.sql
-- ================================================================

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
INSERT INTO settings (key, value, description)
VALUES
  ('referral_enabled', 'true', 'Enable/disable referral program'),
  ('referral_reward_referrer', '500', 'Reward for referrer in pence'),
  ('referral_reward_referee', '500', 'Reward for new user in pence'),
  ('referral_min_order', '2000', 'Minimum order value for referral to qualify in pence')
ON CONFLICT (key) DO NOTHING;



-- ================================================================
-- MIGRATION: 00010a_profile_enhancements.sql
-- ================================================================

-- =====================================================
-- PROFILE ENHANCEMENTS MIGRATION
-- =====================================================

-- Add avatar_url to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add is_banned to profiles for user moderation
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;

-- Add notification preferences to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "email": {
    "orders": true,
    "promotions": false,
    "newsletter": false
  },
  "sms": {
    "orders": false,
    "delivery": false
  }
}'::jsonb;

-- Index for faster banned user filtering
CREATE INDEX IF NOT EXISTS idx_profiles_is_banned ON public.profiles(is_banned) WHERE is_banned = true;

-- Update role check to include vendor
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('customer', 'vendor', 'admin'));

-- Add admin update policy for profiles
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Add admin delete policy for profiles
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles" ON public.profiles
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );



-- ================================================================
-- MIGRATION: 00011_loyalty_system.sql
-- ================================================================

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



-- ================================================================
-- MIGRATION: 00012_ticket_support_system.sql
-- ================================================================

-- =====================================================
-- TICKET SUPPORT SYSTEM MIGRATION
-- =====================================================

-- Support ticket categories
CREATE TABLE IF NOT EXISTS ticket_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Support tickets
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  category_id UUID REFERENCES ticket_categories(id),
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'awaiting_customer', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  order_id UUID REFERENCES orders(id),
  assigned_to UUID REFERENCES profiles(id),
  guest_email TEXT,
  guest_name TEXT,
  is_read_by_user BOOLEAN DEFAULT TRUE,
  is_read_by_admin BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ticket messages (conversation thread)
CREATE TABLE IF NOT EXISTS ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id),
  sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'agent', 'system')),
  message TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  is_internal BOOLEAN DEFAULT FALSE, -- Internal notes not visible to customer
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Canned responses for agents
CREATE TABLE IF NOT EXISTS canned_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  shortcut TEXT UNIQUE, -- e.g., "/refund" to quickly insert
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ticket tags for organization
CREATE TABLE IF NOT EXISTS ticket_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#6B7280',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction table for ticket-tag relationship
CREATE TABLE IF NOT EXISTS ticket_tag_assignments (
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES ticket_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (ticket_id, tag_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tickets_user ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_created ON support_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id);

-- RLS Policies
ALTER TABLE ticket_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE canned_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_tag_assignments ENABLE ROW LEVEL SECURITY;

-- Anyone can view categories
CREATE POLICY "Anyone can view ticket categories"
  ON ticket_categories FOR SELECT
  USING (is_active = true);

-- Users can view their own tickets
CREATE POLICY "Users can view their tickets"
  ON support_tickets FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vendor')
  ));

-- Users can create tickets
CREATE POLICY "Users can create tickets"
  ON support_tickets FOR INSERT
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Users can update their own tickets (limited)
CREATE POLICY "Users can update their tickets"
  ON support_tickets FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can view messages on their tickets
CREATE POLICY "Users can view ticket messages"
  ON ticket_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets t
      WHERE t.id = ticket_messages.ticket_id
      AND (t.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vendor')
      ))
    )
    AND (is_internal = false OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vendor')
    ))
  );

-- Users can add messages to their tickets
CREATE POLICY "Users can add ticket messages"
  ON ticket_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM support_tickets t
      WHERE t.id = ticket_messages.ticket_id
      AND (t.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vendor')
      ))
    )
  );

-- Admins can manage everything
CREATE POLICY "Admins can manage tickets"
  ON support_tickets FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage ticket messages"
  ON ticket_messages FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage categories"
  ON ticket_categories FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage canned responses"
  ON canned_responses FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can view canned responses"
  ON canned_responses FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vendor')));

CREATE POLICY "Admins can manage tags"
  ON ticket_tags FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Anyone can view tags"
  ON ticket_tags FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage tag assignments"
  ON ticket_tag_assignments FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Insert default categories
INSERT INTO ticket_categories (name, slug, description, icon, sort_order) VALUES
  ('Order Issues', 'order-issues', 'Problems with your orders, deliveries, or refunds', 'package', 1),
  ('Payment & Billing', 'payment-billing', 'Questions about payments, invoices, or charges', 'credit-card', 2),
  ('Account Help', 'account-help', 'Help with your account, password, or profile', 'user', 3),
  ('Product Questions', 'product-questions', 'Questions about products, availability, or quality', 'shopping-bag', 4),
  ('Technical Support', 'technical-support', 'Website issues, app problems, or bugs', 'settings', 5),
  ('Returns & Refunds', 'returns-refunds', 'Return requests and refund inquiries', 'refresh-cw', 6),
  ('Feedback & Suggestions', 'feedback', 'Share your ideas and suggestions', 'message-square', 7),
  ('Other', 'other', 'Other inquiries not listed above', 'help-circle', 8)
ON CONFLICT (slug) DO NOTHING;

-- Insert default tags
INSERT INTO ticket_tags (name, color) VALUES
  ('VIP Customer', '#FFD700'),
  ('Urgent', '#EF4444'),
  ('Refund Requested', '#F97316'),
  ('Technical', '#3B82F6'),
  ('Follow Up', '#8B5CF6'),
  ('Escalated', '#DC2626'),
  ('First Contact', '#10B981')
ON CONFLICT (name) DO NOTHING;

-- Insert default canned responses
INSERT INTO canned_responses (title, content, category, shortcut) VALUES
  ('Greeting', 'Hello! Thank you for contacting UK Grocery Store support. I''m happy to help you today.', 'general', '/hello'),
  ('Request Order Number', 'To better assist you, could you please provide your order number? You can find this in your order confirmation email or in your account under "My Orders".', 'orders', '/ordernumber'),
  ('Refund Processing', 'Your refund has been initiated and will be processed within 3-5 business days. You''ll receive a confirmation email once it''s complete.', 'refunds', '/refundprocess'),
  ('Delivery Delay', 'I apologize for the delay with your delivery. I''m looking into this right now and will provide you with an update shortly.', 'delivery', '/delayapology'),
  ('Password Reset', 'You can reset your password by clicking on "Forgot Password" on the login page. You''ll receive an email with instructions to create a new password.', 'account', '/passwordreset'),
  ('Thank You', 'Thank you for contacting us! If you have any other questions, please don''t hesitate to reach out. Have a great day!', 'closing', '/thanks'),
  ('Escalation Notice', 'I''ve escalated your case to our senior support team. They will review your issue and get back to you within 24 hours.', 'escalation', '/escalate')
ON CONFLICT (shortcut) DO NOTHING;

-- Function to generate ticket number
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_number TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate ticket number: TKT-YYYYMMDD-XXXX
    v_number := 'TKT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
                UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));

    SELECT EXISTS(SELECT 1 FROM support_tickets WHERE ticket_number = v_number) INTO v_exists;

    IF NOT v_exists THEN
      RETURN v_number;
    END IF;
  END LOOP;
END;
$$;

-- Function to create ticket
CREATE OR REPLACE FUNCTION create_support_ticket(
  p_user_id UUID,
  p_category_id UUID,
  p_subject TEXT,
  p_message TEXT,
  p_priority TEXT DEFAULT 'normal',
  p_order_id UUID DEFAULT NULL,
  p_guest_email TEXT DEFAULT NULL,
  p_guest_name TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  ticket_id UUID,
  ticket_number TEXT,
  message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_ticket_id UUID;
  v_ticket_number TEXT;
BEGIN
  -- Generate ticket number
  v_ticket_number := generate_ticket_number();

  -- Create ticket
  INSERT INTO support_tickets (
    ticket_number, user_id, category_id, subject, priority, order_id, guest_email, guest_name
  ) VALUES (
    v_ticket_number, p_user_id, p_category_id, p_subject, p_priority, p_order_id, p_guest_email, p_guest_name
  )
  RETURNING id INTO v_ticket_id;

  -- Add initial message
  INSERT INTO ticket_messages (ticket_id, sender_id, sender_type, message)
  VALUES (v_ticket_id, p_user_id, 'customer', p_message);

  RETURN QUERY SELECT true, v_ticket_id, v_ticket_number, 'Ticket created successfully'::TEXT;
END;
$$;

-- Function to add message to ticket
CREATE OR REPLACE FUNCTION add_ticket_message(
  p_ticket_id UUID,
  p_sender_id UUID,
  p_sender_type TEXT,
  p_message TEXT,
  p_is_internal BOOLEAN DEFAULT FALSE,
  p_attachments JSONB DEFAULT '[]'
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_message_id UUID;
BEGIN
  -- Insert message
  INSERT INTO ticket_messages (ticket_id, sender_id, sender_type, message, is_internal, attachments)
  VALUES (p_ticket_id, p_sender_id, p_sender_type, p_message, p_is_internal, p_attachments)
  RETURNING id INTO v_message_id;

  -- Update ticket status and read flags
  IF p_sender_type = 'customer' THEN
    UPDATE support_tickets
    SET
      status = CASE WHEN status = 'awaiting_customer' THEN 'in_progress' ELSE status END,
      is_read_by_admin = FALSE,
      is_read_by_user = TRUE,
      updated_at = NOW()
    WHERE id = p_ticket_id;
  ELSIF p_sender_type = 'agent' AND NOT p_is_internal THEN
    UPDATE support_tickets
    SET
      status = 'awaiting_customer',
      is_read_by_user = FALSE,
      is_read_by_admin = TRUE,
      updated_at = NOW()
    WHERE id = p_ticket_id;
  ELSE
    UPDATE support_tickets
    SET updated_at = NOW()
    WHERE id = p_ticket_id;
  END IF;

  RETURN v_message_id;
END;
$$;

-- Function to get ticket stats for user
CREATE OR REPLACE FUNCTION get_user_ticket_stats(p_user_id UUID)
RETURNS TABLE (
  total_tickets BIGINT,
  open_tickets BIGINT,
  resolved_tickets BIGINT,
  unread_tickets BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_tickets,
    COUNT(*) FILTER (WHERE status IN ('open', 'in_progress', 'awaiting_customer'))::BIGINT as open_tickets,
    COUNT(*) FILTER (WHERE status IN ('resolved', 'closed'))::BIGINT as resolved_tickets,
    COUNT(*) FILTER (WHERE is_read_by_user = FALSE)::BIGINT as unread_tickets
  FROM support_tickets
  WHERE user_id = p_user_id;
END;
$$;

-- Trigger to update ticket timestamp
CREATE OR REPLACE FUNCTION update_ticket_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();

  -- Set resolved_at when status changes to resolved
  IF NEW.status = 'resolved' AND (OLD.status IS NULL OR OLD.status != 'resolved') THEN
    NEW.resolved_at := NOW();
  END IF;

  -- Set closed_at when status changes to closed
  IF NEW.status = 'closed' AND (OLD.status IS NULL OR OLD.status != 'closed') THEN
    NEW.closed_at := NOW();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_ticket_timestamp ON support_tickets;
CREATE TRIGGER trigger_ticket_timestamp
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_timestamp();



-- ================================================================
-- MIGRATION: 00013_newsletter_system.sql
-- ================================================================

-- =====================================================
-- NEWSLETTER SYSTEM MIGRATION
-- =====================================================

-- Newsletter subscribers
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  first_name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'bounced', 'complained')),
  source TEXT DEFAULT 'website', -- website, checkout, popup, import
  preferences JSONB DEFAULT '{"promotions": true, "new_products": true, "weekly_digest": true}',
  verification_token TEXT,
  verified_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  unsubscribe_reason TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Newsletter campaigns
CREATE TABLE IF NOT EXISTS newsletter_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  preview_text TEXT,
  content_html TEXT NOT NULL,
  content_text TEXT,
  template_id UUID,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled')),
  segment_filter JSONB, -- Filter criteria for targeting
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  total_recipients INT DEFAULT 0,
  sent_count INT DEFAULT 0,
  open_count INT DEFAULT 0,
  click_count INT DEFAULT 0,
  bounce_count INT DEFAULT 0,
  unsubscribe_count INT DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email templates
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  subject TEXT,
  content_html TEXT NOT NULL,
  content_text TEXT,
  variables JSONB DEFAULT '[]', -- Available merge tags
  category TEXT DEFAULT 'general',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaign send logs (for tracking individual sends)
CREATE TABLE IF NOT EXISTS campaign_send_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
  subscriber_id UUID NOT NULL REFERENCES newsletter_subscribers(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed')),
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounce_type TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, subscriber_id)
);

-- Campaign links for click tracking
CREATE TABLE IF NOT EXISTS campaign_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
  original_url TEXT NOT NULL,
  tracking_code TEXT NOT NULL UNIQUE,
  click_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link click logs
CREATE TABLE IF NOT EXISTS link_click_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES campaign_links(id) ON DELETE CASCADE,
  subscriber_id UUID REFERENCES newsletter_subscribers(id) ON DELETE SET NULL,
  ip_address TEXT,
  user_agent TEXT,
  clicked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscribers_email ON newsletter_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_subscribers_status ON newsletter_subscribers(status);
CREATE INDEX IF NOT EXISTS idx_subscribers_user ON newsletter_subscribers(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON newsletter_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled ON newsletter_campaigns(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_send_logs_campaign ON campaign_send_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_send_logs_subscriber ON campaign_send_logs(subscriber_id);

-- RLS Policies
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_send_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_click_logs ENABLE ROW LEVEL SECURITY;

-- Users can view and manage their own subscription
CREATE POLICY "Users can view their subscription"
  ON newsletter_subscribers FOR SELECT
  USING (user_id = auth.uid() OR email = (SELECT email FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update their subscription"
  ON newsletter_subscribers FOR UPDATE
  USING (user_id = auth.uid() OR email = (SELECT email FROM profiles WHERE id = auth.uid()));

-- Public can subscribe
CREATE POLICY "Anyone can subscribe"
  ON newsletter_subscribers FOR INSERT
  WITH CHECK (true);

-- Admins can manage everything
CREATE POLICY "Admins can manage subscribers"
  ON newsletter_subscribers FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage campaigns"
  ON newsletter_campaigns FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage templates"
  ON email_templates FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can view send logs"
  ON campaign_send_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "System can insert send logs"
  ON campaign_send_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can manage links"
  ON campaign_links FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "System can manage link clicks"
  ON link_click_logs FOR ALL
  USING (true);

-- Insert default email templates
INSERT INTO email_templates (name, description, subject, content_html, content_text, variables, category) VALUES
(
  'Welcome Email',
  'Sent to new subscribers',
  'Welcome to UK Grocery Store Newsletter!',
  '<h1>Welcome, {{first_name}}!</h1><p>Thank you for subscribing to our newsletter. You''ll be the first to know about:</p><ul><li>Exclusive deals and discounts</li><li>New product arrivals</li><li>Weekly specials</li></ul><p>Happy shopping!</p><p><a href="{{unsubscribe_url}}">Unsubscribe</a></p>',
  'Welcome, {{first_name}}! Thank you for subscribing. Unsubscribe: {{unsubscribe_url}}',
  '["first_name", "unsubscribe_url"]',
  'transactional'
),
(
  'Weekly Digest',
  'Weekly newsletter with top deals',
  'This Week''s Top Deals at UK Grocery Store',
  '<h1>Hello {{first_name}}!</h1><p>Here are this week''s top deals:</p>{{deals_content}}<p><a href="{{shop_url}}">Shop Now</a></p><p><a href="{{unsubscribe_url}}">Unsubscribe</a></p>',
  'Hello {{first_name}}! Check out this week''s top deals. Shop Now: {{shop_url}} Unsubscribe: {{unsubscribe_url}}',
  '["first_name", "deals_content", "shop_url", "unsubscribe_url"]',
  'marketing'
),
(
  'Flash Sale Alert',
  'Time-sensitive flash sale notification',
  'FLASH SALE: {{discount}}% Off - Limited Time!',
  '<h1>Flash Sale Alert!</h1><p>Hi {{first_name}},</p><p>For the next {{hours}} hours, get <strong>{{discount}}% OFF</strong> on selected items!</p><p><a href="{{sale_url}}">Shop the Sale</a></p><p>Hurry - limited stock available!</p><p><a href="{{unsubscribe_url}}">Unsubscribe</a></p>',
  'Flash Sale! Hi {{first_name}}, get {{discount}}% OFF for the next {{hours}} hours! Shop: {{sale_url}} Unsubscribe: {{unsubscribe_url}}',
  '["first_name", "discount", "hours", "sale_url", "unsubscribe_url"]',
  'marketing'
),
(
  'Order Confirmation',
  'Sent after order is placed',
  'Order Confirmed: #{{order_number}}',
  '<h1>Thank you for your order!</h1><p>Hi {{first_name}},</p><p>Your order <strong>#{{order_number}}</strong> has been confirmed.</p><p>Order Total: £{{order_total}}</p><p><a href="{{order_url}}">View Order Details</a></p>',
  'Order Confirmed! Hi {{first_name}}, your order #{{order_number}} (£{{order_total}}) has been confirmed. View: {{order_url}}',
  '["first_name", "order_number", "order_total", "order_url"]',
  'transactional'
)
ON CONFLICT (name) DO NOTHING;

-- Function to subscribe to newsletter
CREATE OR REPLACE FUNCTION subscribe_to_newsletter(
  p_email TEXT,
  p_first_name TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'website',
  p_preferences JSONB DEFAULT '{"promotions": true, "new_products": true, "weekly_digest": true}',
  p_ip_address TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  subscriber_id UUID
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_subscriber_id UUID;
  v_existing_status TEXT;
  v_user_id UUID;
BEGIN
  -- Check if email already exists
  SELECT id, status INTO v_subscriber_id, v_existing_status
  FROM newsletter_subscribers
  WHERE email = LOWER(TRIM(p_email));

  -- Try to link to user profile
  SELECT id INTO v_user_id FROM profiles WHERE email = LOWER(TRIM(p_email));

  IF v_subscriber_id IS NOT NULL THEN
    -- Already subscribed
    IF v_existing_status = 'active' THEN
      RETURN QUERY SELECT true, 'Already subscribed'::TEXT, v_subscriber_id;
      RETURN;
    END IF;

    -- Resubscribe
    UPDATE newsletter_subscribers
    SET
      status = 'active',
      first_name = COALESCE(p_first_name, first_name),
      preferences = p_preferences,
      unsubscribed_at = NULL,
      unsubscribe_reason = NULL,
      user_id = COALESCE(v_user_id, user_id),
      updated_at = NOW()
    WHERE id = v_subscriber_id;

    RETURN QUERY SELECT true, 'Successfully resubscribed'::TEXT, v_subscriber_id;
    RETURN;
  END IF;

  -- New subscriber
  INSERT INTO newsletter_subscribers (email, first_name, source, preferences, ip_address, user_id, verified_at)
  VALUES (LOWER(TRIM(p_email)), p_first_name, p_source, p_preferences, p_ip_address, v_user_id, NOW())
  RETURNING id INTO v_subscriber_id;

  RETURN QUERY SELECT true, 'Successfully subscribed'::TEXT, v_subscriber_id;
END;
$$;

-- Function to unsubscribe
CREATE OR REPLACE FUNCTION unsubscribe_from_newsletter(
  p_email TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_subscriber_id UUID;
BEGIN
  SELECT id INTO v_subscriber_id
  FROM newsletter_subscribers
  WHERE email = LOWER(TRIM(p_email)) AND status = 'active';

  IF v_subscriber_id IS NULL THEN
    RETURN QUERY SELECT false, 'Email not found or already unsubscribed'::TEXT;
    RETURN;
  END IF;

  UPDATE newsletter_subscribers
  SET
    status = 'unsubscribed',
    unsubscribed_at = NOW(),
    unsubscribe_reason = p_reason,
    updated_at = NOW()
  WHERE id = v_subscriber_id;

  RETURN QUERY SELECT true, 'Successfully unsubscribed'::TEXT;
END;
$$;

-- Function to get subscriber stats
CREATE OR REPLACE FUNCTION get_newsletter_stats()
RETURNS TABLE (
  total_subscribers BIGINT,
  active_subscribers BIGINT,
  unsubscribed BIGINT,
  subscribed_this_month BIGINT,
  unsubscribed_this_month BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_subscribers,
    COUNT(*) FILTER (WHERE status = 'active')::BIGINT as active_subscribers,
    COUNT(*) FILTER (WHERE status = 'unsubscribed')::BIGINT as unsubscribed,
    COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', NOW()) AND status = 'active')::BIGINT as subscribed_this_month,
    COUNT(*) FILTER (WHERE unsubscribed_at >= DATE_TRUNC('month', NOW()))::BIGINT as unsubscribed_this_month
  FROM newsletter_subscribers;
END;
$$;

-- Trigger to update campaign stats
CREATE OR REPLACE FUNCTION update_campaign_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE newsletter_campaigns
  SET
    sent_count = (SELECT COUNT(*) FROM campaign_send_logs WHERE campaign_id = NEW.campaign_id AND status != 'pending'),
    open_count = (SELECT COUNT(*) FROM campaign_send_logs WHERE campaign_id = NEW.campaign_id AND opened_at IS NOT NULL),
    click_count = (SELECT COUNT(*) FROM campaign_send_logs WHERE campaign_id = NEW.campaign_id AND clicked_at IS NOT NULL),
    bounce_count = (SELECT COUNT(*) FROM campaign_send_logs WHERE campaign_id = NEW.campaign_id AND status = 'bounced'),
    unsubscribe_count = (SELECT COUNT(*) FROM campaign_send_logs WHERE campaign_id = NEW.campaign_id AND status = 'unsubscribed')
  WHERE id = NEW.campaign_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_campaign_stats ON campaign_send_logs;
CREATE TRIGGER trigger_update_campaign_stats
  AFTER INSERT OR UPDATE ON campaign_send_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_campaign_stats();



-- ================================================================
-- MIGRATION: 00014_notifications_system.sql
-- ================================================================

-- =====================================================
-- NOTIFICATIONS SYSTEM MIGRATION
-- =====================================================

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'order_placed', 'order_shipped', 'order_delivered', 'order_cancelled',
    'payment_received', 'payment_failed',
    'price_drop', 'back_in_stock', 'low_stock',
    'review_approved', 'review_rejected',
    'points_earned', 'points_redeemed', 'tier_upgrade',
    'referral_signup', 'referral_reward',
    'coupon_expiring', 'new_coupon',
    'flash_deal', 'promotional',
    'ticket_reply', 'ticket_resolved',
    'system'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}', -- Additional data like order_id, product_id, etc.
  action_url TEXT, -- Where to navigate when clicked
  image_url TEXT, -- Optional image for the notification
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  email_order_updates BOOLEAN DEFAULT TRUE,
  email_promotions BOOLEAN DEFAULT TRUE,
  email_price_drops BOOLEAN DEFAULT TRUE,
  email_newsletter BOOLEAN DEFAULT TRUE,
  push_order_updates BOOLEAN DEFAULT TRUE,
  push_promotions BOOLEAN DEFAULT TRUE,
  push_price_drops BOOLEAN DEFAULT TRUE,
  sms_order_updates BOOLEAN DEFAULT FALSE,
  sms_promotions BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Push notification subscriptions (for web push)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

-- RLS Policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view their notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- System can create notifications
CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- Admins can manage all notifications
CREATE POLICY "Admins can manage notifications"
  ON notifications FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Users can manage their preferences
CREATE POLICY "Users can view their preferences"
  ON notification_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their preferences"
  ON notification_preferences FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their preferences"
  ON notification_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can manage their push subscriptions
CREATE POLICY "Users can manage push subscriptions"
  ON push_subscriptions FOR ALL
  USING (user_id = auth.uid());

-- Function to create notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_data JSONB DEFAULT '{}',
  p_action_url TEXT DEFAULT NULL,
  p_image_url TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO notifications (user_id, type, title, message, data, action_url, image_url)
  VALUES (p_user_id, p_type, p_title, p_message, p_data, p_action_url, p_image_url)
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

-- Function to mark notifications as read
CREATE OR REPLACE FUNCTION mark_notifications_read(
  p_user_id UUID,
  p_notification_ids UUID[] DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INT;
BEGIN
  IF p_notification_ids IS NULL THEN
    -- Mark all as read
    UPDATE notifications
    SET is_read = TRUE, read_at = NOW()
    WHERE user_id = p_user_id AND is_read = FALSE;
  ELSE
    -- Mark specific ones as read
    UPDATE notifications
    SET is_read = TRUE, read_at = NOW()
    WHERE user_id = p_user_id AND id = ANY(p_notification_ids) AND is_read = FALSE;
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Function to get unread count
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM notifications
  WHERE user_id = p_user_id AND is_read = FALSE;

  RETURN v_count;
END;
$$;

-- Function to get or create notification preferences
CREATE OR REPLACE FUNCTION get_or_create_notification_preferences(p_user_id UUID)
RETURNS notification_preferences
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefs notification_preferences;
BEGIN
  SELECT * INTO v_prefs FROM notification_preferences WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO notification_preferences (user_id)
    VALUES (p_user_id)
    RETURNING * INTO v_prefs;
  END IF;

  RETURN v_prefs;
END;
$$;

-- Trigger to create notification on order status change
CREATE OR REPLACE FUNCTION notify_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_title TEXT;
  v_message TEXT;
  v_type TEXT;
BEGIN
  -- Only notify if user_id exists
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Determine notification type and message
  IF NEW.status = 'processing' AND (OLD.status IS NULL OR OLD.status = 'pending') THEN
    v_type := 'order_placed';
    v_title := 'Order Confirmed';
    v_message := 'Your order #' || NEW.order_number || ' has been confirmed and is being processed.';
  ELSIF NEW.status = 'shipped' AND OLD.status != 'shipped' THEN
    v_type := 'order_shipped';
    v_title := 'Order Shipped';
    v_message := 'Your order #' || NEW.order_number || ' has been shipped and is on its way!';
  ELSIF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    v_type := 'order_delivered';
    v_title := 'Order Delivered';
    v_message := 'Your order #' || NEW.order_number || ' has been delivered. Enjoy!';
  ELSIF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    v_type := 'order_cancelled';
    v_title := 'Order Cancelled';
    v_message := 'Your order #' || NEW.order_number || ' has been cancelled.';
  ELSE
    RETURN NEW;
  END IF;

  -- Create the notification
  PERFORM create_notification(
    NEW.user_id,
    v_type,
    v_title,
    v_message,
    jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number),
    '/account/orders/' || NEW.id,
    NULL
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_order_status ON orders;
CREATE TRIGGER trigger_notify_order_status
  AFTER INSERT OR UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_order_status_change();

-- Trigger to create notification on points earned
CREATE OR REPLACE FUNCTION notify_points_earned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.type LIKE 'earn_%' AND NEW.points > 0 THEN
    PERFORM create_notification(
      NEW.user_id,
      'points_earned',
      'Points Earned!',
      'You earned ' || NEW.points || ' loyalty points. ' || COALESCE(NEW.description, ''),
      jsonb_build_object('points', NEW.points, 'balance', NEW.balance_after),
      '/account/rewards',
      NULL
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_points_earned ON points_transactions;
CREATE TRIGGER trigger_notify_points_earned
  AFTER INSERT ON points_transactions
  FOR EACH ROW
  EXECUTE FUNCTION notify_points_earned();

-- Trigger to create notification on review status change
CREATE OR REPLACE FUNCTION notify_review_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_product_name TEXT;
BEGIN
  -- Only notify when status changes to approved or rejected
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- Get product name
  SELECT name INTO v_product_name FROM products WHERE id = NEW.product_id;

  IF NEW.status = 'approved' THEN
    PERFORM create_notification(
      NEW.user_id,
      'review_approved',
      'Review Published',
      'Your review for "' || v_product_name || '" has been approved and is now visible.',
      jsonb_build_object('review_id', NEW.id, 'product_id', NEW.product_id),
      '/products/' || NEW.product_id,
      NULL
    );
  ELSIF NEW.status = 'rejected' THEN
    PERFORM create_notification(
      NEW.user_id,
      'review_rejected',
      'Review Not Published',
      'Your review for "' || v_product_name || '" could not be published. Please check our guidelines.',
      jsonb_build_object('review_id', NEW.id, 'product_id', NEW.product_id),
      NULL,
      NULL
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_review_status ON product_reviews;
CREATE TRIGGER trigger_notify_review_status
  AFTER UPDATE OF status ON product_reviews
  FOR EACH ROW
  EXECUTE FUNCTION notify_review_status();



-- ================================================================
-- MIGRATION: 00015_recently_viewed.sql
-- ================================================================

-- =====================================================
-- RECENTLY VIEWED PRODUCTS MIGRATION
-- =====================================================

-- Recently viewed products table
CREATE TABLE IF NOT EXISTS recently_viewed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  view_count INT DEFAULT 1,
  UNIQUE(user_id, product_id)
);

-- Product view history (for analytics - tracks all views including anonymous)
CREATE TABLE IF NOT EXISTS product_view_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  session_id TEXT, -- For tracking anonymous users
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_recently_viewed_user ON recently_viewed(user_id);
CREATE INDEX IF NOT EXISTS idx_recently_viewed_user_time ON recently_viewed(user_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_view_history_product ON product_view_history(product_id);
CREATE INDEX IF NOT EXISTS idx_product_view_history_user ON product_view_history(user_id);
CREATE INDEX IF NOT EXISTS idx_product_view_history_session ON product_view_history(session_id);
CREATE INDEX IF NOT EXISTS idx_product_view_history_time ON product_view_history(viewed_at DESC);

-- RLS Policies
ALTER TABLE recently_viewed ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_view_history ENABLE ROW LEVEL SECURITY;

-- Users can view their own recently viewed
CREATE POLICY "Users can view their recently viewed"
  ON recently_viewed FOR SELECT
  USING (user_id = auth.uid());

-- Users can manage their recently viewed
CREATE POLICY "Users can manage their recently viewed"
  ON recently_viewed FOR ALL
  USING (user_id = auth.uid());

-- System can insert view history
CREATE POLICY "System can insert view history"
  ON product_view_history FOR INSERT
  WITH CHECK (true);

-- Users can view their own view history
CREATE POLICY "Users can view their view history"
  ON product_view_history FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);

-- Admins can view all history
CREATE POLICY "Admins can view all view history"
  ON product_view_history FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Function to track product view
CREATE OR REPLACE FUNCTION track_product_view(
  p_product_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_referrer TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert into view history (for analytics)
  INSERT INTO product_view_history (product_id, user_id, session_id, ip_address, user_agent, referrer)
  VALUES (p_product_id, p_user_id, p_session_id, p_ip_address, p_user_agent, p_referrer);

  -- Update recently viewed for logged-in users
  IF p_user_id IS NOT NULL THEN
    INSERT INTO recently_viewed (user_id, product_id, viewed_at, view_count)
    VALUES (p_user_id, p_product_id, NOW(), 1)
    ON CONFLICT (user_id, product_id)
    DO UPDATE SET
      viewed_at = NOW(),
      view_count = recently_viewed.view_count + 1;
  END IF;

  -- Update product view count (optional - if you have a view_count on products)
  -- UPDATE products SET view_count = COALESCE(view_count, 0) + 1 WHERE id = p_product_id;
END;
$$;

-- Function to get recently viewed products with full product details
CREATE OR REPLACE FUNCTION get_recently_viewed_products(
  p_user_id UUID,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  product_id UUID,
  viewed_at TIMESTAMPTZ,
  view_count INT,
  name TEXT,
  slug TEXT,
  price_pence INT,
  original_price_pence INT,
  image_url TEXT,
  category_name TEXT,
  avg_rating DECIMAL,
  review_count INT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rv.product_id,
    rv.viewed_at,
    rv.view_count,
    p.name,
    p.slug,
    p.price_pence,
    p.original_price_pence,
    p.image_url,
    c.name AS category_name,
    p.avg_rating,
    p.review_count
  FROM recently_viewed rv
  JOIN products p ON p.id = rv.product_id
  LEFT JOIN categories c ON c.id = p.category_id
  WHERE rv.user_id = p_user_id
    AND p.is_active = true
  ORDER BY rv.viewed_at DESC
  LIMIT p_limit;
END;
$$;

-- Function to clear recently viewed
CREATE OR REPLACE FUNCTION clear_recently_viewed(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM recently_viewed WHERE user_id = p_user_id;
END;
$$;

-- Function to get product view stats (for admin analytics)
CREATE OR REPLACE FUNCTION get_product_view_stats(
  p_product_id UUID,
  p_days INT DEFAULT 30
)
RETURNS TABLE (
  total_views BIGINT,
  unique_users BIGINT,
  unique_sessions BIGINT,
  views_by_day JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_start_date TIMESTAMPTZ := NOW() - (p_days || ' days')::INTERVAL;
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) AS total_views,
    COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) AS unique_users,
    COUNT(DISTINCT session_id) AS unique_sessions,
    (
      SELECT jsonb_agg(daily_stats ORDER BY view_date)
      FROM (
        SELECT
          DATE(viewed_at) AS view_date,
          COUNT(*) AS views
        FROM product_view_history
        WHERE product_id = p_product_id
          AND viewed_at >= v_start_date
        GROUP BY DATE(viewed_at)
      ) daily_stats
    ) AS views_by_day
  FROM product_view_history
  WHERE product_id = p_product_id
    AND viewed_at >= v_start_date;
END;
$$;

-- Function to get trending products based on recent views
CREATE OR REPLACE FUNCTION get_trending_products(
  p_limit INT DEFAULT 10,
  p_hours INT DEFAULT 24
)
RETURNS TABLE (
  product_id UUID,
  view_count BIGINT,
  unique_viewers BIGINT,
  name TEXT,
  slug TEXT,
  price_pence INT,
  image_url TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pvh.product_id,
    COUNT(*) AS view_count,
    COUNT(DISTINCT COALESCE(pvh.user_id::TEXT, pvh.session_id)) AS unique_viewers,
    p.name,
    p.slug,
    p.price_pence,
    p.image_url
  FROM product_view_history pvh
  JOIN products p ON p.id = pvh.product_id
  WHERE pvh.viewed_at >= NOW() - (p_hours || ' hours')::INTERVAL
    AND p.is_active = true
  GROUP BY pvh.product_id, p.name, p.slug, p.price_pence, p.image_url
  ORDER BY view_count DESC
  LIMIT p_limit;
END;
$$;



-- ================================================================
-- MIGRATION: 00016_delivery_slots.sql
-- ================================================================

-- =====================================================
-- DELIVERY SLOTS SYSTEM MIGRATION
-- =====================================================

-- Delivery zones
CREATE TABLE IF NOT EXISTS delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  postcodes TEXT[] NOT NULL, -- Array of postcode prefixes (e.g., 'SW1', 'EC1')
  base_fee_pence INT DEFAULT 0,
  free_delivery_threshold_pence INT, -- Order amount for free delivery
  min_order_pence INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Delivery slot templates (recurring weekly schedule)
CREATE TABLE IF NOT EXISTS delivery_slot_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID REFERENCES delivery_zones(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_orders INT DEFAULT 50,
  price_pence INT DEFAULT 0, -- Slot-specific pricing (e.g., premium for peak times)
  is_express BOOLEAN DEFAULT FALSE, -- Same-day/express delivery
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(zone_id, day_of_week, start_time)
);

-- Actual delivery slots (generated from templates)
CREATE TABLE IF NOT EXISTS delivery_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID REFERENCES delivery_zones(id) ON DELETE CASCADE,
  template_id UUID REFERENCES delivery_slot_templates(id) ON DELETE SET NULL,
  delivery_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_orders INT DEFAULT 50,
  booked_orders INT DEFAULT 0,
  price_pence INT DEFAULT 0,
  is_express BOOLEAN DEFAULT FALSE,
  is_available BOOLEAN DEFAULT TRUE,
  cutoff_time TIMESTAMPTZ, -- Time by which order must be placed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(zone_id, delivery_date, start_time)
);

-- Delivery slot reservations (temporary holds during checkout)
CREATE TABLE IF NOT EXISTS delivery_slot_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES delivery_slots(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL, -- For anonymous users
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  reserved_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL, -- Typically 15-30 minutes
  is_converted BOOLEAN DEFAULT FALSE, -- Whether order was placed
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  UNIQUE(slot_id, session_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_delivery_zones_active ON delivery_zones(is_active);
CREATE INDEX IF NOT EXISTS idx_delivery_slot_templates_zone ON delivery_slot_templates(zone_id);
CREATE INDEX IF NOT EXISTS idx_delivery_slots_zone_date ON delivery_slots(zone_id, delivery_date);
CREATE INDEX IF NOT EXISTS idx_delivery_slots_available ON delivery_slots(is_available, delivery_date);
CREATE INDEX IF NOT EXISTS idx_slot_reservations_expires ON delivery_slot_reservations(expires_at);
CREATE INDEX IF NOT EXISTS idx_slot_reservations_session ON delivery_slot_reservations(session_id);

-- RLS Policies
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_slot_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_slot_reservations ENABLE ROW LEVEL SECURITY;

-- Everyone can view active zones
CREATE POLICY "Everyone can view active zones"
  ON delivery_zones FOR SELECT
  USING (is_active = true);

-- Admins can manage zones
CREATE POLICY "Admins can manage zones"
  ON delivery_zones FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Everyone can view slot templates
CREATE POLICY "Everyone can view slot templates"
  ON delivery_slot_templates FOR SELECT
  USING (is_active = true);

-- Admins can manage templates
CREATE POLICY "Admins can manage templates"
  ON delivery_slot_templates FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Everyone can view available slots
CREATE POLICY "Everyone can view available slots"
  ON delivery_slots FOR SELECT
  USING (is_available = true AND delivery_date >= CURRENT_DATE);

-- Admins can manage slots
CREATE POLICY "Admins can manage slots"
  ON delivery_slots FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Users can manage their reservations
CREATE POLICY "Users can manage reservations"
  ON delivery_slot_reservations FOR ALL
  USING (user_id = auth.uid() OR user_id IS NULL);

-- Function to get zone for a postcode
CREATE OR REPLACE FUNCTION get_delivery_zone_for_postcode(p_postcode TEXT)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_zone_id UUID;
  v_prefix TEXT;
BEGIN
  -- Extract postcode prefix (e.g., 'SW1' from 'SW1A 1AA')
  v_prefix := UPPER(TRIM(SPLIT_PART(p_postcode, ' ', 1)));

  -- Also try shorter prefixes
  SELECT id INTO v_zone_id
  FROM delivery_zones
  WHERE is_active = true
    AND (
      v_prefix = ANY(postcodes)
      OR LEFT(v_prefix, 3) = ANY(postcodes)
      OR LEFT(v_prefix, 2) = ANY(postcodes)
    )
  LIMIT 1;

  RETURN v_zone_id;
END;
$$;

-- Function to generate delivery slots from templates
CREATE OR REPLACE FUNCTION generate_delivery_slots(
  p_zone_id UUID,
  p_start_date DATE,
  p_days INT DEFAULT 14
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_template RECORD;
  v_current_date DATE;
  v_count INT := 0;
  v_cutoff TIMESTAMPTZ;
BEGIN
  FOR i IN 0..(p_days - 1) LOOP
    v_current_date := p_start_date + i;

    FOR v_template IN
      SELECT * FROM delivery_slot_templates
      WHERE zone_id = p_zone_id
        AND is_active = true
        AND day_of_week = EXTRACT(DOW FROM v_current_date)
    LOOP
      -- Calculate cutoff (e.g., 2 hours before slot for same-day, 10pm day before for next-day)
      IF v_template.is_express THEN
        v_cutoff := (v_current_date + v_template.start_time)::TIMESTAMPTZ - INTERVAL '2 hours';
      ELSE
        v_cutoff := (v_current_date - INTERVAL '1 day' + TIME '22:00')::TIMESTAMPTZ;
      END IF;

      INSERT INTO delivery_slots (
        zone_id, template_id, delivery_date, start_time, end_time,
        max_orders, price_pence, is_express, is_available, cutoff_time
      )
      VALUES (
        p_zone_id, v_template.id, v_current_date, v_template.start_time, v_template.end_time,
        v_template.max_orders, v_template.price_pence, v_template.is_express, true, v_cutoff
      )
      ON CONFLICT (zone_id, delivery_date, start_time) DO NOTHING;

      v_count := v_count + 1;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Function to get available slots for a zone
CREATE OR REPLACE FUNCTION get_available_delivery_slots(
  p_zone_id UUID,
  p_start_date DATE DEFAULT CURRENT_DATE,
  p_days INT DEFAULT 7
)
RETURNS TABLE (
  slot_id UUID,
  delivery_date DATE,
  start_time TIME,
  end_time TIME,
  price_pence INT,
  is_express BOOLEAN,
  available_capacity INT,
  is_nearly_full BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- First, ensure slots exist for the period
  PERFORM generate_delivery_slots(p_zone_id, p_start_date, p_days);

  RETURN QUERY
  SELECT
    ds.id AS slot_id,
    ds.delivery_date,
    ds.start_time,
    ds.end_time,
    ds.price_pence,
    ds.is_express,
    (ds.max_orders - ds.booked_orders - COALESCE(
      (SELECT COUNT(*) FROM delivery_slot_reservations dsr
       WHERE dsr.slot_id = ds.id
         AND dsr.expires_at > NOW()
         AND dsr.is_converted = false),
      0
    ))::INT AS available_capacity,
    ((ds.max_orders - ds.booked_orders) <= ds.max_orders * 0.2) AS is_nearly_full
  FROM delivery_slots ds
  WHERE ds.zone_id = p_zone_id
    AND ds.delivery_date >= p_start_date
    AND ds.delivery_date < p_start_date + p_days
    AND ds.is_available = true
    AND ds.cutoff_time > NOW()
    AND (ds.max_orders - ds.booked_orders) > 0
  ORDER BY ds.delivery_date, ds.start_time;
END;
$$;

-- Function to reserve a delivery slot
CREATE OR REPLACE FUNCTION reserve_delivery_slot(
  p_slot_id UUID,
  p_session_id TEXT,
  p_user_id UUID DEFAULT NULL,
  p_duration_minutes INT DEFAULT 15
)
RETURNS TABLE (
  success BOOLEAN,
  reservation_id UUID,
  expires_at TIMESTAMPTZ,
  message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_slot RECORD;
  v_available INT;
  v_reservation_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Get slot details with lock
  SELECT * INTO v_slot
  FROM delivery_slots
  WHERE id = p_slot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TIMESTAMPTZ, 'Slot not found';
    RETURN;
  END IF;

  -- Check if slot is still available
  SELECT (v_slot.max_orders - v_slot.booked_orders - COALESCE(
    (SELECT COUNT(*) FROM delivery_slot_reservations
     WHERE slot_id = p_slot_id
       AND expires_at > NOW()
       AND is_converted = false),
    0
  ))::INT INTO v_available;

  IF v_available <= 0 THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TIMESTAMPTZ, 'No capacity available';
    RETURN;
  END IF;

  -- Check cutoff time
  IF v_slot.cutoff_time <= NOW() THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TIMESTAMPTZ, 'Booking deadline has passed';
    RETURN;
  END IF;

  -- Remove existing reservation for this session
  DELETE FROM delivery_slot_reservations
  WHERE session_id = p_session_id
    AND is_converted = false;

  -- Create new reservation
  v_expires_at := NOW() + (p_duration_minutes || ' minutes')::INTERVAL;

  INSERT INTO delivery_slot_reservations (slot_id, session_id, user_id, expires_at)
  VALUES (p_slot_id, p_session_id, p_user_id, v_expires_at)
  RETURNING id INTO v_reservation_id;

  RETURN QUERY SELECT true, v_reservation_id, v_expires_at, 'Slot reserved successfully';
END;
$$;

-- Function to convert reservation to booking (called when order is placed)
CREATE OR REPLACE FUNCTION convert_slot_reservation(
  p_reservation_id UUID,
  p_order_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_reservation RECORD;
BEGIN
  SELECT * INTO v_reservation
  FROM delivery_slot_reservations
  WHERE id = p_reservation_id
    AND is_converted = false
    AND expires_at > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Update reservation
  UPDATE delivery_slot_reservations
  SET is_converted = true, order_id = p_order_id
  WHERE id = p_reservation_id;

  -- Increment booked orders count
  UPDATE delivery_slots
  SET booked_orders = booked_orders + 1
  WHERE id = v_reservation.slot_id;

  RETURN true;
END;
$$;

-- Function to clean up expired reservations
CREATE OR REPLACE FUNCTION cleanup_expired_slot_reservations()
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INT;
BEGIN
  DELETE FROM delivery_slot_reservations
  WHERE expires_at < NOW()
    AND is_converted = false;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Insert default delivery zones (UK major areas)
INSERT INTO delivery_zones (name, postcodes, base_fee_pence, free_delivery_threshold_pence, min_order_pence) VALUES
  ('Central London', ARRAY['EC1', 'EC2', 'EC3', 'EC4', 'WC1', 'WC2', 'W1', 'SW1'], 299, 5000, 1500),
  ('Greater London', ARRAY['E', 'N', 'NW', 'SE', 'SW', 'W'], 399, 6000, 2000),
  ('Birmingham', ARRAY['B1', 'B2', 'B3', 'B4', 'B5'], 349, 5500, 1500),
  ('Manchester', ARRAY['M1', 'M2', 'M3', 'M4'], 349, 5500, 1500),
  ('Leeds', ARRAY['LS1', 'LS2', 'LS3'], 349, 5500, 1500)
ON CONFLICT DO NOTHING;

-- Insert default slot templates for Central London
DO $$
DECLARE
  v_zone_id UUID;
BEGIN
  SELECT id INTO v_zone_id FROM delivery_zones WHERE name = 'Central London' LIMIT 1;

  IF v_zone_id IS NOT NULL THEN
    -- Weekday slots
    FOR day IN 1..5 LOOP
      INSERT INTO delivery_slot_templates (zone_id, day_of_week, start_time, end_time, max_orders, price_pence, is_express) VALUES
        (v_zone_id, day, '08:00', '10:00', 30, 0, false),
        (v_zone_id, day, '10:00', '12:00', 40, 0, false),
        (v_zone_id, day, '12:00', '14:00', 50, 0, false),
        (v_zone_id, day, '14:00', '16:00', 50, 0, false),
        (v_zone_id, day, '16:00', '18:00', 40, 0, false),
        (v_zone_id, day, '18:00', '20:00', 30, 199, false), -- Premium evening slot
        (v_zone_id, day, '20:00', '22:00', 20, 299, false)  -- Premium late slot
      ON CONFLICT DO NOTHING;
    END LOOP;

    -- Weekend slots
    FOR day IN 0..0 LOOP -- Sunday
      INSERT INTO delivery_slot_templates (zone_id, day_of_week, start_time, end_time, max_orders, price_pence, is_express) VALUES
        (v_zone_id, day, '10:00', '12:00', 30, 0, false),
        (v_zone_id, day, '12:00', '14:00', 40, 0, false),
        (v_zone_id, day, '14:00', '16:00', 40, 0, false),
        (v_zone_id, day, '16:00', '18:00', 30, 0, false)
      ON CONFLICT DO NOTHING;
    END LOOP;

    FOR day IN 6..6 LOOP -- Saturday
      INSERT INTO delivery_slot_templates (zone_id, day_of_week, start_time, end_time, max_orders, price_pence, is_express) VALUES
        (v_zone_id, day, '08:00', '10:00', 30, 0, false),
        (v_zone_id, day, '10:00', '12:00', 40, 0, false),
        (v_zone_id, day, '12:00', '14:00', 50, 0, false),
        (v_zone_id, day, '14:00', '16:00', 50, 0, false),
        (v_zone_id, day, '16:00', '18:00', 40, 0, false),
        (v_zone_id, day, '18:00', '20:00', 30, 199, false)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
END $$;



-- ================================================================
-- MIGRATION: 00017_live_chat.sql
-- ================================================================

-- =====================================================
-- LIVE CHAT SYSTEM MIGRATION
-- =====================================================

-- Chat conversations
CREATE TABLE IF NOT EXISTS chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  guest_email TEXT,
  guest_name TEXT,
  session_id TEXT, -- For anonymous users
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'resolved', 'closed')),
  assigned_agent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  department TEXT DEFAULT 'general', -- general, orders, technical, billing
  subject TEXT,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  rating INT CHECK (rating BETWEEN 1 AND 5),
  feedback TEXT,
  metadata JSONB DEFAULT '{}', -- Store page URL, browser info, etc.
  started_at TIMESTAMPTZ DEFAULT NOW(),
  first_response_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  unread_customer INT DEFAULT 0,
  unread_agent INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'agent', 'system', 'bot')),
  sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sender_name TEXT,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'product', 'order', 'quick_reply')),
  attachments JSONB DEFAULT '[]', -- Array of {url, name, type, size}
  metadata JSONB DEFAULT '{}', -- For quick replies, product cards, etc.
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quick reply templates
CREATE TABLE IF NOT EXISTS chat_quick_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  use_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat agents status
CREATE TABLE IF NOT EXISTS chat_agent_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'away', 'busy', 'offline')),
  max_concurrent_chats INT DEFAULT 5,
  current_chat_count INT DEFAULT 0,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  auto_accept BOOLEAN DEFAULT TRUE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user ON chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_session ON chat_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_status ON chat_conversations(status);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_agent ON chat_conversations(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_last_message ON chat_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_agent_status_online ON chat_agent_status(status) WHERE status = 'online';

-- Enable RLS
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_quick_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_agent_status ENABLE ROW LEVEL SECURITY;

-- Customers can view their own conversations
CREATE POLICY "Customers can view their conversations"
  ON chat_conversations FOR SELECT
  USING (user_id = auth.uid() OR session_id IS NOT NULL);

-- Customers can create conversations
CREATE POLICY "Anyone can create conversations"
  ON chat_conversations FOR INSERT
  WITH CHECK (true);

-- Customers can update their own conversations (for rating/feedback)
CREATE POLICY "Customers can update their conversations"
  ON chat_conversations FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Agents/Admins can manage all conversations
CREATE POLICY "Agents can manage conversations"
  ON chat_conversations FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'vendor')
  ));

-- Customers can view messages in their conversations
CREATE POLICY "Customers can view their messages"
  ON chat_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM chat_conversations
    WHERE id = conversation_id
    AND (user_id = auth.uid() OR session_id IS NOT NULL)
  ));

-- Anyone can send messages (we'll validate in the API)
CREATE POLICY "Anyone can send messages"
  ON chat_messages FOR INSERT
  WITH CHECK (true);

-- Agents can manage all messages
CREATE POLICY "Agents can manage messages"
  ON chat_messages FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'vendor')
  ));

-- Everyone can view quick replies
CREATE POLICY "Everyone can view quick replies"
  ON chat_quick_replies FOR SELECT
  USING (is_active = true);

-- Admins can manage quick replies
CREATE POLICY "Admins can manage quick replies"
  ON chat_quick_replies FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Agents can manage their own status
CREATE POLICY "Agents can manage their status"
  ON chat_agent_status FOR ALL
  USING (agent_id = auth.uid());

-- Everyone can view agent availability
CREATE POLICY "Everyone can view agent status"
  ON chat_agent_status FOR SELECT
  USING (true);

-- Function to start a chat conversation
CREATE OR REPLACE FUNCTION start_chat_conversation(
  p_user_id UUID DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL,
  p_guest_name TEXT DEFAULT NULL,
  p_guest_email TEXT DEFAULT NULL,
  p_subject TEXT DEFAULT NULL,
  p_department TEXT DEFAULT 'general',
  p_initial_message TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS TABLE (
  conversation_id UUID,
  message_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conversation_id UUID;
  v_message_id UUID;
  v_available_agent_id UUID;
BEGIN
  -- Find an available agent
  SELECT agent_id INTO v_available_agent_id
  FROM chat_agent_status
  WHERE status = 'online'
    AND auto_accept = true
    AND current_chat_count < max_concurrent_chats
  ORDER BY current_chat_count ASC, last_activity_at DESC
  LIMIT 1;

  -- Create conversation
  INSERT INTO chat_conversations (
    user_id, session_id, guest_name, guest_email,
    subject, department, metadata,
    assigned_agent_id, status
  )
  VALUES (
    p_user_id, p_session_id, p_guest_name, p_guest_email,
    p_subject, p_department, p_metadata,
    v_available_agent_id,
    CASE WHEN v_available_agent_id IS NOT NULL THEN 'active' ELSE 'waiting' END
  )
  RETURNING id INTO v_conversation_id;

  -- Update agent chat count if assigned
  IF v_available_agent_id IS NOT NULL THEN
    UPDATE chat_agent_status
    SET current_chat_count = current_chat_count + 1,
        last_activity_at = NOW()
    WHERE agent_id = v_available_agent_id;
  END IF;

  -- Add initial message if provided
  IF p_initial_message IS NOT NULL AND p_initial_message != '' THEN
    INSERT INTO chat_messages (
      conversation_id, sender_type, sender_id, sender_name, content
    )
    VALUES (
      v_conversation_id,
      'customer',
      p_user_id,
      COALESCE(p_guest_name, 'Customer'),
      p_initial_message
    )
    RETURNING id INTO v_message_id;
  END IF;

  -- Add system message if no agent available
  IF v_available_agent_id IS NULL THEN
    INSERT INTO chat_messages (
      conversation_id, sender_type, content
    )
    VALUES (
      v_conversation_id,
      'system',
      'Thank you for contacting us. All our agents are currently busy. You''ll be connected to the next available agent shortly.'
    );
  ELSE
    INSERT INTO chat_messages (
      conversation_id, sender_type, content
    )
    VALUES (
      v_conversation_id,
      'system',
      'You''re now connected with our support team. How can we help you today?'
    );
  END IF;

  RETURN QUERY SELECT v_conversation_id, v_message_id;
END;
$$;

-- Function to send a chat message
CREATE OR REPLACE FUNCTION send_chat_message(
  p_conversation_id UUID,
  p_sender_type TEXT,
  p_sender_id UUID DEFAULT NULL,
  p_sender_name TEXT DEFAULT NULL,
  p_content TEXT DEFAULT NULL,
  p_message_type TEXT DEFAULT 'text',
  p_attachments JSONB DEFAULT '[]',
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message_id UUID;
  v_conversation RECORD;
BEGIN
  -- Get conversation
  SELECT * INTO v_conversation
  FROM chat_conversations
  WHERE id = p_conversation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;

  -- Insert message
  INSERT INTO chat_messages (
    conversation_id, sender_type, sender_id, sender_name,
    content, message_type, attachments, metadata
  )
  VALUES (
    p_conversation_id, p_sender_type, p_sender_id, p_sender_name,
    p_content, p_message_type, p_attachments, p_metadata
  )
  RETURNING id INTO v_message_id;

  -- Update conversation
  UPDATE chat_conversations
  SET last_message_at = NOW(),
      unread_customer = CASE WHEN p_sender_type = 'agent' THEN unread_customer + 1 ELSE unread_customer END,
      unread_agent = CASE WHEN p_sender_type = 'customer' THEN unread_agent + 1 ELSE unread_agent END,
      first_response_at = CASE
        WHEN first_response_at IS NULL AND p_sender_type = 'agent' THEN NOW()
        ELSE first_response_at
      END
  WHERE id = p_conversation_id;

  RETURN v_message_id;
END;
$$;

-- Function to resolve/close conversation
CREATE OR REPLACE FUNCTION close_chat_conversation(
  p_conversation_id UUID,
  p_status TEXT DEFAULT 'resolved',
  p_rating INT DEFAULT NULL,
  p_feedback TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_conversation RECORD;
BEGIN
  SELECT * INTO v_conversation
  FROM chat_conversations
  WHERE id = p_conversation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Update conversation
  UPDATE chat_conversations
  SET status = p_status,
      rating = COALESCE(p_rating, rating),
      feedback = COALESCE(p_feedback, feedback),
      resolved_at = CASE WHEN p_status = 'resolved' THEN NOW() ELSE resolved_at END,
      closed_at = NOW()
  WHERE id = p_conversation_id;

  -- Decrement agent chat count
  IF v_conversation.assigned_agent_id IS NOT NULL THEN
    UPDATE chat_agent_status
    SET current_chat_count = GREATEST(0, current_chat_count - 1)
    WHERE agent_id = v_conversation.assigned_agent_id;
  END IF;

  -- Add system message
  INSERT INTO chat_messages (conversation_id, sender_type, content)
  VALUES (p_conversation_id, 'system',
    CASE p_status
      WHEN 'resolved' THEN 'This conversation has been resolved. Thank you for contacting us!'
      ELSE 'This conversation has been closed.'
    END
  );

  RETURN true;
END;
$$;

-- Function to check agent availability
CREATE OR REPLACE FUNCTION check_chat_availability()
RETURNS TABLE (
  is_available BOOLEAN,
  estimated_wait_minutes INT,
  available_agents INT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_available_count INT;
  v_waiting_count INT;
BEGIN
  SELECT COUNT(*) INTO v_available_count
  FROM chat_agent_status
  WHERE status = 'online'
    AND current_chat_count < max_concurrent_chats;

  SELECT COUNT(*) INTO v_waiting_count
  FROM chat_conversations
  WHERE status = 'waiting';

  RETURN QUERY SELECT
    v_available_count > 0,
    CASE
      WHEN v_available_count > 0 THEN 0
      ELSE GREATEST(1, v_waiting_count * 5) -- Estimate 5 min per waiting chat
    END,
    v_available_count;
END;
$$;

-- Insert default quick replies
INSERT INTO chat_quick_replies (category, title, content) VALUES
  ('greeting', 'Welcome', 'Hello! Welcome to FreshMart support. How can I help you today?'),
  ('greeting', 'Returning customer', 'Welcome back! I''d be happy to assist you. What can I help you with?'),
  ('orders', 'Order status', 'I can help you check your order status. Could you please provide your order number?'),
  ('orders', 'Delivery update', 'Let me check the delivery status for you. One moment please...'),
  ('orders', 'Refund process', 'I understand you''d like a refund. I''ll help you with that. Could you please tell me which order this is regarding?'),
  ('products', 'Stock inquiry', 'Let me check the stock availability for you. Which product are you interested in?'),
  ('products', 'Price match', 'We''re happy to look into price matching. Could you share where you saw the lower price?'),
  ('technical', 'Website issue', 'I''m sorry to hear you''re experiencing issues with our website. Could you describe what''s happening?'),
  ('closing', 'Thank you', 'Thank you for contacting FreshMart support. Is there anything else I can help you with?'),
  ('closing', 'Resolved', 'I''m glad I could help! If you have any other questions, feel free to reach out. Have a great day!')
ON CONFLICT DO NOTHING;



-- ================================================================
-- MIGRATION: 00018_chatbot_system.sql
-- ================================================================

-- =====================================================
-- AI CHATBOT SYSTEM MIGRATION
-- =====================================================

-- Chatbot intents and responses
CREATE TABLE IF NOT EXISTS chatbot_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  priority INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Training phrases for intent matching
CREATE TABLE IF NOT EXISTS chatbot_training_phrases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id UUID NOT NULL REFERENCES chatbot_intents(id) ON DELETE CASCADE,
  phrase TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Responses for each intent
CREATE TABLE IF NOT EXISTS chatbot_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id UUID NOT NULL REFERENCES chatbot_intents(id) ON DELETE CASCADE,
  response_text TEXT NOT NULL,
  response_type TEXT DEFAULT 'text' CHECK (response_type IN ('text', 'quick_reply', 'card', 'carousel')),
  quick_replies JSONB DEFAULT '[]', -- Array of {text, value}
  card_data JSONB DEFAULT '{}', -- For product cards, order info, etc.
  follow_up_intent TEXT, -- Next intent to suggest
  priority INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chatbot conversation context
CREATE TABLE IF NOT EXISTS chatbot_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE,
  session_id TEXT,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  current_intent TEXT,
  context JSONB DEFAULT '{}', -- Store order_id, product_id, etc.
  is_bot_active BOOLEAN DEFAULT TRUE,
  handoff_requested BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chatbot FAQ for quick matching
CREATE TABLE IF NOT EXISTS chatbot_faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  keywords TEXT[], -- For search matching
  view_count INT DEFAULT 0,
  helpful_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chatbot settings
CREATE TABLE IF NOT EXISTS chatbot_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chatbot_training_intent ON chatbot_training_phrases(intent_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_responses_intent ON chatbot_responses(intent_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_conversations_session ON chatbot_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_faqs_category ON chatbot_faqs(category);
CREATE INDEX IF NOT EXISTS idx_chatbot_faqs_keywords ON chatbot_faqs USING GIN(keywords);

-- Enable RLS
ALTER TABLE chatbot_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_training_phrases ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_settings ENABLE ROW LEVEL SECURITY;

-- Public read for intents and FAQs (bot needs to access)
CREATE POLICY "Public read chatbot intents"
  ON chatbot_intents FOR SELECT USING (is_active = true);

CREATE POLICY "Public read training phrases"
  ON chatbot_training_phrases FOR SELECT USING (true);

CREATE POLICY "Public read chatbot responses"
  ON chatbot_responses FOR SELECT USING (is_active = true);

CREATE POLICY "Public read chatbot FAQs"
  ON chatbot_faqs FOR SELECT USING (is_active = true);

CREATE POLICY "Public read chatbot settings"
  ON chatbot_settings FOR SELECT USING (true);

-- Anyone can create/update their conversation context
CREATE POLICY "Users can manage their bot conversations"
  ON chatbot_conversations FOR ALL USING (true);

-- Admins can manage everything
CREATE POLICY "Admins manage chatbot intents"
  ON chatbot_intents FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins manage training phrases"
  ON chatbot_training_phrases FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins manage chatbot responses"
  ON chatbot_responses FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins manage chatbot FAQs"
  ON chatbot_faqs FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins manage chatbot settings"
  ON chatbot_settings FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Function to find best matching intent
CREATE OR REPLACE FUNCTION match_chatbot_intent(p_message TEXT)
RETURNS TABLE (
  intent_name TEXT,
  confidence FLOAT,
  response_text TEXT,
  response_type TEXT,
  quick_replies JSONB,
  card_data JSONB,
  follow_up_intent TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_message_lower TEXT;
  v_words TEXT[];
BEGIN
  v_message_lower := LOWER(TRIM(p_message));
  v_words := regexp_split_to_array(v_message_lower, '\s+');

  RETURN QUERY
  WITH intent_scores AS (
    SELECT
      i.name AS intent_name,
      -- Calculate confidence based on phrase matching
      MAX(
        CASE
          WHEN v_message_lower = LOWER(tp.phrase) THEN 1.0
          WHEN v_message_lower LIKE '%' || LOWER(tp.phrase) || '%' THEN 0.9
          WHEN LOWER(tp.phrase) LIKE '%' || v_message_lower || '%' THEN 0.8
          ELSE (
            -- Word overlap score
            (SELECT COUNT(*)::FLOAT FROM unnest(v_words) w
             WHERE LOWER(tp.phrase) LIKE '%' || w || '%') /
            GREATEST(array_length(v_words, 1), 1)::FLOAT * 0.7
          )
        END
      ) AS confidence,
      i.priority
    FROM chatbot_intents i
    JOIN chatbot_training_phrases tp ON tp.intent_id = i.id
    WHERE i.is_active = true
    GROUP BY i.name, i.priority
    HAVING MAX(
      CASE
        WHEN v_message_lower = LOWER(tp.phrase) THEN 1.0
        WHEN v_message_lower LIKE '%' || LOWER(tp.phrase) || '%' THEN 0.9
        WHEN LOWER(tp.phrase) LIKE '%' || v_message_lower || '%' THEN 0.8
        ELSE (
          (SELECT COUNT(*)::FLOAT FROM unnest(v_words) w
           WHERE LOWER(tp.phrase) LIKE '%' || w || '%') /
          GREATEST(array_length(v_words, 1), 1)::FLOAT * 0.7
        )
      END
    ) >= 0.3
  )
  SELECT
    s.intent_name,
    s.confidence,
    r.response_text,
    r.response_type,
    r.quick_replies,
    r.card_data,
    r.follow_up_intent
  FROM intent_scores s
  JOIN chatbot_intents i ON i.name = s.intent_name
  JOIN chatbot_responses r ON r.intent_id = i.id AND r.is_active = true
  ORDER BY s.confidence DESC, s.priority DESC, r.priority DESC
  LIMIT 1;
END;
$$;

-- Function to search FAQs
CREATE OR REPLACE FUNCTION search_chatbot_faqs(p_query TEXT, p_limit INT DEFAULT 5)
RETURNS TABLE (
  id UUID,
  question TEXT,
  answer TEXT,
  category TEXT,
  relevance FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_query_lower TEXT;
  v_words TEXT[];
BEGIN
  v_query_lower := LOWER(TRIM(p_query));
  v_words := regexp_split_to_array(v_query_lower, '\s+');

  RETURN QUERY
  SELECT
    f.id,
    f.question,
    f.answer,
    f.category,
    -- Calculate relevance
    GREATEST(
      CASE WHEN LOWER(f.question) LIKE '%' || v_query_lower || '%' THEN 0.9 ELSE 0 END,
      CASE WHEN LOWER(f.answer) LIKE '%' || v_query_lower || '%' THEN 0.7 ELSE 0 END,
      (SELECT COUNT(*)::FLOAT FROM unnest(v_words) w
       WHERE LOWER(f.question) LIKE '%' || w || '%' OR w = ANY(f.keywords)) /
      GREATEST(array_length(v_words, 1), 1)::FLOAT * 0.8
    ) AS relevance
  FROM chatbot_faqs f
  WHERE f.is_active = true
    AND (
      LOWER(f.question) LIKE '%' || v_query_lower || '%'
      OR LOWER(f.answer) LIKE '%' || v_query_lower || '%'
      OR EXISTS (SELECT 1 FROM unnest(v_words) w WHERE w = ANY(f.keywords))
      OR EXISTS (SELECT 1 FROM unnest(v_words) w WHERE LOWER(f.question) LIKE '%' || w || '%')
    )
  ORDER BY relevance DESC, f.view_count DESC, f.sort_order ASC
  LIMIT p_limit;
END;
$$;

-- Insert default intents and responses
INSERT INTO chatbot_intents (name, description, priority) VALUES
  ('greeting', 'User greets the bot', 100),
  ('goodbye', 'User says goodbye', 90),
  ('order_status', 'User asks about order status', 85),
  ('track_order', 'User wants to track an order', 85),
  ('delivery_info', 'Questions about delivery', 80),
  ('return_policy', 'Questions about returns', 80),
  ('refund_status', 'Questions about refunds', 80),
  ('product_availability', 'Check if product is available', 75),
  ('payment_methods', 'Questions about payment options', 70),
  ('contact_human', 'User wants to speak to a human', 95),
  ('hours_operation', 'Store hours and availability', 60),
  ('shipping_cost', 'Questions about delivery fees', 70),
  ('cancel_order', 'User wants to cancel order', 85),
  ('account_help', 'Account related questions', 65),
  ('promotions', 'Questions about deals and offers', 60),
  ('complaint', 'User has a complaint', 90),
  ('thanks', 'User says thank you', 50),
  ('fallback', 'No intent matched', 0)
ON CONFLICT (name) DO NOTHING;

-- Insert training phrases
INSERT INTO chatbot_training_phrases (intent_id, phrase)
SELECT id, phrase FROM chatbot_intents, unnest(ARRAY[
  'hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'hi there', 'hey there'
]) AS phrase WHERE name = 'greeting';

INSERT INTO chatbot_training_phrases (intent_id, phrase)
SELECT id, phrase FROM chatbot_intents, unnest(ARRAY[
  'bye', 'goodbye', 'see you', 'thanks bye', 'that''s all', 'nothing else', 'i''m done'
]) AS phrase WHERE name = 'goodbye';

INSERT INTO chatbot_training_phrases (intent_id, phrase)
SELECT id, phrase FROM chatbot_intents, unnest(ARRAY[
  'where is my order', 'order status', 'check my order', 'what happened to my order',
  'when will my order arrive', 'order update', 'my order', 'status of my order'
]) AS phrase WHERE name = 'order_status';

INSERT INTO chatbot_training_phrases (intent_id, phrase)
SELECT id, phrase FROM chatbot_intents, unnest(ARRAY[
  'track order', 'track my order', 'tracking number', 'track delivery', 'where is my delivery',
  'delivery tracking', 'track package', 'order tracking'
]) AS phrase WHERE name = 'track_order';

INSERT INTO chatbot_training_phrases (intent_id, phrase)
SELECT id, phrase FROM chatbot_intents, unnest(ARRAY[
  'delivery', 'when will it arrive', 'delivery time', 'delivery date', 'how long for delivery',
  'delivery options', 'same day delivery', 'next day delivery', 'delivery slots'
]) AS phrase WHERE name = 'delivery_info';

INSERT INTO chatbot_training_phrases (intent_id, phrase)
SELECT id, phrase FROM chatbot_intents, unnest(ARRAY[
  'return', 'return policy', 'how to return', 'can i return', 'return item',
  'send back', 'exchange', 'return process', 'returns'
]) AS phrase WHERE name = 'return_policy';

INSERT INTO chatbot_training_phrases (intent_id, phrase)
SELECT id, phrase FROM chatbot_intents, unnest(ARRAY[
  'refund', 'refund status', 'where is my refund', 'when will i get refund', 'money back',
  'get my money back', 'refund process', 'refund time'
]) AS phrase WHERE name = 'refund_status';

INSERT INTO chatbot_training_phrases (intent_id, phrase)
SELECT id, phrase FROM chatbot_intents, unnest(ARRAY[
  'in stock', 'available', 'do you have', 'is it available', 'stock',
  'out of stock', 'back in stock', 'availability'
]) AS phrase WHERE name = 'product_availability';

INSERT INTO chatbot_training_phrases (intent_id, phrase)
SELECT id, phrase FROM chatbot_intents, unnest(ARRAY[
  'payment', 'payment methods', 'how to pay', 'can i pay with', 'accept card',
  'credit card', 'debit card', 'apple pay', 'google pay', 'paypal'
]) AS phrase WHERE name = 'payment_methods';

INSERT INTO chatbot_training_phrases (intent_id, phrase)
SELECT id, phrase FROM chatbot_intents, unnest(ARRAY[
  'speak to human', 'talk to agent', 'real person', 'human agent', 'speak to someone',
  'talk to someone', 'customer service', 'agent please', 'transfer to agent', 'live agent'
]) AS phrase WHERE name = 'contact_human';

INSERT INTO chatbot_training_phrases (intent_id, phrase)
SELECT id, phrase FROM chatbot_intents, unnest(ARRAY[
  'opening hours', 'store hours', 'when are you open', 'business hours', 'working hours',
  'what time', 'hours of operation', 'open today'
]) AS phrase WHERE name = 'hours_operation';

INSERT INTO chatbot_training_phrases (intent_id, phrase)
SELECT id, phrase FROM chatbot_intents, unnest(ARRAY[
  'shipping cost', 'delivery fee', 'how much for delivery', 'delivery charge',
  'free delivery', 'shipping fee', 'delivery price', 'cost of delivery'
]) AS phrase WHERE name = 'shipping_cost';

INSERT INTO chatbot_training_phrases (intent_id, phrase)
SELECT id, phrase FROM chatbot_intents, unnest(ARRAY[
  'cancel order', 'cancel my order', 'want to cancel', 'stop my order',
  'don''t want order', 'cancellation', 'how to cancel'
]) AS phrase WHERE name = 'cancel_order';

INSERT INTO chatbot_training_phrases (intent_id, phrase)
SELECT id, phrase FROM chatbot_intents, unnest(ARRAY[
  'account', 'my account', 'login problem', 'can''t login', 'password reset',
  'forgot password', 'account issue', 'sign in', 'register'
]) AS phrase WHERE name = 'account_help';

INSERT INTO chatbot_training_phrases (intent_id, phrase)
SELECT id, phrase FROM chatbot_intents, unnest(ARRAY[
  'deals', 'offers', 'discount', 'promo code', 'coupon', 'sale',
  'promotions', 'special offers', 'discount code'
]) AS phrase WHERE name = 'promotions';

INSERT INTO chatbot_training_phrases (intent_id, phrase)
SELECT id, phrase FROM chatbot_intents, unnest(ARRAY[
  'complaint', 'not happy', 'disappointed', 'problem with order', 'issue',
  'terrible service', 'bad experience', 'wrong item', 'damaged'
]) AS phrase WHERE name = 'complaint';

INSERT INTO chatbot_training_phrases (intent_id, phrase)
SELECT id, phrase FROM chatbot_intents, unnest(ARRAY[
  'thank you', 'thanks', 'cheers', 'appreciate it', 'thank u', 'ty'
]) AS phrase WHERE name = 'thanks';

-- Insert responses
INSERT INTO chatbot_responses (intent_id, response_text, response_type, quick_replies) VALUES
-- Greeting
((SELECT id FROM chatbot_intents WHERE name = 'greeting'),
 'Hello! Welcome to FreshMart. I''m your virtual assistant. How can I help you today?',
 'quick_reply',
 '[{"text": "Track my order", "value": "track_order"}, {"text": "Delivery info", "value": "delivery_info"}, {"text": "Talk to agent", "value": "contact_human"}]'),

-- Goodbye
((SELECT id FROM chatbot_intents WHERE name = 'goodbye'),
 'Thank you for chatting with us! Have a great day. If you need anything else, I''m always here to help.',
 'text', '[]'),

-- Order Status
((SELECT id FROM chatbot_intents WHERE name = 'order_status'),
 'I can help you check your order status! Please provide your order number (e.g., ORD-XXXXX) or the email address used for your order.',
 'quick_reply',
 '[{"text": "Track with order number", "value": "track_order"}, {"text": "Talk to agent", "value": "contact_human"}]'),

-- Track Order
((SELECT id FROM chatbot_intents WHERE name = 'track_order'),
 'To track your order, please visit our order tracking page or provide your order number here. You can find your order number in your confirmation email.',
 'quick_reply',
 '[{"text": "Go to tracking page", "value": "link:/track-order"}, {"text": "I have my order number", "value": "order_status"}]'),

-- Delivery Info
((SELECT id FROM chatbot_intents WHERE name = 'delivery_info'),
 'We offer flexible delivery options:\n\n• **Same Day Delivery** - Order before 2pm for delivery today (select areas)\n• **Next Day Delivery** - Order before midnight\n• **Choose Your Slot** - Pick a 2-hour window that suits you\n\nDelivery is FREE on orders over £50!',
 'quick_reply',
 '[{"text": "Delivery fees", "value": "shipping_cost"}, {"text": "Track my order", "value": "track_order"}]'),

-- Return Policy
((SELECT id FROM chatbot_intents WHERE name = 'return_policy'),
 'Our returns policy:\n\n• **Fresh products**: Report within 24 hours of delivery\n• **Non-perishables**: Return within 14 days unopened\n• **Damaged items**: Full refund or replacement\n\nTo start a return, go to your order in My Account or contact our team.',
 'quick_reply',
 '[{"text": "Start a return", "value": "link:/account/orders"}, {"text": "Talk to agent", "value": "contact_human"}]'),

-- Refund Status
((SELECT id FROM chatbot_intents WHERE name = 'refund_status'),
 'Refunds are typically processed within 3-5 business days after we receive the returned item. The money will appear in your account within 5-10 business days depending on your bank.\n\nWould you like me to connect you with an agent to check a specific refund?',
 'quick_reply',
 '[{"text": "Yes, check my refund", "value": "contact_human"}, {"text": "That answers my question", "value": "thanks"}]'),

-- Product Availability
((SELECT id FROM chatbot_intents WHERE name = 'product_availability'),
 'You can check product availability by searching on our website. If an item shows "Out of Stock", you can click "Notify Me" to get an alert when it''s back!\n\nIs there a specific product you''re looking for?',
 'quick_reply',
 '[{"text": "Browse products", "value": "link:/products"}, {"text": "Talk to agent", "value": "contact_human"}]'),

-- Payment Methods
((SELECT id FROM chatbot_intents WHERE name = 'payment_methods'),
 'We accept the following payment methods:\n\n• Credit & Debit Cards (Visa, Mastercard, Amex)\n• Apple Pay\n• Google Pay\n• PayPal\n\nAll payments are secure and encrypted.',
 'text', '[]'),

-- Contact Human
((SELECT id FROM chatbot_intents WHERE name = 'contact_human'),
 'I''ll connect you with a customer service agent right away. Please hold on while I transfer you...',
 'text', '[]'),

-- Hours of Operation
((SELECT id FROM chatbot_intents WHERE name = 'hours_operation'),
 'Our customer service is available:\n\n• **Live Chat**: 24/7\n• **Phone**: Mon-Sat 8am-8pm, Sun 10am-6pm\n• **Email**: Response within 24 hours\n\nDelivery slots are available 7 days a week, 7am-10pm.',
 'text', '[]'),

-- Shipping Cost
((SELECT id FROM chatbot_intents WHERE name = 'shipping_cost'),
 'Delivery fees:\n\n• Orders over £50: **FREE**\n• Standard delivery: £3.99\n• Express same-day: £5.99\n\nSome areas may have different rates. Enter your postcode at checkout to see exact fees.',
 'quick_reply',
 '[{"text": "Check my postcode", "value": "link:/checkout"}, {"text": "More delivery info", "value": "delivery_info"}]'),

-- Cancel Order
((SELECT id FROM chatbot_intents WHERE name = 'cancel_order'),
 'To cancel an order:\n\n1. Go to **My Account > Orders**\n2. Find your order and click **Cancel**\n\n⚠️ Orders can only be cancelled before they''re dispatched. If your order is already out for delivery, please refuse the delivery or contact us.',
 'quick_reply',
 '[{"text": "Go to my orders", "value": "link:/account/orders"}, {"text": "Talk to agent", "value": "contact_human"}]'),

-- Account Help
((SELECT id FROM chatbot_intents WHERE name = 'account_help'),
 'I can help with account issues!\n\n• **Forgot password?** Click "Forgot Password" on the login page\n• **Can''t login?** Try clearing your browser cache\n• **Update details?** Go to My Account > Settings\n\nWhat specific help do you need?',
 'quick_reply',
 '[{"text": "Reset password", "value": "link:/auth/forgot-password"}, {"text": "Talk to agent", "value": "contact_human"}]'),

-- Promotions
((SELECT id FROM chatbot_intents WHERE name = 'promotions'),
 'Check out our current offers:\n\n• **Flash Deals** - Up to 50% off selected items\n• **Multi-buy offers** - Save when you buy more\n• **New customer?** Get 10% off with code WELCOME10\n\nVisit our Deals page to see all current promotions!',
 'quick_reply',
 '[{"text": "View deals", "value": "link:/deals"}, {"text": "Apply coupon", "value": "link:/checkout"}]'),

-- Complaint
((SELECT id FROM chatbot_intents WHERE name = 'complaint'),
 'I''m really sorry to hear you''ve had a problem. Your feedback is important to us and I want to make this right.\n\nLet me connect you with a customer service agent who can help resolve this immediately.',
 'text', '[]'),

-- Thanks
((SELECT id FROM chatbot_intents WHERE name = 'thanks'),
 'You''re welcome! Is there anything else I can help you with?',
 'quick_reply',
 '[{"text": "No, that''s all", "value": "goodbye"}, {"text": "Yes, another question", "value": "greeting"}]'),

-- Fallback
((SELECT id FROM chatbot_intents WHERE name = 'fallback'),
 'I''m not sure I understood that. Could you try rephrasing, or would you like to speak with a customer service agent?',
 'quick_reply',
 '[{"text": "Talk to agent", "value": "contact_human"}, {"text": "Show main menu", "value": "greeting"}]');

-- Insert default FAQs
INSERT INTO chatbot_faqs (question, answer, category, keywords) VALUES
('How do I track my order?',
 'You can track your order by visiting the "Track Order" page and entering your order number and email. You''ll find your order number in your confirmation email.',
 'orders', ARRAY['track', 'order', 'tracking', 'delivery', 'where']),

('What are your delivery charges?',
 'Delivery is FREE on orders over £50. Standard delivery is £3.99, and express same-day delivery is £5.99.',
 'delivery', ARRAY['delivery', 'shipping', 'cost', 'fee', 'charge', 'free']),

('How do I return an item?',
 'To return an item, go to My Account > Orders, find your order and click "Return Item". Fresh products must be reported within 24 hours, other items within 14 days.',
 'returns', ARRAY['return', 'refund', 'send back', 'exchange']),

('When will I receive my refund?',
 'Refunds are processed within 3-5 business days after we receive the return. It may take an additional 5-10 days for the money to appear in your account.',
 'returns', ARRAY['refund', 'money back', 'when', 'how long']),

('What payment methods do you accept?',
 'We accept Visa, Mastercard, American Express, Apple Pay, Google Pay, and PayPal. All payments are secure and encrypted.',
 'payment', ARRAY['payment', 'pay', 'card', 'visa', 'mastercard', 'paypal']),

('How do I cancel my order?',
 'You can cancel your order from My Account > Orders before it''s dispatched. Click on the order and select "Cancel Order". Once dispatched, please refuse delivery or contact us.',
 'orders', ARRAY['cancel', 'cancellation', 'stop order']),

('Do you offer same-day delivery?',
 'Yes! Same-day delivery is available for orders placed before 2pm in select areas. Choose "Express Delivery" at checkout.',
 'delivery', ARRAY['same day', 'today', 'express', 'fast', 'quick']),

('How do I use a promo code?',
 'Enter your promo code in the "Discount Code" field at checkout and click Apply. The discount will be shown in your order total.',
 'promotions', ARRAY['promo', 'code', 'discount', 'coupon', 'voucher']),

('What if my item arrives damaged?',
 'We''re sorry if your item arrived damaged. Please contact us within 24 hours with photos of the damage and we''ll arrange a full refund or replacement.',
 'returns', ARRAY['damaged', 'broken', 'wrong', 'missing']),

('How do I create an account?',
 'Click "Sign Up" at the top of the page, enter your email and create a password. You can also checkout as a guest without creating an account.',
 'account', ARRAY['account', 'sign up', 'register', 'create']);

-- Insert default settings
INSERT INTO chatbot_settings (setting_key, setting_value, description) VALUES
('bot_name', '"FreshBot"', 'Name of the chatbot'),
('welcome_message', '"Hi! I''m FreshBot, your virtual assistant. How can I help you today?"', 'Initial greeting message'),
('fallback_threshold', '0.3', 'Minimum confidence to match an intent'),
('handoff_keywords', '["agent", "human", "person", "representative", "speak to someone"]', 'Keywords that trigger handoff'),
('typing_delay_ms', '1000', 'Simulated typing delay in milliseconds'),
('bot_avatar', '"/images/bot-avatar.png"', 'Bot avatar image URL'),
('is_enabled', 'true', 'Whether chatbot is active')
ON CONFLICT (setting_key) DO NOTHING;



-- ================================================================
-- MIGRATION: 00019_high_priority_features.sql
-- ================================================================

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



-- ================================================================
-- MIGRATION: 00020_admin_features.sql
-- ================================================================

-- Migration: Admin Features (Site Settings, Audit Logs, Team Management, Email Templates)
-- Based on features from Mak Wines, CMS, and Scitechasia projects

-- =====================================================
-- SITE SETTINGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS site_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Store Information
    store_name TEXT DEFAULT 'FreshMart',
    store_tagline TEXT DEFAULT 'Fresh Groceries Delivered',
    store_email TEXT,
    store_phone TEXT,
    store_address TEXT,
    store_city TEXT,
    store_postcode TEXT,
    store_country TEXT DEFAULT 'United Kingdom',

    -- Business Hours
    opening_hours JSONB DEFAULT '{
        "monday": {"open": "08:00", "close": "22:00", "closed": false},
        "tuesday": {"open": "08:00", "close": "22:00", "closed": false},
        "wednesday": {"open": "08:00", "close": "22:00", "closed": false},
        "thursday": {"open": "08:00", "close": "22:00", "closed": false},
        "friday": {"open": "08:00", "close": "22:00", "closed": false},
        "saturday": {"open": "09:00", "close": "21:00", "closed": false},
        "sunday": {"open": "10:00", "close": "20:00", "closed": false}
    }'::jsonb,

    -- Social Media
    social_facebook TEXT,
    social_instagram TEXT,
    social_twitter TEXT,
    social_youtube TEXT,
    social_tiktok TEXT,

    -- SEO Settings
    meta_title TEXT,
    meta_description TEXT,
    meta_keywords TEXT[],
    google_analytics_id TEXT,
    facebook_pixel_id TEXT,

    -- Order Settings
    min_order_amount_pence INT DEFAULT 0,
    free_delivery_threshold_pence INT DEFAULT 5000,
    order_prefix TEXT DEFAULT 'FM',
    enable_guest_checkout BOOLEAN DEFAULT true,

    -- Notification Settings
    notify_new_order BOOLEAN DEFAULT true,
    notify_low_stock BOOLEAN DEFAULT true,
    low_stock_threshold INT DEFAULT 10,
    notify_email TEXT,

    -- Display Settings
    products_per_page INT DEFAULT 20,
    enable_reviews BOOLEAN DEFAULT true,
    enable_wishlist BOOLEAN DEFAULT true,
    enable_compare BOOLEAN DEFAULT true,
    maintenance_mode BOOLEAN DEFAULT false,
    maintenance_message TEXT,

    -- Currency & Locale
    currency_code TEXT DEFAULT 'GBP',
    currency_symbol TEXT DEFAULT '£',
    timezone TEXT DEFAULT 'Europe/London',
    date_format TEXT DEFAULT 'DD/MM/YYYY',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings
INSERT INTO site_settings (id) VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

-- =====================================================
-- AUDIT LOGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    user_email TEXT,
    user_role TEXT,

    -- Action Details
    action TEXT NOT NULL, -- create, update, delete, login, logout, export, import, bulk_update
    entity_type TEXT NOT NULL, -- product, order, category, user, settings, etc.
    entity_id TEXT,
    entity_name TEXT,

    -- Change Details
    old_values JSONB,
    new_values JSONB,
    changes JSONB, -- summary of what changed

    -- Request Details
    ip_address INET,
    user_agent TEXT,
    request_method TEXT,
    request_path TEXT,

    -- Additional Context
    metadata JSONB,
    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- =====================================================
-- TEAM MEMBERS / STAFF TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,

    -- Personal Info
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    avatar_url TEXT,

    -- Role & Access
    role TEXT NOT NULL DEFAULT 'staff', -- super_admin, admin, manager, staff, support
    department TEXT, -- operations, customer_service, warehouse, marketing, etc.
    job_title TEXT,

    -- Permissions (granular)
    permissions JSONB DEFAULT '{
        "products": {"view": true, "create": false, "edit": false, "delete": false},
        "orders": {"view": true, "create": false, "edit": false, "delete": false},
        "customers": {"view": true, "create": false, "edit": false, "delete": false},
        "categories": {"view": true, "create": false, "edit": false, "delete": false},
        "vendors": {"view": true, "create": false, "edit": false, "delete": false},
        "reports": {"view": false, "export": false},
        "settings": {"view": false, "edit": false},
        "team": {"view": false, "create": false, "edit": false, "delete": false}
    }'::jsonb,

    -- Status
    status TEXT DEFAULT 'active', -- active, inactive, pending, suspended

    -- Activity Tracking
    last_login_at TIMESTAMPTZ,
    last_login_ip INET,
    failed_login_attempts INT DEFAULT 0,
    locked_until TIMESTAMPTZ,

    -- Invitation
    invited_by UUID REFERENCES profiles(id),
    invited_at TIMESTAMPTZ,
    invitation_token TEXT,
    invitation_expires_at TIMESTAMPTZ,

    -- Settings
    notification_preferences JSONB DEFAULT '{
        "email_new_order": true,
        "email_low_stock": true,
        "email_daily_summary": false,
        "push_notifications": true
    }'::jsonb,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for team members
CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members(email);
CREATE INDEX IF NOT EXISTS idx_team_members_role ON team_members(role);
CREATE INDEX IF NOT EXISTS idx_team_members_status ON team_members(status);

-- =====================================================
-- EMAIL TEMPLATES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Template Info
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    category TEXT NOT NULL, -- order, account, marketing, notification

    -- Template Content
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT,

    -- Variables (what placeholders are available)
    available_variables JSONB DEFAULT '[]'::jsonb,

    -- Status
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false, -- system templates cannot be deleted

    -- Metadata
    last_sent_at TIMESTAMPTZ,
    send_count INT DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default email templates
INSERT INTO email_templates (name, slug, category, subject, body_html, body_text, is_system, available_variables) VALUES
-- Order Confirmation
('Order Confirmation', 'order-confirmation', 'order',
 'Your FreshMart Order #{{order_number}} is Confirmed!',
 '<h1>Thank you for your order!</h1><p>Hi {{customer_name}},</p><p>Your order #{{order_number}} has been confirmed and is being prepared.</p><p><strong>Order Total:</strong> {{order_total}}</p><p>We''ll notify you when it''s on its way!</p><p>Thanks,<br>The FreshMart Team</p>',
 'Thank you for your order! Hi {{customer_name}}, Your order #{{order_number}} has been confirmed. Order Total: {{order_total}}',
 true,
 '["customer_name", "customer_email", "order_number", "order_total", "order_items", "delivery_address", "delivery_date"]'::jsonb),

-- Order Shipped
('Order Shipped', 'order-shipped', 'order',
 'Your FreshMart Order #{{order_number}} is On Its Way!',
 '<h1>Your order is on its way!</h1><p>Hi {{customer_name}},</p><p>Great news! Your order #{{order_number}} is out for delivery.</p><p><strong>Estimated Delivery:</strong> {{delivery_date}}</p><p>Track your order: {{tracking_link}}</p>',
 'Your order #{{order_number}} is on its way! Estimated delivery: {{delivery_date}}',
 true,
 '["customer_name", "order_number", "delivery_date", "tracking_link", "driver_name"]'::jsonb),

-- Order Delivered
('Order Delivered', 'order-delivered', 'order',
 'Your FreshMart Order #{{order_number}} Has Been Delivered!',
 '<h1>Your order has been delivered!</h1><p>Hi {{customer_name}},</p><p>Your order #{{order_number}} has been delivered.</p><p>We hope you enjoy your fresh groceries!</p><p>Leave a review: {{review_link}}</p>',
 'Your order #{{order_number}} has been delivered! We hope you enjoy your fresh groceries.',
 true,
 '["customer_name", "order_number", "review_link"]'::jsonb),

-- Welcome Email
('Welcome Email', 'welcome', 'account',
 'Welcome to FreshMart!',
 '<h1>Welcome to FreshMart!</h1><p>Hi {{customer_name}},</p><p>Thanks for creating an account with us. We''re excited to have you!</p><p>Start shopping now: {{shop_link}}</p>',
 'Welcome to FreshMart! Hi {{customer_name}}, Thanks for creating an account.',
 true,
 '["customer_name", "customer_email", "shop_link"]'::jsonb),

-- Password Reset
('Password Reset', 'password-reset', 'account',
 'Reset Your FreshMart Password',
 '<h1>Reset Your Password</h1><p>Hi {{customer_name}},</p><p>Click the link below to reset your password:</p><p><a href="{{reset_link}}">Reset Password</a></p><p>This link expires in 1 hour.</p>',
 'Reset your password: {{reset_link}}. This link expires in 1 hour.',
 true,
 '["customer_name", "reset_link"]'::jsonb),

-- Low Stock Alert (Admin)
('Low Stock Alert', 'low-stock-alert', 'notification',
 'Low Stock Alert: {{product_name}}',
 '<h1>Low Stock Alert</h1><p>The following product is running low:</p><p><strong>{{product_name}}</strong></p><p>Current Stock: {{stock_quantity}}</p><p>SKU: {{product_sku}}</p><p><a href="{{product_link}}">View Product</a></p>',
 'Low Stock Alert: {{product_name}} has only {{stock_quantity}} units left.',
 true,
 '["product_name", "product_sku", "stock_quantity", "product_link"]'::jsonb),

-- New Order Alert (Admin)
('New Order Alert', 'new-order-alert', 'notification',
 'New Order #{{order_number}} - {{order_total}}',
 '<h1>New Order Received</h1><p>Order #{{order_number}}</p><p><strong>Customer:</strong> {{customer_name}}</p><p><strong>Total:</strong> {{order_total}}</p><p><strong>Items:</strong> {{item_count}}</p><p><a href="{{order_link}}">View Order</a></p>',
 'New Order #{{order_number}} from {{customer_name}} for {{order_total}}',
 true,
 '["order_number", "customer_name", "customer_email", "order_total", "item_count", "order_link"]'::jsonb)

ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- BACKUP LOGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS backup_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_type TEXT NOT NULL, -- full, incremental, database, media
    status TEXT NOT NULL, -- pending, in_progress, completed, failed
    file_path TEXT,
    file_size_bytes BIGINT,
    tables_included TEXT[],
    error_message TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_by UUID REFERENCES profiles(id),
    metadata JSONB
);

-- =====================================================
-- IMPORT/EXPORT JOBS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS import_export_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type TEXT NOT NULL, -- import, export
    entity_type TEXT NOT NULL, -- products, orders, customers, categories
    status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed

    -- File Info
    file_name TEXT,
    file_path TEXT,
    file_size_bytes BIGINT,
    file_format TEXT, -- csv, xlsx, json

    -- Progress
    total_rows INT DEFAULT 0,
    processed_rows INT DEFAULT 0,
    success_count INT DEFAULT 0,
    error_count INT DEFAULT 0,

    -- Results
    errors JSONB DEFAULT '[]'::jsonb,
    warnings JSONB DEFAULT '[]'::jsonb,
    result_summary JSONB,

    -- Timestamps
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id)
);

-- Index for jobs
CREATE INDEX IF NOT EXISTS idx_import_export_jobs_status ON import_export_jobs(status);
CREATE INDEX IF NOT EXISTS idx_import_export_jobs_created ON import_export_jobs(created_at DESC);

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Site Settings - Only admins can modify
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_settings_read" ON site_settings
    FOR SELECT USING (true);

CREATE POLICY "site_settings_write" ON site_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

-- Audit Logs - Admins can read, system writes
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_admin_read" ON audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

-- Team Members - Admins can manage
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_members_read" ON team_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "team_members_write" ON team_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'super_admin'
        )
    );

-- Email Templates - Admins can manage
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_templates_read" ON email_templates
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "email_templates_write" ON email_templates
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to log an action
CREATE OR REPLACE FUNCTION log_audit_action(
    p_user_id UUID,
    p_action TEXT,
    p_entity_type TEXT,
    p_entity_id TEXT DEFAULT NULL,
    p_entity_name TEXT DEFAULT NULL,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
    v_user_email TEXT;
    v_user_role TEXT;
BEGIN
    -- Get user info
    SELECT email, role INTO v_user_email, v_user_role
    FROM profiles WHERE id = p_user_id;

    INSERT INTO audit_logs (
        user_id, user_email, user_role,
        action, entity_type, entity_id, entity_name,
        old_values, new_values, metadata
    ) VALUES (
        p_user_id, v_user_email, v_user_role,
        p_action, p_entity_type, p_entity_id, p_entity_name,
        p_old_values, p_new_values, p_metadata
    ) RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get site settings (singleton)
CREATE OR REPLACE FUNCTION get_site_settings()
RETURNS site_settings AS $$
DECLARE
    v_settings site_settings;
BEGIN
    SELECT * INTO v_settings FROM site_settings LIMIT 1;

    IF v_settings IS NULL THEN
        INSERT INTO site_settings (id) VALUES (gen_random_uuid())
        RETURNING * INTO v_settings;
    END IF;

    RETURN v_settings;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_site_settings_timestamp
    BEFORE UPDATE ON site_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_team_members_timestamp
    BEFORE UPDATE ON team_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_email_templates_timestamp
    BEFORE UPDATE ON email_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();



-- ================================================================
-- MIGRATION: 20240125_returns_system.sql
-- ================================================================

-- Returns/Refunds System
-- Full workflow for handling customer returns and refunds

-- Return request status enum
CREATE TYPE return_status AS ENUM (
  'pending',           -- Customer submitted return request
  'approved',          -- Admin approved the return
  'rejected',          -- Admin rejected the return
  'items_received',    -- Returned items received at warehouse
  'inspecting',        -- Items being inspected
  'refund_processing', -- Refund being processed
  'refunded',          -- Refund completed
  'cancelled'          -- Customer cancelled request
);

-- Return reason enum
CREATE TYPE return_reason AS ENUM (
  'damaged',           -- Item arrived damaged
  'wrong_item',        -- Wrong item received
  'not_as_described',  -- Item not as described
  'quality_issue',     -- Quality not satisfactory
  'changed_mind',      -- Customer changed mind
  'expired',           -- Item expired or near expiry
  'missing_items',     -- Items missing from order
  'other'              -- Other reason
);

-- Refund method enum
CREATE TYPE refund_method AS ENUM (
  'original_payment',  -- Refund to original payment method
  'store_credit',      -- Issue store credit
  'bank_transfer',     -- Direct bank transfer
  'replacement'        -- Send replacement instead
);

-- Returns table
CREATE TABLE IF NOT EXISTS returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number VARCHAR(20) UNIQUE NOT NULL,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,

  -- Status tracking
  status return_status NOT NULL DEFAULT 'pending',

  -- Return details
  reason return_reason NOT NULL,
  reason_details TEXT,

  -- Refund information
  refund_method refund_method,
  refund_amount_pence INTEGER DEFAULT 0,
  refund_reference VARCHAR(100),

  -- Admin handling
  handled_by UUID REFERENCES auth.users(id),
  admin_notes TEXT,
  rejection_reason TEXT,

  -- Tracking
  return_tracking_number VARCHAR(100),
  return_carrier VARCHAR(50),

  -- Proof/evidence
  images TEXT[], -- Array of image URLs

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

-- Return items (which items from the order are being returned)
CREATE TABLE IF NOT EXISTS return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,

  -- Quantity
  quantity INTEGER NOT NULL CHECK (quantity > 0),

  -- Item condition on receipt
  condition VARCHAR(50), -- 'unopened', 'opened', 'damaged', 'used'
  condition_notes TEXT,

  -- Refund for this item
  refund_amount_pence INTEGER DEFAULT 0,

  -- Restock decision
  restock BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Return status history for audit trail
CREATE TABLE IF NOT EXISTS return_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  old_status return_status,
  new_status return_status NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Store credits for refunds
CREATE TABLE IF NOT EXISTS store_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  return_id UUID REFERENCES returns(id) ON DELETE SET NULL,

  -- Credit details
  code VARCHAR(20) UNIQUE NOT NULL,
  amount_pence INTEGER NOT NULL CHECK (amount_pence > 0),
  remaining_pence INTEGER NOT NULL CHECK (remaining_pence >= 0),

  -- Validity
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,

  -- Usage
  used_at TIMESTAMPTZ,
  used_on_order_id UUID REFERENCES orders(id),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_returns_order_id ON returns(order_id);
CREATE INDEX idx_returns_user_id ON returns(user_id);
CREATE INDEX idx_returns_status ON returns(status);
CREATE INDEX idx_returns_created_at ON returns(created_at DESC);
CREATE INDEX idx_return_items_return_id ON return_items(return_id);
CREATE INDEX idx_return_status_history_return_id ON return_status_history(return_id);
CREATE INDEX idx_store_credits_user_id ON store_credits(user_id);
CREATE INDEX idx_store_credits_code ON store_credits(code);

-- Generate return number function
CREATE OR REPLACE FUNCTION generate_return_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.return_number := 'RET-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
    LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_return_number
  BEFORE INSERT ON returns
  FOR EACH ROW
  EXECUTE FUNCTION generate_return_number();

-- Update timestamp trigger
CREATE TRIGGER update_returns_updated_at
  BEFORE UPDATE ON returns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Status change trigger for history
CREATE OR REPLACE FUNCTION log_return_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO return_status_history (return_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, NEW.handled_by);

    -- Set relevant timestamps
    CASE NEW.status
      WHEN 'approved' THEN NEW.approved_at := NOW();
      WHEN 'items_received' THEN NEW.received_at := NOW();
      WHEN 'refunded' THEN NEW.refunded_at := NOW();
      WHEN 'cancelled' THEN NEW.cancelled_at := NOW();
      ELSE NULL;
    END CASE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER return_status_change
  BEFORE UPDATE ON returns
  FOR EACH ROW
  EXECUTE FUNCTION log_return_status_change();

-- Generate store credit code
CREATE OR REPLACE FUNCTION generate_credit_code()
RETURNS TRIGGER AS $$
BEGIN
  NEW.code := 'SC-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_credit_code
  BEFORE INSERT ON store_credits
  FOR EACH ROW
  WHEN (NEW.code IS NULL)
  EXECUTE FUNCTION generate_credit_code();

-- RLS Policies
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_credits ENABLE ROW LEVEL SECURITY;

-- Users can view their own returns
CREATE POLICY "Users can view own returns"
  ON returns FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create returns for their orders
CREATE POLICY "Users can create returns"
  ON returns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own return items
CREATE POLICY "Users can view own return items"
  ON return_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM returns
      WHERE returns.id = return_items.return_id
      AND returns.user_id = auth.uid()
    )
  );

-- Users can view their store credits
CREATE POLICY "Users can view own credits"
  ON store_credits FOR SELECT
  USING (auth.uid() = user_id);

-- Admin policies (using service role key bypasses RLS)



-- ================================================================
-- MIGRATION: 20240126_automation_system.sql
-- ================================================================

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



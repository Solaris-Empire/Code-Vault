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

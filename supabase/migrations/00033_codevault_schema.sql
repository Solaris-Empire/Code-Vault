-- =====================================================
-- CODEVAULT SCHEMA MIGRATION
-- Drop all grocery tables, create CodeVault marketplace
-- =====================================================

-- =====================================================
-- PHASE 1: DROP ALL GROCERY TABLES
-- Using CASCADE to handle foreign key dependencies
-- =====================================================

-- Drop old trigger first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at() CASCADE;

-- Drop all existing tables (CASCADE handles FK deps)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  ) LOOP
    EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
  END LOOP;
END $$;

-- Clean up any remaining functions from grocery store
DROP FUNCTION IF EXISTS public.generate_referral_code(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_or_create_referral_code(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.apply_referral_code(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.add_user_credit(UUID, INT, TEXT, TEXT, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.process_referral_reward() CASCADE;
DROP FUNCTION IF EXISTS public.generate_offer_badge() CASCADE;
DROP FUNCTION IF EXISTS public.get_delivery_zone_for_postcode(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.generate_delivery_slots(UUID, DATE, INT) CASCADE;
DROP FUNCTION IF EXISTS public.get_available_delivery_slots(UUID, DATE, INT) CASCADE;
DROP FUNCTION IF EXISTS public.reserve_delivery_slot(UUID, TEXT, UUID, INT) CASCADE;
DROP FUNCTION IF EXISTS public.convert_slot_reservation(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_expired_slot_reservations() CASCADE;

-- =====================================================
-- PHASE 2: CREATE CODEVAULT TABLES
-- =====================================================

-- 1. USERS (extends auth.users with marketplace profile)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  role TEXT DEFAULT 'buyer' CHECK (role IN ('buyer', 'seller', 'admin')),
  avatar_url TEXT,
  bio TEXT,
  -- Stripe Connect fields (for sellers)
  stripe_account_id TEXT,
  stripe_onboarding_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CATEGORIES (code marketplace categories)
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT,
  parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PRODUCTS (digital code items for sale)
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  short_description TEXT,
  price_cents INT NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  demo_url TEXT,
  thumbnail_url TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected')),
  download_count INT DEFAULT 0,
  avg_rating DECIMAL(3,2) DEFAULT 0,
  review_count INT DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PRODUCT FILES (versioned downloadable files)
CREATE TABLE public.product_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT,
  version TEXT NOT NULL DEFAULT '1.0.0',
  changelog TEXT,
  is_current BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. LICENSES (one per purchase, regular or extended)
CREATE TABLE public.licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  license_key TEXT UNIQUE NOT NULL,
  license_type TEXT DEFAULT 'regular' CHECK (license_type IN ('regular', 'extended')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ORDERS (digital purchase records with commission split)
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  license_id UUID REFERENCES public.licenses(id) ON DELETE SET NULL,
  amount_cents INT NOT NULL,
  platform_fee_cents INT NOT NULL,    -- 15% of amount_cents
  seller_payout_cents INT NOT NULL,   -- 85% of amount_cents
  stripe_payment_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'refunded', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. REVIEWS (one per buyer per product, must own to review)
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (product_id, buyer_id)
);

-- 8. PAYOUTS (seller earnings withdrawals via Stripe)
CREATE TABLE public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount_cents INT NOT NULL,
  stripe_payout_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PHASE 3: INDEXES
-- =====================================================

-- Users
CREATE INDEX idx_users_role ON public.users(role);

-- Categories
CREATE INDEX idx_categories_slug ON public.categories(slug);
CREATE INDEX idx_categories_parent ON public.categories(parent_id);

-- Products
CREATE INDEX idx_products_slug ON public.products(slug);
CREATE INDEX idx_products_seller ON public.products(seller_id);
CREATE INDEX idx_products_category ON public.products(category_id);
CREATE INDEX idx_products_status ON public.products(status);
CREATE INDEX idx_products_featured ON public.products(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_products_search ON public.products
  USING GIN (to_tsvector('english', title || ' ' || COALESCE(description, '') || ' ' || COALESCE(short_description, '')));

-- Product files
CREATE INDEX idx_product_files_product ON public.product_files(product_id);

-- Licenses
CREATE INDEX idx_licenses_buyer ON public.licenses(buyer_id);
CREATE INDEX idx_licenses_product ON public.licenses(product_id);
CREATE INDEX idx_licenses_key ON public.licenses(license_key);

-- Orders
CREATE INDEX idx_orders_buyer ON public.orders(buyer_id);
CREATE INDEX idx_orders_product ON public.orders(product_id);
CREATE INDEX idx_orders_stripe ON public.orders(stripe_payment_id);

-- Reviews
CREATE INDEX idx_reviews_product ON public.reviews(product_id);

-- Payouts
CREATE INDEX idx_payouts_seller ON public.payouts(seller_id);

-- =====================================================
-- PHASE 4: ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

-- USERS: public read, own profile write
CREATE POLICY "Public profiles are viewable" ON public.users
  FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- CATEGORIES: public read, admin write
CREATE POLICY "Categories are public" ON public.categories
  FOR SELECT USING (true);
CREATE POLICY "Admins manage categories" ON public.categories
  FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- PRODUCTS: approved are public, seller sees own drafts, admin sees all
CREATE POLICY "Approved products are public" ON public.products
  FOR SELECT USING (
    status = 'approved'
    OR seller_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Sellers can insert products" ON public.products
  FOR INSERT WITH CHECK (
    auth.uid() = seller_id
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('seller', 'admin'))
  );
CREATE POLICY "Sellers can update own products" ON public.products
  FOR UPDATE USING (
    seller_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Admins can delete products" ON public.products
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- PRODUCT FILES: visible to seller (owner) and buyers with license
CREATE POLICY "Product files visible to authorized users" ON public.product_files
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.products WHERE id = product_id AND seller_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.licenses WHERE product_id = product_files.product_id AND buyer_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Sellers manage own product files" ON public.product_files
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.products WHERE id = product_id AND seller_id = auth.uid())
  );
CREATE POLICY "Sellers update own product files" ON public.product_files
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.products WHERE id = product_id AND seller_id = auth.uid())
  );

-- LICENSES: buyer sees own, seller sees for own products
CREATE POLICY "Users see relevant licenses" ON public.licenses
  FOR SELECT USING (
    buyer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.products WHERE id = product_id AND seller_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ORDERS: buyer sees own, seller sees orders for own products
CREATE POLICY "Users see relevant orders" ON public.orders
  FOR SELECT USING (
    buyer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.products WHERE id = product_id AND seller_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- REVIEWS: public read, buyers can write for purchased products
CREATE POLICY "Reviews are public" ON public.reviews
  FOR SELECT USING (true);
CREATE POLICY "Buyers can review purchased products" ON public.reviews
  FOR INSERT WITH CHECK (
    auth.uid() = buyer_id
    AND EXISTS (SELECT 1 FROM public.orders WHERE product_id = reviews.product_id AND buyer_id = auth.uid() AND status = 'completed')
  );
CREATE POLICY "Buyers can update own reviews" ON public.reviews
  FOR UPDATE USING (buyer_id = auth.uid());

-- PAYOUTS: seller sees own, admin sees all
CREATE POLICY "Users see relevant payouts" ON public.payouts
  FOR SELECT USING (
    seller_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- =====================================================
-- PHASE 5: FUNCTIONS & TRIGGERS
-- =====================================================

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    'buyer'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Auto-update product avg_rating when reviews change
CREATE OR REPLACE FUNCTION public.update_product_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.products
  SET
    avg_rating = (SELECT COALESCE(AVG(rating), 0) FROM public.reviews WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)),
    review_count = (SELECT COUNT(*) FROM public.reviews WHERE product_id = COALESCE(NEW.product_id, OLD.product_id))
  WHERE id = COALESCE(NEW.product_id, OLD.product_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_product_rating_on_review
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_product_rating();

-- Increment download_count when order is completed
CREATE OR REPLACE FUNCTION public.increment_download_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
    UPDATE public.products
    SET download_count = download_count + 1
    WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER increment_downloads_on_purchase
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.increment_download_count();

-- =====================================================
-- PHASE 6: SEED CATEGORIES
-- =====================================================

INSERT INTO public.categories (name, slug, description, icon, sort_order) VALUES
  ('PHP Scripts', 'php-scripts', 'PHP scripts and applications', 'php', 1),
  ('JavaScript', 'javascript', 'JavaScript plugins and libraries', 'js', 2),
  ('React & Next.js', 'react-nextjs', 'React components and Next.js templates', 'react', 3),
  ('Vue.js', 'vuejs', 'Vue.js components and templates', 'vue', 4),
  ('WordPress Plugins', 'wordpress-plugins', 'WordPress plugins and extensions', 'wordpress', 5),
  ('WordPress Themes', 'wordpress-themes', 'WordPress themes and templates', 'wordpress', 6),
  ('HTML Templates', 'html-templates', 'HTML/CSS website templates', 'html', 7),
  ('Mobile Apps', 'mobile-apps', 'Flutter and React Native applications', 'mobile', 8),
  ('Full Applications', 'full-applications', 'Complete ready-to-deploy applications', 'app', 9),
  ('UI Kits & Components', 'ui-kits', 'UI component libraries and design kits', 'palette', 10),
  ('API & Backend', 'api-backend', 'API services and backend systems', 'server', 11),
  ('Database & Tools', 'database-tools', 'Database utilities and developer tools', 'database', 12);

-- =====================================================
-- PHASE 7: STORAGE BUCKETS
-- =====================================================

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('product-files', 'product-files', false),
  ('thumbnails', 'thumbnails', true),
  ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: sellers can upload to product-files
CREATE POLICY "Sellers can upload product files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'product-files'
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('seller', 'admin'))
  );

-- Anyone can view thumbnails
CREATE POLICY "Thumbnails are public" ON storage.objects
  FOR SELECT USING (bucket_id = 'thumbnails');

-- Users can upload thumbnails for their products
CREATE POLICY "Sellers can upload thumbnails" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'thumbnails'
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('seller', 'admin'))
  );

-- Users can upload their own avatar
CREATE POLICY "Users can upload avatars" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND auth.uid() IS NOT NULL
  );

-- Avatars are public
CREATE POLICY "Avatars are public" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

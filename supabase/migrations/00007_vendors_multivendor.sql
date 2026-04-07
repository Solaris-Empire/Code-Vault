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

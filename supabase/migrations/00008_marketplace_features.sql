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

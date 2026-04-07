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

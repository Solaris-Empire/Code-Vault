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

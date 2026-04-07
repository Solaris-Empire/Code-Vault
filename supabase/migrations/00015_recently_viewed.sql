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

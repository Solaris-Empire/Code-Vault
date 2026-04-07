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

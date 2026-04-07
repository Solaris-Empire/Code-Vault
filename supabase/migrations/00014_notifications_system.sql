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

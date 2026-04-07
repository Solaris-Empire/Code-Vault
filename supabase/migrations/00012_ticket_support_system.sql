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

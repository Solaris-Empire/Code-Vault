-- =====================================================
-- LIVE CHAT SYSTEM MIGRATION
-- =====================================================

-- Chat conversations
CREATE TABLE IF NOT EXISTS chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  guest_email TEXT,
  guest_name TEXT,
  session_id TEXT, -- For anonymous users
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'resolved', 'closed')),
  assigned_agent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  department TEXT DEFAULT 'general', -- general, orders, technical, billing
  subject TEXT,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  rating INT CHECK (rating BETWEEN 1 AND 5),
  feedback TEXT,
  metadata JSONB DEFAULT '{}', -- Store page URL, browser info, etc.
  started_at TIMESTAMPTZ DEFAULT NOW(),
  first_response_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  unread_customer INT DEFAULT 0,
  unread_agent INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'agent', 'system', 'bot')),
  sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sender_name TEXT,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'product', 'order', 'quick_reply')),
  attachments JSONB DEFAULT '[]', -- Array of {url, name, type, size}
  metadata JSONB DEFAULT '{}', -- For quick replies, product cards, etc.
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quick reply templates
CREATE TABLE IF NOT EXISTS chat_quick_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  use_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat agents status
CREATE TABLE IF NOT EXISTS chat_agent_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'away', 'busy', 'offline')),
  max_concurrent_chats INT DEFAULT 5,
  current_chat_count INT DEFAULT 0,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  auto_accept BOOLEAN DEFAULT TRUE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user ON chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_session ON chat_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_status ON chat_conversations(status);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_agent ON chat_conversations(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_last_message ON chat_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_agent_status_online ON chat_agent_status(status) WHERE status = 'online';

-- Enable RLS
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_quick_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_agent_status ENABLE ROW LEVEL SECURITY;

-- Customers can view their own conversations
CREATE POLICY "Customers can view their conversations"
  ON chat_conversations FOR SELECT
  USING (user_id = auth.uid() OR session_id IS NOT NULL);

-- Customers can create conversations
CREATE POLICY "Anyone can create conversations"
  ON chat_conversations FOR INSERT
  WITH CHECK (true);

-- Customers can update their own conversations (for rating/feedback)
CREATE POLICY "Customers can update their conversations"
  ON chat_conversations FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Agents/Admins can manage all conversations
CREATE POLICY "Agents can manage conversations"
  ON chat_conversations FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'vendor')
  ));

-- Customers can view messages in their conversations
CREATE POLICY "Customers can view their messages"
  ON chat_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM chat_conversations
    WHERE id = conversation_id
    AND (user_id = auth.uid() OR session_id IS NOT NULL)
  ));

-- Anyone can send messages (we'll validate in the API)
CREATE POLICY "Anyone can send messages"
  ON chat_messages FOR INSERT
  WITH CHECK (true);

-- Agents can manage all messages
CREATE POLICY "Agents can manage messages"
  ON chat_messages FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'vendor')
  ));

-- Everyone can view quick replies
CREATE POLICY "Everyone can view quick replies"
  ON chat_quick_replies FOR SELECT
  USING (is_active = true);

-- Admins can manage quick replies
CREATE POLICY "Admins can manage quick replies"
  ON chat_quick_replies FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Agents can manage their own status
CREATE POLICY "Agents can manage their status"
  ON chat_agent_status FOR ALL
  USING (agent_id = auth.uid());

-- Everyone can view agent availability
CREATE POLICY "Everyone can view agent status"
  ON chat_agent_status FOR SELECT
  USING (true);

-- Function to start a chat conversation
CREATE OR REPLACE FUNCTION start_chat_conversation(
  p_user_id UUID DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL,
  p_guest_name TEXT DEFAULT NULL,
  p_guest_email TEXT DEFAULT NULL,
  p_subject TEXT DEFAULT NULL,
  p_department TEXT DEFAULT 'general',
  p_initial_message TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS TABLE (
  conversation_id UUID,
  message_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conversation_id UUID;
  v_message_id UUID;
  v_available_agent_id UUID;
BEGIN
  -- Find an available agent
  SELECT agent_id INTO v_available_agent_id
  FROM chat_agent_status
  WHERE status = 'online'
    AND auto_accept = true
    AND current_chat_count < max_concurrent_chats
  ORDER BY current_chat_count ASC, last_activity_at DESC
  LIMIT 1;

  -- Create conversation
  INSERT INTO chat_conversations (
    user_id, session_id, guest_name, guest_email,
    subject, department, metadata,
    assigned_agent_id, status
  )
  VALUES (
    p_user_id, p_session_id, p_guest_name, p_guest_email,
    p_subject, p_department, p_metadata,
    v_available_agent_id,
    CASE WHEN v_available_agent_id IS NOT NULL THEN 'active' ELSE 'waiting' END
  )
  RETURNING id INTO v_conversation_id;

  -- Update agent chat count if assigned
  IF v_available_agent_id IS NOT NULL THEN
    UPDATE chat_agent_status
    SET current_chat_count = current_chat_count + 1,
        last_activity_at = NOW()
    WHERE agent_id = v_available_agent_id;
  END IF;

  -- Add initial message if provided
  IF p_initial_message IS NOT NULL AND p_initial_message != '' THEN
    INSERT INTO chat_messages (
      conversation_id, sender_type, sender_id, sender_name, content
    )
    VALUES (
      v_conversation_id,
      'customer',
      p_user_id,
      COALESCE(p_guest_name, 'Customer'),
      p_initial_message
    )
    RETURNING id INTO v_message_id;
  END IF;

  -- Add system message if no agent available
  IF v_available_agent_id IS NULL THEN
    INSERT INTO chat_messages (
      conversation_id, sender_type, content
    )
    VALUES (
      v_conversation_id,
      'system',
      'Thank you for contacting us. All our agents are currently busy. You''ll be connected to the next available agent shortly.'
    );
  ELSE
    INSERT INTO chat_messages (
      conversation_id, sender_type, content
    )
    VALUES (
      v_conversation_id,
      'system',
      'You''re now connected with our support team. How can we help you today?'
    );
  END IF;

  RETURN QUERY SELECT v_conversation_id, v_message_id;
END;
$$;

-- Function to send a chat message
CREATE OR REPLACE FUNCTION send_chat_message(
  p_conversation_id UUID,
  p_sender_type TEXT,
  p_sender_id UUID DEFAULT NULL,
  p_sender_name TEXT DEFAULT NULL,
  p_content TEXT DEFAULT NULL,
  p_message_type TEXT DEFAULT 'text',
  p_attachments JSONB DEFAULT '[]',
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message_id UUID;
  v_conversation RECORD;
BEGIN
  -- Get conversation
  SELECT * INTO v_conversation
  FROM chat_conversations
  WHERE id = p_conversation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;

  -- Insert message
  INSERT INTO chat_messages (
    conversation_id, sender_type, sender_id, sender_name,
    content, message_type, attachments, metadata
  )
  VALUES (
    p_conversation_id, p_sender_type, p_sender_id, p_sender_name,
    p_content, p_message_type, p_attachments, p_metadata
  )
  RETURNING id INTO v_message_id;

  -- Update conversation
  UPDATE chat_conversations
  SET last_message_at = NOW(),
      unread_customer = CASE WHEN p_sender_type = 'agent' THEN unread_customer + 1 ELSE unread_customer END,
      unread_agent = CASE WHEN p_sender_type = 'customer' THEN unread_agent + 1 ELSE unread_agent END,
      first_response_at = CASE
        WHEN first_response_at IS NULL AND p_sender_type = 'agent' THEN NOW()
        ELSE first_response_at
      END
  WHERE id = p_conversation_id;

  RETURN v_message_id;
END;
$$;

-- Function to resolve/close conversation
CREATE OR REPLACE FUNCTION close_chat_conversation(
  p_conversation_id UUID,
  p_status TEXT DEFAULT 'resolved',
  p_rating INT DEFAULT NULL,
  p_feedback TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_conversation RECORD;
BEGIN
  SELECT * INTO v_conversation
  FROM chat_conversations
  WHERE id = p_conversation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Update conversation
  UPDATE chat_conversations
  SET status = p_status,
      rating = COALESCE(p_rating, rating),
      feedback = COALESCE(p_feedback, feedback),
      resolved_at = CASE WHEN p_status = 'resolved' THEN NOW() ELSE resolved_at END,
      closed_at = NOW()
  WHERE id = p_conversation_id;

  -- Decrement agent chat count
  IF v_conversation.assigned_agent_id IS NOT NULL THEN
    UPDATE chat_agent_status
    SET current_chat_count = GREATEST(0, current_chat_count - 1)
    WHERE agent_id = v_conversation.assigned_agent_id;
  END IF;

  -- Add system message
  INSERT INTO chat_messages (conversation_id, sender_type, content)
  VALUES (p_conversation_id, 'system',
    CASE p_status
      WHEN 'resolved' THEN 'This conversation has been resolved. Thank you for contacting us!'
      ELSE 'This conversation has been closed.'
    END
  );

  RETURN true;
END;
$$;

-- Function to check agent availability
CREATE OR REPLACE FUNCTION check_chat_availability()
RETURNS TABLE (
  is_available BOOLEAN,
  estimated_wait_minutes INT,
  available_agents INT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_available_count INT;
  v_waiting_count INT;
BEGIN
  SELECT COUNT(*) INTO v_available_count
  FROM chat_agent_status
  WHERE status = 'online'
    AND current_chat_count < max_concurrent_chats;

  SELECT COUNT(*) INTO v_waiting_count
  FROM chat_conversations
  WHERE status = 'waiting';

  RETURN QUERY SELECT
    v_available_count > 0,
    CASE
      WHEN v_available_count > 0 THEN 0
      ELSE GREATEST(1, v_waiting_count * 5) -- Estimate 5 min per waiting chat
    END,
    v_available_count;
END;
$$;

-- Insert default quick replies
INSERT INTO chat_quick_replies (category, title, content) VALUES
  ('greeting', 'Welcome', 'Hello! Welcome to FreshMart support. How can I help you today?'),
  ('greeting', 'Returning customer', 'Welcome back! I''d be happy to assist you. What can I help you with?'),
  ('orders', 'Order status', 'I can help you check your order status. Could you please provide your order number?'),
  ('orders', 'Delivery update', 'Let me check the delivery status for you. One moment please...'),
  ('orders', 'Refund process', 'I understand you''d like a refund. I''ll help you with that. Could you please tell me which order this is regarding?'),
  ('products', 'Stock inquiry', 'Let me check the stock availability for you. Which product are you interested in?'),
  ('products', 'Price match', 'We''re happy to look into price matching. Could you share where you saw the lower price?'),
  ('technical', 'Website issue', 'I''m sorry to hear you''re experiencing issues with our website. Could you describe what''s happening?'),
  ('closing', 'Thank you', 'Thank you for contacting FreshMart support. Is there anything else I can help you with?'),
  ('closing', 'Resolved', 'I''m glad I could help! If you have any other questions, feel free to reach out. Have a great day!')
ON CONFLICT DO NOTHING;

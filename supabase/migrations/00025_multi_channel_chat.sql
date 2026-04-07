-- Multi-channel chat: Customer↔Vendor, Vendor↔Admin, Customer↔Admin
-- Adds channel_type and vendor_id to chat_conversations
-- Adds 'vendor' sender_type to chat_messages

-- 1. Add channel_type column
ALTER TABLE chat_conversations
  ADD COLUMN IF NOT EXISTS channel_type TEXT NOT NULL DEFAULT 'customer_admin';

-- Add CHECK constraint for channel_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_conversations_channel_type_check'
  ) THEN
    ALTER TABLE chat_conversations
      ADD CONSTRAINT chat_conversations_channel_type_check
      CHECK (channel_type IN ('customer_admin', 'customer_vendor', 'vendor_admin'));
  END IF;
END $$;

-- 2. Add vendor_id column
ALTER TABLE chat_conversations
  ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL;

-- 3. Update sender_type constraint on chat_messages to include 'vendor'
-- First drop existing constraint if any
DO $$
BEGIN
  -- Try to drop any existing check constraint on sender_type
  DECLARE
    constraint_name TEXT;
  BEGIN
    SELECT c.conname INTO constraint_name
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
    WHERE c.conrelid = 'chat_messages'::regclass
      AND a.attname = 'sender_type'
      AND c.contype = 'c'
    LIMIT 1;

    IF constraint_name IS NOT NULL THEN
      EXECUTE 'ALTER TABLE chat_messages DROP CONSTRAINT ' || constraint_name;
    END IF;
  END;
END $$;

-- Add updated constraint including 'vendor'
ALTER TABLE chat_messages
  ADD CONSTRAINT chat_messages_sender_type_check
  CHECK (sender_type IN ('customer', 'agent', 'system', 'bot', 'vendor'));

-- 4. Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_chat_conversations_channel_type
  ON chat_conversations(channel_type);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_vendor_id
  ON chat_conversations(vendor_id);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_vendor_status
  ON chat_conversations(vendor_id, status);

-- 5. Update start_chat_conversation function to support channel_type and vendor_id
CREATE OR REPLACE FUNCTION start_chat_conversation(
  p_user_id UUID DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL,
  p_guest_name TEXT DEFAULT NULL,
  p_guest_email TEXT DEFAULT NULL,
  p_subject TEXT DEFAULT NULL,
  p_department TEXT DEFAULT 'general',
  p_initial_message TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}',
  p_channel_type TEXT DEFAULT 'customer_admin',
  p_vendor_id UUID DEFAULT NULL
)
RETURNS TABLE(conversation_id UUID, message_id UUID)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_conversation_id UUID;
  v_message_id UUID;
BEGIN
  INSERT INTO chat_conversations (
    user_id, session_id, guest_name, guest_email, subject,
    department, metadata, status, channel_type, vendor_id
  )
  VALUES (
    p_user_id, p_session_id, p_guest_name, p_guest_email, p_subject,
    p_department, p_metadata, 'waiting', p_channel_type, p_vendor_id
  )
  RETURNING id INTO v_conversation_id;

  IF p_initial_message IS NOT NULL THEN
    INSERT INTO chat_messages (conversation_id, sender_type, sender_id, sender_name, content)
    VALUES (v_conversation_id, 'customer', p_user_id, COALESCE(p_guest_name, 'Customer'), p_initial_message)
    RETURNING id INTO v_message_id;
  END IF;

  INSERT INTO chat_messages (conversation_id, sender_type, content)
  VALUES (v_conversation_id, 'system',
    CASE p_channel_type
      WHEN 'customer_vendor' THEN 'Thank you for contacting the vendor. They will respond shortly.'
      WHEN 'vendor_admin' THEN 'Thank you for contacting support. An admin will be with you shortly.'
      ELSE 'Thank you for contacting us. You''ll be connected to the next available agent shortly.'
    END
  );

  RETURN QUERY SELECT v_conversation_id, v_message_id;
END;
$$;

-- 6. RLS policies for vendor access to their conversations
DROP POLICY IF EXISTS "Vendors can view their conversations" ON chat_conversations;
CREATE POLICY "Vendors can view their conversations" ON chat_conversations
  FOR SELECT USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Vendors can update their conversations" ON chat_conversations;
CREATE POLICY "Vendors can update their conversations" ON chat_conversations
  FOR UPDATE USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Vendors can view messages in their conversations" ON chat_messages;
CREATE POLICY "Vendors can view messages in their conversations" ON chat_messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT cc.id FROM chat_conversations cc
      WHERE cc.vendor_id IN (
        SELECT id FROM vendors WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Vendors can insert messages in their conversations" ON chat_messages;
CREATE POLICY "Vendors can insert messages in their conversations" ON chat_messages
  FOR INSERT WITH CHECK (
    conversation_id IN (
      SELECT cc.id FROM chat_conversations cc
      WHERE cc.vendor_id IN (
        SELECT id FROM vendors WHERE user_id = auth.uid()
      )
    )
  );

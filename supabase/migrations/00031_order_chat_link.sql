-- Migration: Link chat conversations to orders (AliExpress-style order chat)
-- Allows customers to chat with vendors about specific orders

-- Add order_id and order context columns to chat_conversations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'chat_conversations'
      AND column_name = 'order_id'
  ) THEN
    ALTER TABLE public.chat_conversations
      ADD COLUMN order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'chat_conversations'
      AND column_name = 'order_number'
  ) THEN
    ALTER TABLE public.chat_conversations
      ADD COLUMN order_number TEXT;
  END IF;
END $$;

-- Index for looking up conversations by order
CREATE INDEX IF NOT EXISTS idx_chat_conversations_order_id
  ON public.chat_conversations(order_id)
  WHERE order_id IS NOT NULL;

-- Composite index: find order chats for a specific vendor
CREATE INDEX IF NOT EXISTS idx_chat_conversations_vendor_order
  ON public.chat_conversations(vendor_id, order_id)
  WHERE order_id IS NOT NULL AND vendor_id IS NOT NULL;

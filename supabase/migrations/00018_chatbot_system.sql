-- =====================================================
-- AI CHATBOT SYSTEM MIGRATION
-- =====================================================

-- Chatbot intents and responses
CREATE TABLE IF NOT EXISTS chatbot_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  priority INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Training phrases for intent matching
CREATE TABLE IF NOT EXISTS chatbot_training_phrases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id UUID NOT NULL REFERENCES chatbot_intents(id) ON DELETE CASCADE,
  phrase TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Responses for each intent
CREATE TABLE IF NOT EXISTS chatbot_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id UUID NOT NULL REFERENCES chatbot_intents(id) ON DELETE CASCADE,
  response_text TEXT NOT NULL,
  response_type TEXT DEFAULT 'text' CHECK (response_type IN ('text', 'quick_reply', 'card', 'carousel')),
  quick_replies JSONB DEFAULT '[]', -- Array of {text, value}
  card_data JSONB DEFAULT '{}', -- For product cards, order info, etc.
  follow_up_intent TEXT, -- Next intent to suggest
  priority INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chatbot conversation context
CREATE TABLE IF NOT EXISTS chatbot_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE,
  session_id TEXT,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  current_intent TEXT,
  context JSONB DEFAULT '{}', -- Store order_id, product_id, etc.
  is_bot_active BOOLEAN DEFAULT TRUE,
  handoff_requested BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chatbot FAQ for quick matching
CREATE TABLE IF NOT EXISTS chatbot_faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  keywords TEXT[], -- For search matching
  view_count INT DEFAULT 0,
  helpful_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chatbot settings
CREATE TABLE IF NOT EXISTS chatbot_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chatbot_training_intent ON chatbot_training_phrases(intent_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_responses_intent ON chatbot_responses(intent_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_conversations_session ON chatbot_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_faqs_category ON chatbot_faqs(category);
CREATE INDEX IF NOT EXISTS idx_chatbot_faqs_keywords ON chatbot_faqs USING GIN(keywords);

-- Enable RLS
ALTER TABLE chatbot_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_training_phrases ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_settings ENABLE ROW LEVEL SECURITY;

-- Public read for intents and FAQs (bot needs to access)
CREATE POLICY "Public read chatbot intents"
  ON chatbot_intents FOR SELECT USING (is_active = true);

CREATE POLICY "Public read training phrases"
  ON chatbot_training_phrases FOR SELECT USING (true);

CREATE POLICY "Public read chatbot responses"
  ON chatbot_responses FOR SELECT USING (is_active = true);

CREATE POLICY "Public read chatbot FAQs"
  ON chatbot_faqs FOR SELECT USING (is_active = true);

CREATE POLICY "Public read chatbot settings"
  ON chatbot_settings FOR SELECT USING (true);

-- Anyone can create/update their conversation context
CREATE POLICY "Users can manage their bot conversations"
  ON chatbot_conversations FOR ALL USING (true);

-- Admins can manage everything
CREATE POLICY "Admins manage chatbot intents"
  ON chatbot_intents FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins manage training phrases"
  ON chatbot_training_phrases FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins manage chatbot responses"
  ON chatbot_responses FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins manage chatbot FAQs"
  ON chatbot_faqs FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins manage chatbot settings"
  ON chatbot_settings FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Function to find best matching intent
CREATE OR REPLACE FUNCTION match_chatbot_intent(p_message TEXT)
RETURNS TABLE (
  intent_name TEXT,
  confidence FLOAT,
  response_text TEXT,
  response_type TEXT,
  quick_replies JSONB,
  card_data JSONB,
  follow_up_intent TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_message_lower TEXT;
  v_words TEXT[];
BEGIN
  v_message_lower := LOWER(TRIM(p_message));
  v_words := regexp_split_to_array(v_message_lower, '\s+');

  RETURN QUERY
  WITH intent_scores AS (
    SELECT
      i.name AS intent_name,
      -- Calculate confidence based on phrase matching
      MAX(
        CASE
          WHEN v_message_lower = LOWER(tp.phrase) THEN 1.0
          WHEN v_message_lower LIKE '%' || LOWER(tp.phrase) || '%' THEN 0.9
          WHEN LOWER(tp.phrase) LIKE '%' || v_message_lower || '%' THEN 0.8
          ELSE (
            -- Word overlap score
            (SELECT COUNT(*)::FLOAT FROM unnest(v_words) w
             WHERE LOWER(tp.phrase) LIKE '%' || w || '%') /
            GREATEST(array_length(v_words, 1), 1)::FLOAT * 0.7
          )
        END
      ) AS confidence,
      i.priority
    FROM chatbot_intents i
    JOIN chatbot_training_phrases tp ON tp.intent_id = i.id
    WHERE i.is_active = true
    GROUP BY i.name, i.priority
    HAVING MAX(
      CASE
        WHEN v_message_lower = LOWER(tp.phrase) THEN 1.0
        WHEN v_message_lower LIKE '%' || LOWER(tp.phrase) || '%' THEN 0.9
        WHEN LOWER(tp.phrase) LIKE '%' || v_message_lower || '%' THEN 0.8
        ELSE (
          (SELECT COUNT(*)::FLOAT FROM unnest(v_words) w
           WHERE LOWER(tp.phrase) LIKE '%' || w || '%') /
          GREATEST(array_length(v_words, 1), 1)::FLOAT * 0.7
        )
      END
    ) >= 0.3
  )
  SELECT
    s.intent_name,
    s.confidence,
    r.response_text,
    r.response_type,
    r.quick_replies,
    r.card_data,
    r.follow_up_intent
  FROM intent_scores s
  JOIN chatbot_intents i ON i.name = s.intent_name
  JOIN chatbot_responses r ON r.intent_id = i.id AND r.is_active = true
  ORDER BY s.confidence DESC, s.priority DESC, r.priority DESC
  LIMIT 1;
END;
$$;

-- Function to search FAQs
CREATE OR REPLACE FUNCTION search_chatbot_faqs(p_query TEXT, p_limit INT DEFAULT 5)
RETURNS TABLE (
  id UUID,
  question TEXT,
  answer TEXT,
  category TEXT,
  relevance FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_query_lower TEXT;
  v_words TEXT[];
BEGIN
  v_query_lower := LOWER(TRIM(p_query));
  v_words := regexp_split_to_array(v_query_lower, '\s+');

  RETURN QUERY
  SELECT
    f.id,
    f.question,
    f.answer,
    f.category,
    -- Calculate relevance
    GREATEST(
      CASE WHEN LOWER(f.question) LIKE '%' || v_query_lower || '%' THEN 0.9 ELSE 0 END,
      CASE WHEN LOWER(f.answer) LIKE '%' || v_query_lower || '%' THEN 0.7 ELSE 0 END,
      (SELECT COUNT(*)::FLOAT FROM unnest(v_words) w
       WHERE LOWER(f.question) LIKE '%' || w || '%' OR w = ANY(f.keywords)) /
      GREATEST(array_length(v_words, 1), 1)::FLOAT * 0.8
    ) AS relevance
  FROM chatbot_faqs f
  WHERE f.is_active = true
    AND (
      LOWER(f.question) LIKE '%' || v_query_lower || '%'
      OR LOWER(f.answer) LIKE '%' || v_query_lower || '%'
      OR EXISTS (SELECT 1 FROM unnest(v_words) w WHERE w = ANY(f.keywords))
      OR EXISTS (SELECT 1 FROM unnest(v_words) w WHERE LOWER(f.question) LIKE '%' || w || '%')
    )
  ORDER BY relevance DESC, f.view_count DESC, f.sort_order ASC
  LIMIT p_limit;
END;
$$;

-- Insert default intents and responses
INSERT INTO chatbot_intents (name, description, priority) VALUES
  ('greeting', 'User greets the bot', 100),
  ('goodbye', 'User says goodbye', 90),
  ('order_status', 'User asks about order status', 85),
  ('track_order', 'User wants to track an order', 85),
  ('delivery_info', 'Questions about delivery', 80),
  ('return_policy', 'Questions about returns', 80),
  ('refund_status', 'Questions about refunds', 80),
  ('product_availability', 'Check if product is available', 75),
  ('payment_methods', 'Questions about payment options', 70),
  ('contact_human', 'User wants to speak to a human', 95),
  ('hours_operation', 'Store hours and availability', 60),
  ('shipping_cost', 'Questions about delivery fees', 70),
  ('cancel_order', 'User wants to cancel order', 85),
  ('account_help', 'Account related questions', 65),
  ('promotions', 'Questions about deals and offers', 60),
  ('complaint', 'User has a complaint', 90),
  ('thanks', 'User says thank you', 50),
  ('fallback', 'No intent matched', 0)
ON CONFLICT (name) DO NOTHING;

-- Insert training phrases
INSERT INTO chatbot_training_phrases (intent_id, phrase)
SELECT id, phrase FROM chatbot_intents, unnest(ARRAY[
  'hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'hi there', 'hey there'
]) AS phrase WHERE name = 'greeting';

INSERT INTO chatbot_training_phrases (intent_id, phrase)
SELECT id, phrase FROM chatbot_intents, unnest(ARRAY[
  'bye', 'goodbye', 'see you', 'thanks bye', 'that''s all', 'nothing else', 'i''m done'
]) AS phrase WHERE name = 'goodbye';

INSERT INTO chatbot_training_phrases (intent_id, phrase)
SELECT id, phrase FROM chatbot_intents, unnest(ARRAY[
  'where is my order', 'order status', 'check my order', 'what happened to my order',
  'when will my order arrive', 'order update', 'my order', 'status of my order'
]) AS phrase WHERE name = 'order_status';

INSERT INTO chatbot_training_phrases (intent_id, phrase)
SELECT id, phrase FROM chatbot_intents, unnest(ARRAY[
  'track order', 'track my order', 'tracking number', 'track delivery', 'where is my delivery',
  'delivery tracking', 'track package', 'order tracking'
]) AS phrase WHERE name = 'track_order';

INSERT INTO chatbot_training_phrases (intent_id, phrase)
SELECT id, phrase FROM chatbot_intents, unnest(ARRAY[
  'delivery', 'when will it arrive', 'delivery time', 'delivery date', 'how long for delivery',
  'delivery options', 'same day delivery', 'next day delivery', 'delivery slots'
]) AS phrase WHERE name = 'delivery_info';

INSERT INTO chatbot_training_phrases (intent_id, phrase)
SELECT id, phrase FROM chatbot_intents, unnest(ARRAY[
  'return', 'return policy', 'how to return', 'can i return', 'return item',
  'send back', 'exchange', 'return process', 'returns'
]) AS phrase WHERE name = 'return_policy';

INSERT INTO chatbot_training_phrases (intent_id, phrase)
SELECT id, phrase FROM chatbot_intents, unnest(ARRAY[
  'refund', 'refund status', 'where is my refund', 'when will i get refund', 'money back',
  'get my money back', 'refund process', 'refund time'
]) AS phrase WHERE name = 'refund_status';

INSERT INTO chatbot_training_phrases (intent_id, phrase)
SELECT id, phrase FROM chatbot_intents, unnest(ARRAY[
  'in stock', 'available', 'do you have', 'is it available', 'stock',
  'out of stock', 'back in stock', 'availability'
]) AS phrase WHERE name = 'product_availability';

INSERT INTO chatbot_training_phrases (intent_id, phrase)
SELECT id, phrase FROM chatbot_intents, unnest(ARRAY[
  'payment', 'payment methods', 'how to pay', 'can i pay with', 'accept card',
  'credit card', 'debit card', 'apple pay', 'google pay', 'paypal'
]) AS phrase WHERE name = 'payment_methods';

INSERT INTO chatbot_training_phrases (intent_id, phrase)
SELECT id, phrase FROM chatbot_intents, unnest(ARRAY[
  'speak to human', 'talk to agent', 'real person', 'human agent', 'speak to someone',
  'talk to someone', 'customer service', 'agent please', 'transfer to agent', 'live agent'
]) AS phrase WHERE name = 'contact_human';

INSERT INTO chatbot_training_phrases (intent_id, phrase)
SELECT id, phrase FROM chatbot_intents, unnest(ARRAY[
  'opening hours', 'store hours', 'when are you open', 'business hours', 'working hours',
  'what time', 'hours of operation', 'open today'
]) AS phrase WHERE name = 'hours_operation';

INSERT INTO chatbot_training_phrases (intent_id, phrase)
SELECT id, phrase FROM chatbot_intents, unnest(ARRAY[
  'shipping cost', 'delivery fee', 'how much for delivery', 'delivery charge',
  'free delivery', 'shipping fee', 'delivery price', 'cost of delivery'
]) AS phrase WHERE name = 'shipping_cost';

INSERT INTO chatbot_training_phrases (intent_id, phrase)
SELECT id, phrase FROM chatbot_intents, unnest(ARRAY[
  'cancel order', 'cancel my order', 'want to cancel', 'stop my order',
  'don''t want order', 'cancellation', 'how to cancel'
]) AS phrase WHERE name = 'cancel_order';

INSERT INTO chatbot_training_phrases (intent_id, phrase)
SELECT id, phrase FROM chatbot_intents, unnest(ARRAY[
  'account', 'my account', 'login problem', 'can''t login', 'password reset',
  'forgot password', 'account issue', 'sign in', 'register'
]) AS phrase WHERE name = 'account_help';

INSERT INTO chatbot_training_phrases (intent_id, phrase)
SELECT id, phrase FROM chatbot_intents, unnest(ARRAY[
  'deals', 'offers', 'discount', 'promo code', 'coupon', 'sale',
  'promotions', 'special offers', 'discount code'
]) AS phrase WHERE name = 'promotions';

INSERT INTO chatbot_training_phrases (intent_id, phrase)
SELECT id, phrase FROM chatbot_intents, unnest(ARRAY[
  'complaint', 'not happy', 'disappointed', 'problem with order', 'issue',
  'terrible service', 'bad experience', 'wrong item', 'damaged'
]) AS phrase WHERE name = 'complaint';

INSERT INTO chatbot_training_phrases (intent_id, phrase)
SELECT id, phrase FROM chatbot_intents, unnest(ARRAY[
  'thank you', 'thanks', 'cheers', 'appreciate it', 'thank u', 'ty'
]) AS phrase WHERE name = 'thanks';

-- Insert responses
INSERT INTO chatbot_responses (intent_id, response_text, response_type, quick_replies) VALUES
-- Greeting
((SELECT id FROM chatbot_intents WHERE name = 'greeting'),
 'Hello! Welcome to FreshMart. I''m your virtual assistant. How can I help you today?',
 'quick_reply',
 '[{"text": "Track my order", "value": "track_order"}, {"text": "Delivery info", "value": "delivery_info"}, {"text": "Talk to agent", "value": "contact_human"}]'),

-- Goodbye
((SELECT id FROM chatbot_intents WHERE name = 'goodbye'),
 'Thank you for chatting with us! Have a great day. If you need anything else, I''m always here to help.',
 'text', '[]'),

-- Order Status
((SELECT id FROM chatbot_intents WHERE name = 'order_status'),
 'I can help you check your order status! Please provide your order number (e.g., ORD-XXXXX) or the email address used for your order.',
 'quick_reply',
 '[{"text": "Track with order number", "value": "track_order"}, {"text": "Talk to agent", "value": "contact_human"}]'),

-- Track Order
((SELECT id FROM chatbot_intents WHERE name = 'track_order'),
 'To track your order, please visit our order tracking page or provide your order number here. You can find your order number in your confirmation email.',
 'quick_reply',
 '[{"text": "Go to tracking page", "value": "link:/track-order"}, {"text": "I have my order number", "value": "order_status"}]'),

-- Delivery Info
((SELECT id FROM chatbot_intents WHERE name = 'delivery_info'),
 'We offer flexible delivery options:\n\n• **Same Day Delivery** - Order before 2pm for delivery today (select areas)\n• **Next Day Delivery** - Order before midnight\n• **Choose Your Slot** - Pick a 2-hour window that suits you\n\nDelivery is FREE on orders over £50!',
 'quick_reply',
 '[{"text": "Delivery fees", "value": "shipping_cost"}, {"text": "Track my order", "value": "track_order"}]'),

-- Return Policy
((SELECT id FROM chatbot_intents WHERE name = 'return_policy'),
 'Our returns policy:\n\n• **Fresh products**: Report within 24 hours of delivery\n• **Non-perishables**: Return within 14 days unopened\n• **Damaged items**: Full refund or replacement\n\nTo start a return, go to your order in My Account or contact our team.',
 'quick_reply',
 '[{"text": "Start a return", "value": "link:/account/orders"}, {"text": "Talk to agent", "value": "contact_human"}]'),

-- Refund Status
((SELECT id FROM chatbot_intents WHERE name = 'refund_status'),
 'Refunds are typically processed within 3-5 business days after we receive the returned item. The money will appear in your account within 5-10 business days depending on your bank.\n\nWould you like me to connect you with an agent to check a specific refund?',
 'quick_reply',
 '[{"text": "Yes, check my refund", "value": "contact_human"}, {"text": "That answers my question", "value": "thanks"}]'),

-- Product Availability
((SELECT id FROM chatbot_intents WHERE name = 'product_availability'),
 'You can check product availability by searching on our website. If an item shows "Out of Stock", you can click "Notify Me" to get an alert when it''s back!\n\nIs there a specific product you''re looking for?',
 'quick_reply',
 '[{"text": "Browse products", "value": "link:/products"}, {"text": "Talk to agent", "value": "contact_human"}]'),

-- Payment Methods
((SELECT id FROM chatbot_intents WHERE name = 'payment_methods'),
 'We accept the following payment methods:\n\n• Credit & Debit Cards (Visa, Mastercard, Amex)\n• Apple Pay\n• Google Pay\n• PayPal\n\nAll payments are secure and encrypted.',
 'text', '[]'),

-- Contact Human
((SELECT id FROM chatbot_intents WHERE name = 'contact_human'),
 'I''ll connect you with a customer service agent right away. Please hold on while I transfer you...',
 'text', '[]'),

-- Hours of Operation
((SELECT id FROM chatbot_intents WHERE name = 'hours_operation'),
 'Our customer service is available:\n\n• **Live Chat**: 24/7\n• **Phone**: Mon-Sat 8am-8pm, Sun 10am-6pm\n• **Email**: Response within 24 hours\n\nDelivery slots are available 7 days a week, 7am-10pm.',
 'text', '[]'),

-- Shipping Cost
((SELECT id FROM chatbot_intents WHERE name = 'shipping_cost'),
 'Delivery fees:\n\n• Orders over £50: **FREE**\n• Standard delivery: £3.99\n• Express same-day: £5.99\n\nSome areas may have different rates. Enter your postcode at checkout to see exact fees.',
 'quick_reply',
 '[{"text": "Check my postcode", "value": "link:/checkout"}, {"text": "More delivery info", "value": "delivery_info"}]'),

-- Cancel Order
((SELECT id FROM chatbot_intents WHERE name = 'cancel_order'),
 'To cancel an order:\n\n1. Go to **My Account > Orders**\n2. Find your order and click **Cancel**\n\n⚠️ Orders can only be cancelled before they''re dispatched. If your order is already out for delivery, please refuse the delivery or contact us.',
 'quick_reply',
 '[{"text": "Go to my orders", "value": "link:/account/orders"}, {"text": "Talk to agent", "value": "contact_human"}]'),

-- Account Help
((SELECT id FROM chatbot_intents WHERE name = 'account_help'),
 'I can help with account issues!\n\n• **Forgot password?** Click "Forgot Password" on the login page\n• **Can''t login?** Try clearing your browser cache\n• **Update details?** Go to My Account > Settings\n\nWhat specific help do you need?',
 'quick_reply',
 '[{"text": "Reset password", "value": "link:/auth/forgot-password"}, {"text": "Talk to agent", "value": "contact_human"}]'),

-- Promotions
((SELECT id FROM chatbot_intents WHERE name = 'promotions'),
 'Check out our current offers:\n\n• **Flash Deals** - Up to 50% off selected items\n• **Multi-buy offers** - Save when you buy more\n• **New customer?** Get 10% off with code WELCOME10\n\nVisit our Deals page to see all current promotions!',
 'quick_reply',
 '[{"text": "View deals", "value": "link:/deals"}, {"text": "Apply coupon", "value": "link:/checkout"}]'),

-- Complaint
((SELECT id FROM chatbot_intents WHERE name = 'complaint'),
 'I''m really sorry to hear you''ve had a problem. Your feedback is important to us and I want to make this right.\n\nLet me connect you with a customer service agent who can help resolve this immediately.',
 'text', '[]'),

-- Thanks
((SELECT id FROM chatbot_intents WHERE name = 'thanks'),
 'You''re welcome! Is there anything else I can help you with?',
 'quick_reply',
 '[{"text": "No, that''s all", "value": "goodbye"}, {"text": "Yes, another question", "value": "greeting"}]'),

-- Fallback
((SELECT id FROM chatbot_intents WHERE name = 'fallback'),
 'I''m not sure I understood that. Could you try rephrasing, or would you like to speak with a customer service agent?',
 'quick_reply',
 '[{"text": "Talk to agent", "value": "contact_human"}, {"text": "Show main menu", "value": "greeting"}]');

-- Insert default FAQs
INSERT INTO chatbot_faqs (question, answer, category, keywords) VALUES
('How do I track my order?',
 'You can track your order by visiting the "Track Order" page and entering your order number and email. You''ll find your order number in your confirmation email.',
 'orders', ARRAY['track', 'order', 'tracking', 'delivery', 'where']),

('What are your delivery charges?',
 'Delivery is FREE on orders over £50. Standard delivery is £3.99, and express same-day delivery is £5.99.',
 'delivery', ARRAY['delivery', 'shipping', 'cost', 'fee', 'charge', 'free']),

('How do I return an item?',
 'To return an item, go to My Account > Orders, find your order and click "Return Item". Fresh products must be reported within 24 hours, other items within 14 days.',
 'returns', ARRAY['return', 'refund', 'send back', 'exchange']),

('When will I receive my refund?',
 'Refunds are processed within 3-5 business days after we receive the return. It may take an additional 5-10 days for the money to appear in your account.',
 'returns', ARRAY['refund', 'money back', 'when', 'how long']),

('What payment methods do you accept?',
 'We accept Visa, Mastercard, American Express, Apple Pay, Google Pay, and PayPal. All payments are secure and encrypted.',
 'payment', ARRAY['payment', 'pay', 'card', 'visa', 'mastercard', 'paypal']),

('How do I cancel my order?',
 'You can cancel your order from My Account > Orders before it''s dispatched. Click on the order and select "Cancel Order". Once dispatched, please refuse delivery or contact us.',
 'orders', ARRAY['cancel', 'cancellation', 'stop order']),

('Do you offer same-day delivery?',
 'Yes! Same-day delivery is available for orders placed before 2pm in select areas. Choose "Express Delivery" at checkout.',
 'delivery', ARRAY['same day', 'today', 'express', 'fast', 'quick']),

('How do I use a promo code?',
 'Enter your promo code in the "Discount Code" field at checkout and click Apply. The discount will be shown in your order total.',
 'promotions', ARRAY['promo', 'code', 'discount', 'coupon', 'voucher']),

('What if my item arrives damaged?',
 'We''re sorry if your item arrived damaged. Please contact us within 24 hours with photos of the damage and we''ll arrange a full refund or replacement.',
 'returns', ARRAY['damaged', 'broken', 'wrong', 'missing']),

('How do I create an account?',
 'Click "Sign Up" at the top of the page, enter your email and create a password. You can also checkout as a guest without creating an account.',
 'account', ARRAY['account', 'sign up', 'register', 'create']);

-- Insert default settings
INSERT INTO chatbot_settings (setting_key, setting_value, description) VALUES
('bot_name', '"FreshBot"', 'Name of the chatbot'),
('welcome_message', '"Hi! I''m FreshBot, your virtual assistant. How can I help you today?"', 'Initial greeting message'),
('fallback_threshold', '0.3', 'Minimum confidence to match an intent'),
('handoff_keywords', '["agent", "human", "person", "representative", "speak to someone"]', 'Keywords that trigger handoff'),
('typing_delay_ms', '1000', 'Simulated typing delay in milliseconds'),
('bot_avatar', '"/images/bot-avatar.png"', 'Bot avatar image URL'),
('is_enabled', 'true', 'Whether chatbot is active')
ON CONFLICT (setting_key) DO NOTHING;

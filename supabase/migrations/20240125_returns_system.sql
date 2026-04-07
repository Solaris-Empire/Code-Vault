-- Returns/Refunds System
-- Full workflow for handling customer returns and refunds

-- Return request status enum
CREATE TYPE return_status AS ENUM (
  'pending',           -- Customer submitted return request
  'approved',          -- Admin approved the return
  'rejected',          -- Admin rejected the return
  'items_received',    -- Returned items received at warehouse
  'inspecting',        -- Items being inspected
  'refund_processing', -- Refund being processed
  'refunded',          -- Refund completed
  'cancelled'          -- Customer cancelled request
);

-- Return reason enum
CREATE TYPE return_reason AS ENUM (
  'damaged',           -- Item arrived damaged
  'wrong_item',        -- Wrong item received
  'not_as_described',  -- Item not as described
  'quality_issue',     -- Quality not satisfactory
  'changed_mind',      -- Customer changed mind
  'expired',           -- Item expired or near expiry
  'missing_items',     -- Items missing from order
  'other'              -- Other reason
);

-- Refund method enum
CREATE TYPE refund_method AS ENUM (
  'original_payment',  -- Refund to original payment method
  'store_credit',      -- Issue store credit
  'bank_transfer',     -- Direct bank transfer
  'replacement'        -- Send replacement instead
);

-- Returns table
CREATE TABLE IF NOT EXISTS returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number VARCHAR(20) UNIQUE NOT NULL,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,

  -- Status tracking
  status return_status NOT NULL DEFAULT 'pending',

  -- Return details
  reason return_reason NOT NULL,
  reason_details TEXT,

  -- Refund information
  refund_method refund_method,
  refund_amount_pence INTEGER DEFAULT 0,
  refund_reference VARCHAR(100),

  -- Admin handling
  handled_by UUID REFERENCES auth.users(id),
  admin_notes TEXT,
  rejection_reason TEXT,

  -- Tracking
  return_tracking_number VARCHAR(100),
  return_carrier VARCHAR(50),

  -- Proof/evidence
  images TEXT[], -- Array of image URLs

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

-- Return items (which items from the order are being returned)
CREATE TABLE IF NOT EXISTS return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,

  -- Quantity
  quantity INTEGER NOT NULL CHECK (quantity > 0),

  -- Item condition on receipt
  condition VARCHAR(50), -- 'unopened', 'opened', 'damaged', 'used'
  condition_notes TEXT,

  -- Refund for this item
  refund_amount_pence INTEGER DEFAULT 0,

  -- Restock decision
  restock BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Return status history for audit trail
CREATE TABLE IF NOT EXISTS return_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  old_status return_status,
  new_status return_status NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Store credits for refunds
CREATE TABLE IF NOT EXISTS store_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  return_id UUID REFERENCES returns(id) ON DELETE SET NULL,

  -- Credit details
  code VARCHAR(20) UNIQUE NOT NULL,
  amount_pence INTEGER NOT NULL CHECK (amount_pence > 0),
  remaining_pence INTEGER NOT NULL CHECK (remaining_pence >= 0),

  -- Validity
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,

  -- Usage
  used_at TIMESTAMPTZ,
  used_on_order_id UUID REFERENCES orders(id),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_returns_order_id ON returns(order_id);
CREATE INDEX idx_returns_user_id ON returns(user_id);
CREATE INDEX idx_returns_status ON returns(status);
CREATE INDEX idx_returns_created_at ON returns(created_at DESC);
CREATE INDEX idx_return_items_return_id ON return_items(return_id);
CREATE INDEX idx_return_status_history_return_id ON return_status_history(return_id);
CREATE INDEX idx_store_credits_user_id ON store_credits(user_id);
CREATE INDEX idx_store_credits_code ON store_credits(code);

-- Generate return number function
CREATE OR REPLACE FUNCTION generate_return_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.return_number := 'RET-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
    LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_return_number
  BEFORE INSERT ON returns
  FOR EACH ROW
  EXECUTE FUNCTION generate_return_number();

-- Update timestamp trigger
CREATE TRIGGER update_returns_updated_at
  BEFORE UPDATE ON returns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Status change trigger for history
CREATE OR REPLACE FUNCTION log_return_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO return_status_history (return_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, NEW.handled_by);

    -- Set relevant timestamps
    CASE NEW.status
      WHEN 'approved' THEN NEW.approved_at := NOW();
      WHEN 'items_received' THEN NEW.received_at := NOW();
      WHEN 'refunded' THEN NEW.refunded_at := NOW();
      WHEN 'cancelled' THEN NEW.cancelled_at := NOW();
      ELSE NULL;
    END CASE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER return_status_change
  BEFORE UPDATE ON returns
  FOR EACH ROW
  EXECUTE FUNCTION log_return_status_change();

-- Generate store credit code
CREATE OR REPLACE FUNCTION generate_credit_code()
RETURNS TRIGGER AS $$
BEGIN
  NEW.code := 'SC-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_credit_code
  BEFORE INSERT ON store_credits
  FOR EACH ROW
  WHEN (NEW.code IS NULL)
  EXECUTE FUNCTION generate_credit_code();

-- RLS Policies
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_credits ENABLE ROW LEVEL SECURITY;

-- Users can view their own returns
CREATE POLICY "Users can view own returns"
  ON returns FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create returns for their orders
CREATE POLICY "Users can create returns"
  ON returns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own return items
CREATE POLICY "Users can view own return items"
  ON return_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM returns
      WHERE returns.id = return_items.return_id
      AND returns.user_id = auth.uid()
    )
  );

-- Users can view their store credits
CREATE POLICY "Users can view own credits"
  ON store_credits FOR SELECT
  USING (auth.uid() = user_id);

-- Admin policies (using service role key bypasses RLS)

-- =====================================================
-- DELIVERY SLOTS SYSTEM MIGRATION
-- =====================================================

-- Delivery zones
CREATE TABLE IF NOT EXISTS delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  postcodes TEXT[] NOT NULL, -- Array of postcode prefixes (e.g., 'SW1', 'EC1')
  base_fee_pence INT DEFAULT 0,
  free_delivery_threshold_pence INT, -- Order amount for free delivery
  min_order_pence INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Delivery slot templates (recurring weekly schedule)
CREATE TABLE IF NOT EXISTS delivery_slot_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID REFERENCES delivery_zones(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_orders INT DEFAULT 50,
  price_pence INT DEFAULT 0, -- Slot-specific pricing (e.g., premium for peak times)
  is_express BOOLEAN DEFAULT FALSE, -- Same-day/express delivery
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(zone_id, day_of_week, start_time)
);

-- Drop old delivery_slots table from initial migration (replaced by zone-based system)
DROP TABLE IF EXISTS delivery_slots CASCADE;

-- Actual delivery slots (generated from templates)
CREATE TABLE IF NOT EXISTS delivery_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID REFERENCES delivery_zones(id) ON DELETE CASCADE,
  template_id UUID REFERENCES delivery_slot_templates(id) ON DELETE SET NULL,
  delivery_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_orders INT DEFAULT 50,
  booked_orders INT DEFAULT 0,
  price_pence INT DEFAULT 0,
  is_express BOOLEAN DEFAULT FALSE,
  is_available BOOLEAN DEFAULT TRUE,
  cutoff_time TIMESTAMPTZ, -- Time by which order must be placed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(zone_id, delivery_date, start_time)
);

-- Delivery slot reservations (temporary holds during checkout)
CREATE TABLE IF NOT EXISTS delivery_slot_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES delivery_slots(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL, -- For anonymous users
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  reserved_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL, -- Typically 15-30 minutes
  is_converted BOOLEAN DEFAULT FALSE, -- Whether order was placed
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  UNIQUE(slot_id, session_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_delivery_zones_active ON delivery_zones(is_active);
CREATE INDEX IF NOT EXISTS idx_delivery_slot_templates_zone ON delivery_slot_templates(zone_id);
CREATE INDEX IF NOT EXISTS idx_delivery_slots_zone_date ON delivery_slots(zone_id, delivery_date);
CREATE INDEX IF NOT EXISTS idx_delivery_slots_available ON delivery_slots(is_available, delivery_date);
CREATE INDEX IF NOT EXISTS idx_slot_reservations_expires ON delivery_slot_reservations(expires_at);
CREATE INDEX IF NOT EXISTS idx_slot_reservations_session ON delivery_slot_reservations(session_id);

-- RLS Policies
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_slot_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_slot_reservations ENABLE ROW LEVEL SECURITY;

-- Everyone can view active zones
CREATE POLICY "Everyone can view active zones"
  ON delivery_zones FOR SELECT
  USING (is_active = true);

-- Admins can manage zones
CREATE POLICY "Admins can manage zones"
  ON delivery_zones FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Everyone can view slot templates
CREATE POLICY "Everyone can view slot templates"
  ON delivery_slot_templates FOR SELECT
  USING (is_active = true);

-- Admins can manage templates
CREATE POLICY "Admins can manage templates"
  ON delivery_slot_templates FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Everyone can view available slots
CREATE POLICY "Everyone can view available slots"
  ON delivery_slots FOR SELECT
  USING (is_available = true AND delivery_date >= CURRENT_DATE);

-- Admins can manage slots
CREATE POLICY "Admins can manage slots"
  ON delivery_slots FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Users can manage their reservations
CREATE POLICY "Users can manage reservations"
  ON delivery_slot_reservations FOR ALL
  USING (user_id = auth.uid() OR user_id IS NULL);

-- Function to get zone for a postcode
CREATE OR REPLACE FUNCTION get_delivery_zone_for_postcode(p_postcode TEXT)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_zone_id UUID;
  v_prefix TEXT;
BEGIN
  -- Extract postcode prefix (e.g., 'SW1' from 'SW1A 1AA')
  v_prefix := UPPER(TRIM(SPLIT_PART(p_postcode, ' ', 1)));

  -- Also try shorter prefixes
  SELECT id INTO v_zone_id
  FROM delivery_zones
  WHERE is_active = true
    AND (
      v_prefix = ANY(postcodes)
      OR LEFT(v_prefix, 3) = ANY(postcodes)
      OR LEFT(v_prefix, 2) = ANY(postcodes)
    )
  LIMIT 1;

  RETURN v_zone_id;
END;
$$;

-- Function to generate delivery slots from templates
CREATE OR REPLACE FUNCTION generate_delivery_slots(
  p_zone_id UUID,
  p_start_date DATE,
  p_days INT DEFAULT 14
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_template RECORD;
  v_current_date DATE;
  v_count INT := 0;
  v_cutoff TIMESTAMPTZ;
BEGIN
  FOR i IN 0..(p_days - 1) LOOP
    v_current_date := p_start_date + i;

    FOR v_template IN
      SELECT * FROM delivery_slot_templates
      WHERE zone_id = p_zone_id
        AND is_active = true
        AND day_of_week = EXTRACT(DOW FROM v_current_date)
    LOOP
      -- Calculate cutoff (e.g., 2 hours before slot for same-day, 10pm day before for next-day)
      IF v_template.is_express THEN
        v_cutoff := (v_current_date + v_template.start_time)::TIMESTAMPTZ - INTERVAL '2 hours';
      ELSE
        v_cutoff := (v_current_date - INTERVAL '1 day' + TIME '22:00')::TIMESTAMPTZ;
      END IF;

      INSERT INTO delivery_slots (
        zone_id, template_id, delivery_date, start_time, end_time,
        max_orders, price_pence, is_express, is_available, cutoff_time
      )
      VALUES (
        p_zone_id, v_template.id, v_current_date, v_template.start_time, v_template.end_time,
        v_template.max_orders, v_template.price_pence, v_template.is_express, true, v_cutoff
      )
      ON CONFLICT (zone_id, delivery_date, start_time) DO NOTHING;

      v_count := v_count + 1;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Function to get available slots for a zone
CREATE OR REPLACE FUNCTION get_available_delivery_slots(
  p_zone_id UUID,
  p_start_date DATE DEFAULT CURRENT_DATE,
  p_days INT DEFAULT 7
)
RETURNS TABLE (
  slot_id UUID,
  delivery_date DATE,
  start_time TIME,
  end_time TIME,
  price_pence INT,
  is_express BOOLEAN,
  available_capacity INT,
  is_nearly_full BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- First, ensure slots exist for the period
  PERFORM generate_delivery_slots(p_zone_id, p_start_date, p_days);

  RETURN QUERY
  SELECT
    ds.id AS slot_id,
    ds.delivery_date,
    ds.start_time,
    ds.end_time,
    ds.price_pence,
    ds.is_express,
    (ds.max_orders - ds.booked_orders - COALESCE(
      (SELECT COUNT(*) FROM delivery_slot_reservations dsr
       WHERE dsr.slot_id = ds.id
         AND dsr.expires_at > NOW()
         AND dsr.is_converted = false),
      0
    ))::INT AS available_capacity,
    ((ds.max_orders - ds.booked_orders) <= ds.max_orders * 0.2) AS is_nearly_full
  FROM delivery_slots ds
  WHERE ds.zone_id = p_zone_id
    AND ds.delivery_date >= p_start_date
    AND ds.delivery_date < p_start_date + p_days
    AND ds.is_available = true
    AND ds.cutoff_time > NOW()
    AND (ds.max_orders - ds.booked_orders) > 0
  ORDER BY ds.delivery_date, ds.start_time;
END;
$$;

-- Function to reserve a delivery slot
CREATE OR REPLACE FUNCTION reserve_delivery_slot(
  p_slot_id UUID,
  p_session_id TEXT,
  p_user_id UUID DEFAULT NULL,
  p_duration_minutes INT DEFAULT 15
)
RETURNS TABLE (
  success BOOLEAN,
  reservation_id UUID,
  expires_at TIMESTAMPTZ,
  message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_slot RECORD;
  v_available INT;
  v_reservation_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Get slot details with lock
  SELECT * INTO v_slot
  FROM delivery_slots
  WHERE id = p_slot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TIMESTAMPTZ, 'Slot not found';
    RETURN;
  END IF;

  -- Check if slot is still available
  SELECT (v_slot.max_orders - v_slot.booked_orders - COALESCE(
    (SELECT COUNT(*) FROM delivery_slot_reservations
     WHERE slot_id = p_slot_id
       AND expires_at > NOW()
       AND is_converted = false),
    0
  ))::INT INTO v_available;

  IF v_available <= 0 THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TIMESTAMPTZ, 'No capacity available';
    RETURN;
  END IF;

  -- Check cutoff time
  IF v_slot.cutoff_time <= NOW() THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TIMESTAMPTZ, 'Booking deadline has passed';
    RETURN;
  END IF;

  -- Remove existing reservation for this session
  DELETE FROM delivery_slot_reservations
  WHERE session_id = p_session_id
    AND is_converted = false;

  -- Create new reservation
  v_expires_at := NOW() + (p_duration_minutes || ' minutes')::INTERVAL;

  INSERT INTO delivery_slot_reservations (slot_id, session_id, user_id, expires_at)
  VALUES (p_slot_id, p_session_id, p_user_id, v_expires_at)
  RETURNING id INTO v_reservation_id;

  RETURN QUERY SELECT true, v_reservation_id, v_expires_at, 'Slot reserved successfully';
END;
$$;

-- Function to convert reservation to booking (called when order is placed)
CREATE OR REPLACE FUNCTION convert_slot_reservation(
  p_reservation_id UUID,
  p_order_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_reservation RECORD;
BEGIN
  SELECT * INTO v_reservation
  FROM delivery_slot_reservations
  WHERE id = p_reservation_id
    AND is_converted = false
    AND expires_at > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Update reservation
  UPDATE delivery_slot_reservations
  SET is_converted = true, order_id = p_order_id
  WHERE id = p_reservation_id;

  -- Increment booked orders count
  UPDATE delivery_slots
  SET booked_orders = booked_orders + 1
  WHERE id = v_reservation.slot_id;

  RETURN true;
END;
$$;

-- Function to clean up expired reservations
CREATE OR REPLACE FUNCTION cleanup_expired_slot_reservations()
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INT;
BEGIN
  DELETE FROM delivery_slot_reservations
  WHERE expires_at < NOW()
    AND is_converted = false;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Insert default delivery zones (UK major areas)
INSERT INTO delivery_zones (name, postcodes, base_fee_pence, free_delivery_threshold_pence, min_order_pence) VALUES
  ('Central London', ARRAY['EC1', 'EC2', 'EC3', 'EC4', 'WC1', 'WC2', 'W1', 'SW1'], 299, 5000, 1500),
  ('Greater London', ARRAY['E', 'N', 'NW', 'SE', 'SW', 'W'], 399, 6000, 2000),
  ('Birmingham', ARRAY['B1', 'B2', 'B3', 'B4', 'B5'], 349, 5500, 1500),
  ('Manchester', ARRAY['M1', 'M2', 'M3', 'M4'], 349, 5500, 1500),
  ('Leeds', ARRAY['LS1', 'LS2', 'LS3'], 349, 5500, 1500)
ON CONFLICT DO NOTHING;

-- Insert default slot templates for Central London
DO $$
DECLARE
  v_zone_id UUID;
BEGIN
  SELECT id INTO v_zone_id FROM delivery_zones WHERE name = 'Central London' LIMIT 1;

  IF v_zone_id IS NOT NULL THEN
    -- Weekday slots
    FOR day IN 1..5 LOOP
      INSERT INTO delivery_slot_templates (zone_id, day_of_week, start_time, end_time, max_orders, price_pence, is_express) VALUES
        (v_zone_id, day, '08:00', '10:00', 30, 0, false),
        (v_zone_id, day, '10:00', '12:00', 40, 0, false),
        (v_zone_id, day, '12:00', '14:00', 50, 0, false),
        (v_zone_id, day, '14:00', '16:00', 50, 0, false),
        (v_zone_id, day, '16:00', '18:00', 40, 0, false),
        (v_zone_id, day, '18:00', '20:00', 30, 199, false), -- Premium evening slot
        (v_zone_id, day, '20:00', '22:00', 20, 299, false)  -- Premium late slot
      ON CONFLICT DO NOTHING;
    END LOOP;

    -- Weekend slots
    FOR day IN 0..0 LOOP -- Sunday
      INSERT INTO delivery_slot_templates (zone_id, day_of_week, start_time, end_time, max_orders, price_pence, is_express) VALUES
        (v_zone_id, day, '10:00', '12:00', 30, 0, false),
        (v_zone_id, day, '12:00', '14:00', 40, 0, false),
        (v_zone_id, day, '14:00', '16:00', 40, 0, false),
        (v_zone_id, day, '16:00', '18:00', 30, 0, false)
      ON CONFLICT DO NOTHING;
    END LOOP;

    FOR day IN 6..6 LOOP -- Saturday
      INSERT INTO delivery_slot_templates (zone_id, day_of_week, start_time, end_time, max_orders, price_pence, is_express) VALUES
        (v_zone_id, day, '08:00', '10:00', 30, 0, false),
        (v_zone_id, day, '10:00', '12:00', 40, 0, false),
        (v_zone_id, day, '12:00', '14:00', 50, 0, false),
        (v_zone_id, day, '14:00', '16:00', 50, 0, false),
        (v_zone_id, day, '16:00', '18:00', 40, 0, false),
        (v_zone_id, day, '18:00', '20:00', 30, 199, false)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
END $$;

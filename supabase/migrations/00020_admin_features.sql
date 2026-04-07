-- Migration: Admin Features (Site Settings, Audit Logs, Team Management, Email Templates)
-- Based on features from Mak Wines, CMS, and Scitechasia projects

-- =====================================================
-- SITE SETTINGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS site_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Store Information
    store_name TEXT DEFAULT 'FreshMart',
    store_tagline TEXT DEFAULT 'Fresh Groceries Delivered',
    store_email TEXT,
    store_phone TEXT,
    store_address TEXT,
    store_city TEXT,
    store_postcode TEXT,
    store_country TEXT DEFAULT 'United Kingdom',

    -- Business Hours
    opening_hours JSONB DEFAULT '{
        "monday": {"open": "08:00", "close": "22:00", "closed": false},
        "tuesday": {"open": "08:00", "close": "22:00", "closed": false},
        "wednesday": {"open": "08:00", "close": "22:00", "closed": false},
        "thursday": {"open": "08:00", "close": "22:00", "closed": false},
        "friday": {"open": "08:00", "close": "22:00", "closed": false},
        "saturday": {"open": "09:00", "close": "21:00", "closed": false},
        "sunday": {"open": "10:00", "close": "20:00", "closed": false}
    }'::jsonb,

    -- Social Media
    social_facebook TEXT,
    social_instagram TEXT,
    social_twitter TEXT,
    social_youtube TEXT,
    social_tiktok TEXT,

    -- SEO Settings
    meta_title TEXT,
    meta_description TEXT,
    meta_keywords TEXT[],
    google_analytics_id TEXT,
    facebook_pixel_id TEXT,

    -- Order Settings
    min_order_amount_pence INT DEFAULT 0,
    free_delivery_threshold_pence INT DEFAULT 5000,
    order_prefix TEXT DEFAULT 'FM',
    enable_guest_checkout BOOLEAN DEFAULT true,

    -- Notification Settings
    notify_new_order BOOLEAN DEFAULT true,
    notify_low_stock BOOLEAN DEFAULT true,
    low_stock_threshold INT DEFAULT 10,
    notify_email TEXT,

    -- Display Settings
    products_per_page INT DEFAULT 20,
    enable_reviews BOOLEAN DEFAULT true,
    enable_wishlist BOOLEAN DEFAULT true,
    enable_compare BOOLEAN DEFAULT true,
    maintenance_mode BOOLEAN DEFAULT false,
    maintenance_message TEXT,

    -- Currency & Locale
    currency_code TEXT DEFAULT 'GBP',
    currency_symbol TEXT DEFAULT '£',
    timezone TEXT DEFAULT 'Europe/London',
    date_format TEXT DEFAULT 'DD/MM/YYYY',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings
INSERT INTO site_settings (id) VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

-- =====================================================
-- AUDIT LOGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    user_email TEXT,
    user_role TEXT,

    -- Action Details
    action TEXT NOT NULL, -- create, update, delete, login, logout, export, import, bulk_update
    entity_type TEXT NOT NULL, -- product, order, category, user, settings, etc.
    entity_id TEXT,
    entity_name TEXT,

    -- Change Details
    old_values JSONB,
    new_values JSONB,
    changes JSONB, -- summary of what changed

    -- Request Details
    ip_address INET,
    user_agent TEXT,
    request_method TEXT,
    request_path TEXT,

    -- Additional Context
    metadata JSONB,
    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- =====================================================
-- TEAM MEMBERS / STAFF TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,

    -- Personal Info
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    avatar_url TEXT,

    -- Role & Access
    role TEXT NOT NULL DEFAULT 'staff', -- super_admin, admin, manager, staff, support
    department TEXT, -- operations, customer_service, warehouse, marketing, etc.
    job_title TEXT,

    -- Permissions (granular)
    permissions JSONB DEFAULT '{
        "products": {"view": true, "create": false, "edit": false, "delete": false},
        "orders": {"view": true, "create": false, "edit": false, "delete": false},
        "customers": {"view": true, "create": false, "edit": false, "delete": false},
        "categories": {"view": true, "create": false, "edit": false, "delete": false},
        "vendors": {"view": true, "create": false, "edit": false, "delete": false},
        "reports": {"view": false, "export": false},
        "settings": {"view": false, "edit": false},
        "team": {"view": false, "create": false, "edit": false, "delete": false}
    }'::jsonb,

    -- Status
    status TEXT DEFAULT 'active', -- active, inactive, pending, suspended

    -- Activity Tracking
    last_login_at TIMESTAMPTZ,
    last_login_ip INET,
    failed_login_attempts INT DEFAULT 0,
    locked_until TIMESTAMPTZ,

    -- Invitation
    invited_by UUID REFERENCES profiles(id),
    invited_at TIMESTAMPTZ,
    invitation_token TEXT,
    invitation_expires_at TIMESTAMPTZ,

    -- Settings
    notification_preferences JSONB DEFAULT '{
        "email_new_order": true,
        "email_low_stock": true,
        "email_daily_summary": false,
        "push_notifications": true
    }'::jsonb,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for team members
CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members(email);
CREATE INDEX IF NOT EXISTS idx_team_members_role ON team_members(role);
CREATE INDEX IF NOT EXISTS idx_team_members_status ON team_members(status);

-- =====================================================
-- EMAIL TEMPLATES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Template Info
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    category TEXT NOT NULL, -- order, account, marketing, notification

    -- Template Content
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT,

    -- Variables (what placeholders are available)
    available_variables JSONB DEFAULT '[]'::jsonb,

    -- Status
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false, -- system templates cannot be deleted

    -- Metadata
    last_sent_at TIMESTAMPTZ,
    send_count INT DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default email templates
INSERT INTO email_templates (name, slug, category, subject, body_html, body_text, is_system, available_variables) VALUES
-- Order Confirmation
('Order Confirmation', 'order-confirmation', 'order',
 'Your FreshMart Order #{{order_number}} is Confirmed!',
 '<h1>Thank you for your order!</h1><p>Hi {{customer_name}},</p><p>Your order #{{order_number}} has been confirmed and is being prepared.</p><p><strong>Order Total:</strong> {{order_total}}</p><p>We''ll notify you when it''s on its way!</p><p>Thanks,<br>The FreshMart Team</p>',
 'Thank you for your order! Hi {{customer_name}}, Your order #{{order_number}} has been confirmed. Order Total: {{order_total}}',
 true,
 '["customer_name", "customer_email", "order_number", "order_total", "order_items", "delivery_address", "delivery_date"]'::jsonb),

-- Order Shipped
('Order Shipped', 'order-shipped', 'order',
 'Your FreshMart Order #{{order_number}} is On Its Way!',
 '<h1>Your order is on its way!</h1><p>Hi {{customer_name}},</p><p>Great news! Your order #{{order_number}} is out for delivery.</p><p><strong>Estimated Delivery:</strong> {{delivery_date}}</p><p>Track your order: {{tracking_link}}</p>',
 'Your order #{{order_number}} is on its way! Estimated delivery: {{delivery_date}}',
 true,
 '["customer_name", "order_number", "delivery_date", "tracking_link", "driver_name"]'::jsonb),

-- Order Delivered
('Order Delivered', 'order-delivered', 'order',
 'Your FreshMart Order #{{order_number}} Has Been Delivered!',
 '<h1>Your order has been delivered!</h1><p>Hi {{customer_name}},</p><p>Your order #{{order_number}} has been delivered.</p><p>We hope you enjoy your fresh groceries!</p><p>Leave a review: {{review_link}}</p>',
 'Your order #{{order_number}} has been delivered! We hope you enjoy your fresh groceries.',
 true,
 '["customer_name", "order_number", "review_link"]'::jsonb),

-- Welcome Email
('Welcome Email', 'welcome', 'account',
 'Welcome to FreshMart!',
 '<h1>Welcome to FreshMart!</h1><p>Hi {{customer_name}},</p><p>Thanks for creating an account with us. We''re excited to have you!</p><p>Start shopping now: {{shop_link}}</p>',
 'Welcome to FreshMart! Hi {{customer_name}}, Thanks for creating an account.',
 true,
 '["customer_name", "customer_email", "shop_link"]'::jsonb),

-- Password Reset
('Password Reset', 'password-reset', 'account',
 'Reset Your FreshMart Password',
 '<h1>Reset Your Password</h1><p>Hi {{customer_name}},</p><p>Click the link below to reset your password:</p><p><a href="{{reset_link}}">Reset Password</a></p><p>This link expires in 1 hour.</p>',
 'Reset your password: {{reset_link}}. This link expires in 1 hour.',
 true,
 '["customer_name", "reset_link"]'::jsonb),

-- Low Stock Alert (Admin)
('Low Stock Alert', 'low-stock-alert', 'notification',
 'Low Stock Alert: {{product_name}}',
 '<h1>Low Stock Alert</h1><p>The following product is running low:</p><p><strong>{{product_name}}</strong></p><p>Current Stock: {{stock_quantity}}</p><p>SKU: {{product_sku}}</p><p><a href="{{product_link}}">View Product</a></p>',
 'Low Stock Alert: {{product_name}} has only {{stock_quantity}} units left.',
 true,
 '["product_name", "product_sku", "stock_quantity", "product_link"]'::jsonb),

-- New Order Alert (Admin)
('New Order Alert', 'new-order-alert', 'notification',
 'New Order #{{order_number}} - {{order_total}}',
 '<h1>New Order Received</h1><p>Order #{{order_number}}</p><p><strong>Customer:</strong> {{customer_name}}</p><p><strong>Total:</strong> {{order_total}}</p><p><strong>Items:</strong> {{item_count}}</p><p><a href="{{order_link}}">View Order</a></p>',
 'New Order #{{order_number}} from {{customer_name}} for {{order_total}}',
 true,
 '["order_number", "customer_name", "customer_email", "order_total", "item_count", "order_link"]'::jsonb)

ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- BACKUP LOGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS backup_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_type TEXT NOT NULL, -- full, incremental, database, media
    status TEXT NOT NULL, -- pending, in_progress, completed, failed
    file_path TEXT,
    file_size_bytes BIGINT,
    tables_included TEXT[],
    error_message TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_by UUID REFERENCES profiles(id),
    metadata JSONB
);

-- =====================================================
-- IMPORT/EXPORT JOBS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS import_export_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type TEXT NOT NULL, -- import, export
    entity_type TEXT NOT NULL, -- products, orders, customers, categories
    status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed

    -- File Info
    file_name TEXT,
    file_path TEXT,
    file_size_bytes BIGINT,
    file_format TEXT, -- csv, xlsx, json

    -- Progress
    total_rows INT DEFAULT 0,
    processed_rows INT DEFAULT 0,
    success_count INT DEFAULT 0,
    error_count INT DEFAULT 0,

    -- Results
    errors JSONB DEFAULT '[]'::jsonb,
    warnings JSONB DEFAULT '[]'::jsonb,
    result_summary JSONB,

    -- Timestamps
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id)
);

-- Index for jobs
CREATE INDEX IF NOT EXISTS idx_import_export_jobs_status ON import_export_jobs(status);
CREATE INDEX IF NOT EXISTS idx_import_export_jobs_created ON import_export_jobs(created_at DESC);

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Site Settings - Only admins can modify
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_settings_read" ON site_settings
    FOR SELECT USING (true);

CREATE POLICY "site_settings_write" ON site_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

-- Audit Logs - Admins can read, system writes
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_admin_read" ON audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

-- Team Members - Admins can manage
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_members_read" ON team_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "team_members_write" ON team_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'super_admin'
        )
    );

-- Email Templates - Admins can manage
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_templates_read" ON email_templates
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY "email_templates_write" ON email_templates
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to log an action
CREATE OR REPLACE FUNCTION log_audit_action(
    p_user_id UUID,
    p_action TEXT,
    p_entity_type TEXT,
    p_entity_id TEXT DEFAULT NULL,
    p_entity_name TEXT DEFAULT NULL,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
    v_user_email TEXT;
    v_user_role TEXT;
BEGIN
    -- Get user info
    SELECT email, role INTO v_user_email, v_user_role
    FROM profiles WHERE id = p_user_id;

    INSERT INTO audit_logs (
        user_id, user_email, user_role,
        action, entity_type, entity_id, entity_name,
        old_values, new_values, metadata
    ) VALUES (
        p_user_id, v_user_email, v_user_role,
        p_action, p_entity_type, p_entity_id, p_entity_name,
        p_old_values, p_new_values, p_metadata
    ) RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get site settings (singleton)
CREATE OR REPLACE FUNCTION get_site_settings()
RETURNS site_settings AS $$
DECLARE
    v_settings site_settings;
BEGIN
    SELECT * INTO v_settings FROM site_settings LIMIT 1;

    IF v_settings IS NULL THEN
        INSERT INTO site_settings (id) VALUES (gen_random_uuid())
        RETURNING * INTO v_settings;
    END IF;

    RETURN v_settings;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_site_settings_timestamp
    BEFORE UPDATE ON site_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_team_members_timestamp
    BEFORE UPDATE ON team_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_email_templates_timestamp
    BEFORE UPDATE ON email_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

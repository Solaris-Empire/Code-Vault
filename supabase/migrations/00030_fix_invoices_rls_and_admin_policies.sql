-- =====================================================================
-- Migration 00029: Fix invoices RLS + convert all stale role='admin'
-- policies to use public.is_admin() for super_admin support
-- =====================================================================
-- is_admin() was introduced in 00021 and returns TRUE for both
-- 'admin' and 'super_admin' roles. Many older migrations still use
-- the raw role = 'admin' check, which locks out super_admin users.
-- This migration fixes every remaining instance.
-- =====================================================================

BEGIN;

-- =====================================================================
-- PART 1: Enable RLS on invoices table and add policies
-- =====================================================================

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own invoices" ON public.invoices;
CREATE POLICY "Users can view own invoices" ON public.invoices
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage all invoices" ON public.invoices;
CREATE POLICY "Admins can manage all invoices" ON public.invoices
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Service role full access invoices" ON public.invoices;
CREATE POLICY "Service role full access invoices" ON public.invoices
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================================
-- PART 2: Fix ALL remaining stale role='admin' RLS policies
-- =====================================================================

-- -----------------------------------------------------------------
-- 00001_initial_schema.sql — products
-- -----------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
CREATE POLICY "Admins can insert products" ON public.products
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update products" ON public.products;
CREATE POLICY "Admins can update products" ON public.products
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
CREATE POLICY "Admins can delete products" ON public.products
  FOR DELETE USING (public.is_admin());

-- 00001 — categories
DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
CREATE POLICY "Admins can manage categories" ON public.categories
  FOR ALL USING (public.is_admin());

-- 00001 — product_categories
DROP POLICY IF EXISTS "Admins can manage product categories" ON public.product_categories;
CREATE POLICY "Admins can manage product categories" ON public.product_categories
  FOR ALL USING (public.is_admin());

-- 00001 — profiles (admin view all)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_admin());

-- 00001 — orders (admin view) — NOTE: "Admins can update orders" already fixed in 00026
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
CREATE POLICY "Admins can view all orders" ON public.orders
  FOR SELECT USING (public.is_admin());

-- 00001 — order_items — already fixed in 00026, skip
-- 00001 — delivery_slots — already fixed in 00026, skip

-- -----------------------------------------------------------------
-- 00002_hero_slides.sql
-- -----------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage hero slides" ON public.hero_slides;
CREATE POLICY "Admins can manage hero slides" ON public.hero_slides
  FOR ALL USING (public.is_admin());

-- -----------------------------------------------------------------
-- 00003_store_settings.sql
-- -----------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage settings" ON public.store_settings;
CREATE POLICY "Admins can manage settings" ON public.store_settings
  FOR ALL USING (public.is_admin());

-- -----------------------------------------------------------------
-- All remaining tables wrapped in IF EXISTS to handle missing tables
-- -----------------------------------------------------------------

-- 00004 — multibuy_offers
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'multibuy_offers' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage offers" ON public.multibuy_offers';
    EXECUTE 'CREATE POLICY "Admins can manage offers" ON public.multibuy_offers FOR ALL USING (public.is_admin())';
  END IF;
END $$;

-- 00007 — vendors
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'vendors' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage all vendors" ON public.vendors';
    EXECUTE 'CREATE POLICY "Admins can manage all vendors" ON public.vendors FOR ALL USING (public.is_admin())';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'vendor_applications' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage applications" ON public.vendor_applications';
    EXECUTE 'CREATE POLICY "Admins can manage applications" ON public.vendor_applications FOR ALL USING (public.is_admin())';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'vendor_orders' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage all vendor orders" ON public.vendor_orders';
    EXECUTE 'CREATE POLICY "Admins can manage all vendor orders" ON public.vendor_orders FOR ALL USING (public.is_admin())';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'vendor_payouts' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage payouts" ON public.vendor_payouts';
    EXECUTE 'CREATE POLICY "Admins can manage payouts" ON public.vendor_payouts FOR ALL USING (public.is_admin())';
  END IF;
END $$;

-- 00008 — product_reviews, flash_deals
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'product_reviews' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage all reviews" ON public.product_reviews';
    EXECUTE 'CREATE POLICY "Admins can manage all reviews" ON public.product_reviews FOR ALL USING (public.is_admin())';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'flash_deals' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage deals" ON public.flash_deals';
    EXECUTE 'CREATE POLICY "Admins can manage deals" ON public.flash_deals FOR ALL USING (public.is_admin())';
  END IF;
END $$;

-- 00009 — coupons
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'coupons' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage coupons" ON public.coupons';
    EXECUTE 'CREATE POLICY "Admins can manage coupons" ON public.coupons FOR ALL USING (public.is_admin())';
  END IF;
END $$;

-- 00010 — referral_codes, referrals
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'referral_codes' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage all referral codes" ON public.referral_codes';
    EXECUTE 'CREATE POLICY "Admins can manage all referral codes" ON public.referral_codes FOR ALL USING (public.is_admin())';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'referrals' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage all referrals" ON public.referrals';
    EXECUTE 'CREATE POLICY "Admins can manage all referrals" ON public.referrals FOR ALL USING (public.is_admin())';
  END IF;
END $$;

-- credit_transactions already fixed in 00026, skip

-- 00010a — profiles (update/delete)
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles" ON public.profiles
  FOR DELETE USING (public.is_admin());

-- 00011 — loyalty system
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'loyalty_tiers' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage loyalty tiers" ON public.loyalty_tiers';
    EXECUTE 'CREATE POLICY "Admins can manage loyalty tiers" ON public.loyalty_tiers FOR ALL USING (public.is_admin())';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'loyalty_accounts' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage loyalty accounts" ON public.loyalty_accounts';
    EXECUTE 'CREATE POLICY "Admins can manage loyalty accounts" ON public.loyalty_accounts FOR ALL USING (public.is_admin())';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'points_transactions' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage points transactions" ON public.points_transactions';
    EXECUTE 'CREATE POLICY "Admins can manage points transactions" ON public.points_transactions FOR ALL USING (public.is_admin())';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'points_redemption_rules' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage redemption rules" ON public.points_redemption_rules';
    EXECUTE 'CREATE POLICY "Admins can manage redemption rules" ON public.points_redemption_rules FOR ALL USING (public.is_admin())';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'points_earning_rules' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage earning rules" ON public.points_earning_rules';
    EXECUTE 'CREATE POLICY "Admins can manage earning rules" ON public.points_earning_rules FOR ALL USING (public.is_admin())';
  END IF;
END $$;

-- 00012 — ticket support system
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'support_tickets' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage tickets" ON public.support_tickets';
    EXECUTE 'CREATE POLICY "Admins can manage tickets" ON public.support_tickets FOR ALL USING (public.is_admin())';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'ticket_messages' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage ticket messages" ON public.ticket_messages';
    EXECUTE 'CREATE POLICY "Admins can manage ticket messages" ON public.ticket_messages FOR ALL USING (public.is_admin())';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'ticket_categories' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage categories" ON public.ticket_categories';
    EXECUTE 'CREATE POLICY "Admins can manage categories" ON public.ticket_categories FOR ALL USING (public.is_admin())';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'canned_responses' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage canned responses" ON public.canned_responses';
    EXECUTE 'CREATE POLICY "Admins can manage canned responses" ON public.canned_responses FOR ALL USING (public.is_admin())';
    EXECUTE 'DROP POLICY IF EXISTS "Admins can view canned responses" ON public.canned_responses';
    EXECUTE 'CREATE POLICY "Admins can view canned responses" ON public.canned_responses FOR SELECT USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = ''vendor''))';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'ticket_tags' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage tags" ON public.ticket_tags';
    EXECUTE 'CREATE POLICY "Admins can manage tags" ON public.ticket_tags FOR ALL USING (public.is_admin())';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'ticket_tag_assignments' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage tag assignments" ON public.ticket_tag_assignments';
    EXECUTE 'CREATE POLICY "Admins can manage tag assignments" ON public.ticket_tag_assignments FOR ALL USING (public.is_admin())';
  END IF;
END $$;

-- 00013 — newsletter system
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'newsletter_subscribers' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage subscribers" ON public.newsletter_subscribers';
    EXECUTE 'CREATE POLICY "Admins can manage subscribers" ON public.newsletter_subscribers FOR ALL USING (public.is_admin())';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'newsletter_campaigns' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage campaigns" ON public.newsletter_campaigns';
    EXECUTE 'CREATE POLICY "Admins can manage campaigns" ON public.newsletter_campaigns FOR ALL USING (public.is_admin())';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'email_templates' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage templates" ON public.email_templates';
    EXECUTE 'CREATE POLICY "Admins can manage templates" ON public.email_templates FOR ALL USING (public.is_admin())';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'campaign_send_logs' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can view send logs" ON public.campaign_send_logs';
    EXECUTE 'CREATE POLICY "Admins can view send logs" ON public.campaign_send_logs FOR SELECT USING (public.is_admin())';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'campaign_links' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage links" ON public.campaign_links';
    EXECUTE 'CREATE POLICY "Admins can manage links" ON public.campaign_links FOR ALL USING (public.is_admin())';
  END IF;
END $$;

-- 00014 — notifications
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'notifications' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage notifications" ON public.notifications';
    EXECUTE 'CREATE POLICY "Admins can manage notifications" ON public.notifications FOR ALL USING (public.is_admin())';
  END IF;
END $$;

-- 00015 — recently viewed
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'product_view_history' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can view all view history" ON public.product_view_history';
    EXECUTE 'CREATE POLICY "Admins can view all view history" ON public.product_view_history FOR SELECT USING (public.is_admin())';
  END IF;
END $$;

-- -----------------------------------------------------------------
-- 00016_delivery_slots.sql
-- (The delivery_slots policy from 00001 was already fixed in 00026.
--  These are the additional tables from 00016 — wrapped in IF EXISTS
--  checks since these tables may not have been created yet.)
-- -----------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'delivery_zones' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage zones" ON public.delivery_zones';
    EXECUTE 'CREATE POLICY "Admins can manage zones" ON public.delivery_zones FOR ALL USING (public.is_admin())';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'delivery_slot_templates' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage templates" ON public.delivery_slot_templates';
    EXECUTE 'CREATE POLICY "Admins can manage templates" ON public.delivery_slot_templates FOR ALL USING (public.is_admin())';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'delivery_slots' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage slots" ON public.delivery_slots';
    EXECUTE 'CREATE POLICY "Admins can manage slots" ON public.delivery_slots FOR ALL USING (public.is_admin())';
  END IF;
END $$;

-- -----------------------------------------------------------------
-- 00017_live_chat.sql (wrapped — table may not exist)
-- -----------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'chat_quick_replies' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage quick replies" ON public.chat_quick_replies';
    EXECUTE 'CREATE POLICY "Admins can manage quick replies" ON public.chat_quick_replies FOR ALL USING (public.is_admin())';
  END IF;
END $$;

-- -----------------------------------------------------------------
-- 00018_chatbot_system.sql (wrapped — tables may not exist)
-- -----------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'chatbot_intents' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins manage chatbot intents" ON public.chatbot_intents';
    EXECUTE 'CREATE POLICY "Admins manage chatbot intents" ON public.chatbot_intents FOR ALL USING (public.is_admin())';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'chatbot_training_phrases' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins manage training phrases" ON public.chatbot_training_phrases';
    EXECUTE 'CREATE POLICY "Admins manage training phrases" ON public.chatbot_training_phrases FOR ALL USING (public.is_admin())';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'chatbot_responses' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins manage chatbot responses" ON public.chatbot_responses';
    EXECUTE 'CREATE POLICY "Admins manage chatbot responses" ON public.chatbot_responses FOR ALL USING (public.is_admin())';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'chatbot_faqs' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins manage chatbot FAQs" ON public.chatbot_faqs';
    EXECUTE 'CREATE POLICY "Admins manage chatbot FAQs" ON public.chatbot_faqs FOR ALL USING (public.is_admin())';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'chatbot_settings' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins manage chatbot settings" ON public.chatbot_settings';
    EXECUTE 'CREATE POLICY "Admins manage chatbot settings" ON public.chatbot_settings FOR ALL USING (public.is_admin())';
  END IF;
END $$;

-- -----------------------------------------------------------------
-- 00020_admin_features.sql (wrapped — tables may not exist)
-- -----------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'site_settings' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "site_settings_write" ON public.site_settings';
    EXECUTE 'CREATE POLICY "site_settings_write" ON public.site_settings FOR ALL USING (public.is_admin())';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'audit_logs' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "audit_logs_admin_read" ON public.audit_logs';
    EXECUTE 'CREATE POLICY "audit_logs_admin_read" ON public.audit_logs FOR SELECT USING (public.is_admin())';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'team_members' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "team_members_read" ON public.team_members';
    EXECUTE 'CREATE POLICY "team_members_read" ON public.team_members FOR SELECT USING (public.is_admin())';
  END IF;
END $$;

-- team_members_write stays super_admin-only (intentional restriction)

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'email_templates' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "email_templates_read" ON public.email_templates';
    EXECUTE 'CREATE POLICY "email_templates_read" ON public.email_templates FOR SELECT USING (public.is_admin())';
    EXECUTE 'DROP POLICY IF EXISTS "email_templates_write" ON public.email_templates';
    EXECUTE 'CREATE POLICY "email_templates_write" ON public.email_templates FOR ALL USING (public.is_admin())';
  END IF;
END $$;

COMMIT;

-- Fix: Add 'super_admin' to profiles role CHECK constraint
-- The original constraint only allowed: customer, vendor, admin
-- This prevented super_admin accounts from being created

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('customer', 'vendor', 'admin', 'super_admin'));

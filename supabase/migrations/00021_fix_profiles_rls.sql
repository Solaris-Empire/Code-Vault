-- Fix recursive RLS policies for profiles table
-- The issue is that checking if a user is admin requires querying profiles,
-- which triggers the same RLS check, causing a recursion error

-- First, create a security definer function to check admin status
-- This bypasses RLS and allows safe checking of admin role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = auth.uid();

  RETURN user_role IN ('admin', 'super_admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Recreate policies using the security definer function
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Also fix other tables that use the same pattern
-- Update orders policies
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
CREATE POLICY "Admins can view all orders" ON public.orders
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage orders" ON public.orders;
CREATE POLICY "Admins can manage orders" ON public.orders
  FOR ALL USING (public.is_admin());

-- Update products policies
DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
CREATE POLICY "Admins can manage products" ON public.products
  FOR ALL USING (public.is_admin());

-- Update categories policies
DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
CREATE POLICY "Admins can manage categories" ON public.categories
  FOR ALL USING (public.is_admin());

-- Update product_categories policies
DROP POLICY IF EXISTS "Admins can manage product categories" ON public.product_categories;
CREATE POLICY "Admins can manage product categories" ON public.product_categories
  FOR ALL USING (public.is_admin());

-- Ensure service role can always access profiles (for server-side operations)
-- This is important for API routes that use service role key
CREATE POLICY "Service role full access to profiles" ON public.profiles
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Create function to ensure profile exists for user
CREATE OR REPLACE FUNCTION public.ensure_profile_exists()
RETURNS void AS $$
DECLARE
  user_id UUID;
  user_email TEXT;
BEGIN
  user_id := auth.uid();

  IF user_id IS NOT NULL THEN
    -- Check if profile exists
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id) THEN
      -- Get email from auth.users
      SELECT email INTO user_email FROM auth.users WHERE id = user_id;

      -- Insert profile
      INSERT INTO public.profiles (id, email, full_name, role)
      VALUES (user_id, user_email, '', 'customer')
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.ensure_profile_exists() TO authenticated;

-- =====================================================
-- UPDATE DEFAULT COMMISSION RATE FROM 15% TO 12.5%
-- =====================================================
-- Platform retains 12.5% of each transaction:
--   10.0% platform commission
--    2.5% to cover Stripe processing fees (~1.4-2.9% + 20p)
-- Vendors receive the remaining 87.5%.

-- Update the column default for new vendors
ALTER TABLE public.vendors ALTER COLUMN commission_rate SET DEFAULT 12.50;

-- Update all existing vendors that still have the old 15% default
-- (only if they haven't been given a custom rate)
UPDATE public.vendors
SET commission_rate = 12.50
WHERE commission_rate = 15.00;

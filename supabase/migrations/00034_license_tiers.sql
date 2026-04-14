-- 3-tier licensing: personal / commercial / extended
-- Replaces the old 2-tier regular|extended scheme.

-- 1. Drop the existing CHECK constraint (name varies by Postgres; use DO block)
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class cls ON cls.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
  WHERE nsp.nspname = 'public'
    AND cls.relname = 'licenses'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%license_type%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.licenses DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

-- 2. Migrate existing rows: regular -> personal (extended stays the same)
UPDATE public.licenses SET license_type = 'personal' WHERE license_type = 'regular';

-- 3. Change default + add new CHECK constraint with 3 tiers
ALTER TABLE public.licenses ALTER COLUMN license_type SET DEFAULT 'personal';
ALTER TABLE public.licenses ADD CONSTRAINT licenses_license_type_check
  CHECK (license_type IN ('personal', 'commercial', 'extended'));

-- 4. Optional per-product price overrides (null = use global multipliers)
-- Shape: {"personal": 4900, "commercial": 14900, "extended": 49900}
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS license_prices_cents JSONB;

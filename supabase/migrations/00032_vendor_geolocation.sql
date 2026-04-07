-- Migration: Add geolocation (lat/lng) to vendors for nearest-store sorting

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vendors'
      AND column_name = 'latitude'
  ) THEN
    ALTER TABLE public.vendors
      ADD COLUMN latitude DOUBLE PRECISION,
      ADD COLUMN longitude DOUBLE PRECISION;
  END IF;
END $$;

-- Index for geo queries
CREATE INDEX IF NOT EXISTS idx_vendors_geo
  ON public.vendors(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Haversine distance function (km) — no PostGIS needed
CREATE OR REPLACE FUNCTION haversine_distance(
  lat1 DOUBLE PRECISION,
  lon1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION,
  lon2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 6371 * 2 * ASIN(SQRT(
    POWER(SIN(RADIANS(lat2 - lat1) / 2), 2) +
    COS(RADIANS(lat1)) * COS(RADIANS(lat2)) *
    POWER(SIN(RADIANS(lon2 - lon1) / 2), 2)
  ))
$$;

-- Seed some UK city coordinates for existing vendors
UPDATE public.vendors SET latitude = 51.5074, longitude = -0.1278
  WHERE city ILIKE '%london%' AND latitude IS NULL;

UPDATE public.vendors SET latitude = 52.4862, longitude = -1.8904
  WHERE city ILIKE '%birmingham%' AND latitude IS NULL;

UPDATE public.vendors SET latitude = 53.4808, longitude = -2.2426
  WHERE city ILIKE '%manchester%' AND latitude IS NULL;

UPDATE public.vendors SET latitude = 53.8008, longitude = -1.5491
  WHERE city ILIKE '%leeds%' AND latitude IS NULL;

UPDATE public.vendors SET latitude = 51.4545, longitude = -2.5879
  WHERE city ILIKE '%bristol%' AND latitude IS NULL;

UPDATE public.vendors SET latitude = 55.9533, longitude = -3.1883
  WHERE city ILIKE '%edinburgh%' AND latitude IS NULL;

UPDATE public.vendors SET latitude = 55.8642, longitude = -4.2518
  WHERE city ILIKE '%glasgow%' AND latitude IS NULL;

UPDATE public.vendors SET latitude = 53.4084, longitude = -2.9916
  WHERE city ILIKE '%liverpool%' AND latitude IS NULL;

UPDATE public.vendors SET latitude = 54.9783, longitude = -1.6178
  WHERE city ILIKE '%newcastle%' AND latitude IS NULL;

UPDATE public.vendors SET latitude = 50.7184, longitude = -1.8808
  WHERE city ILIKE '%bournemouth%' AND latitude IS NULL;

UPDATE public.vendors SET latitude = 52.6309, longitude = -1.1398
  WHERE city ILIKE '%leicester%' AND latitude IS NULL;

UPDATE public.vendors SET latitude = 52.9548, longitude = -1.1581
  WHERE city ILIKE '%nottingham%' AND latitude IS NULL;

UPDATE public.vendors SET latitude = 51.4816, longitude = -3.1791
  WHERE city ILIKE '%cardiff%' AND latitude IS NULL;

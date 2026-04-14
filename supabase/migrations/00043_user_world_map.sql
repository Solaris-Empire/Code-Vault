-- World Map of devs/sellers/buyers — Phase 6 Sprint 1
--
-- Privacy-first: a user's pin only shows on the map if they
-- explicitly flip `show_on_map = TRUE`. Even then we only render
-- city-level coordinates by default — exact lat/lng is captured but
-- never returned to the public map endpoint unless the user opts in
-- separately via `share_exact_location`.
--
-- Country code is ISO 3166-1 alpha-2 (e.g. 'US', 'DE', 'IN').

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS country_code           CHAR(2),
  ADD COLUMN IF NOT EXISTS city                   TEXT,
  ADD COLUMN IF NOT EXISTS latitude               NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS longitude              NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS show_on_map            BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS share_exact_location   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS map_bio                TEXT;

-- Partial index — only opted-in users matter for map queries.
CREATE INDEX IF NOT EXISTS idx_users_show_on_map
  ON public.users(country_code, role)
  WHERE show_on_map = TRUE;

-- ─── Public RPC: get_map_pins ──────────────────────────────────────
-- Returns only the fields safe to expose on the public map. Pins for
-- users who haven't opted in are excluded entirely. Exact coords are
-- only returned when share_exact_location is also TRUE; otherwise
-- callers get a null lat/lng and must use country/city for placement.

CREATE OR REPLACE FUNCTION public.get_map_pins(
  p_role TEXT DEFAULT NULL  -- 'seller' | 'buyer' | 'admin' | NULL for all
)
RETURNS TABLE (
  id              UUID,
  display_name    TEXT,
  avatar_url      TEXT,
  role            TEXT,
  country_code    CHAR(2),
  city            TEXT,
  latitude        NUMERIC(9, 6),
  longitude       NUMERIC(9, 6),
  seller_rank_key TEXT,
  buyer_tier      TEXT,
  map_bio         TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    u.id,
    u.display_name,
    u.avatar_url,
    u.role::text,
    u.country_code,
    u.city,
    CASE WHEN u.share_exact_location THEN u.latitude  ELSE NULL END AS latitude,
    CASE WHEN u.share_exact_location THEN u.longitude ELSE NULL END AS longitude,
    u.seller_rank_key,
    u.buyer_tier::text,
    u.map_bio
  FROM public.users u
  WHERE u.show_on_map = TRUE
    AND u.country_code IS NOT NULL
    AND (p_role IS NULL OR u.role::text = p_role);
$$;

GRANT EXECUTE ON FUNCTION public.get_map_pins(TEXT) TO anon, authenticated;

-- DIAGNOSTIC ONLY — do NOT apply as a migration.
-- Paste this whole block into Supabase SQL editor.
-- Every expected object is tagged with its migration file so we can
-- see exactly which migration didn't apply cleanly.

-- ─── 1. Expected TABLES per migration 34-45 ──────────────────────
WITH expected(mig, name) AS (VALUES
  ('00034_license_tiers',           NULL),
  ('00035_product_analyses',        'product_analyses'),
  ('00036_product_ai_visibility',   NULL),
  ('00037_product_ownership',       'product_fingerprints'),
  ('00037_product_ownership',       'product_ownership_checks'),
  ('00038_seller_tiers',            'seller_stats'),
  ('00039_hire_marketplace',        'seller_services'),
  ('00039_hire_marketplace',        'service_orders'),
  ('00039_hire_marketplace',        'service_messages'),
  ('00040_service_reviews_disputes','service_reviews'),
  ('00040_service_reviews_disputes','service_disputes'),
  ('00041_seller_rank_ladder',      'seller_ranks'),
  ('00041_seller_rank_ladder',      'seller_xp_events'),
  ('00042_buyer_perks',             NULL),
  ('00043_user_world_map',          NULL),
  ('00044_devsocial_feed',          'posts'),
  ('00044_devsocial_feed',          'post_likes'),
  ('00044_devsocial_feed',          'post_comments'),
  ('00044_devsocial_feed',          'post_reports'),
  ('00045_tech_jobs_board',         'jobs'),
  ('00045_tech_jobs_board',         'job_applications')
)
SELECT
  '1. tables' AS section,
  e.mig AS migration,
  COALESCE(e.name, '(no new tables)') AS table_name,
  CASE
    WHEN e.name IS NULL THEN '—'
    WHEN t.tablename IS NULL THEN 'MISSING'
    WHEN t.rowsecurity THEN 'present, rls_on'
    ELSE 'present, RLS_OFF'
  END AS status
FROM expected e
LEFT JOIN pg_tables t ON t.schemaname = 'public' AND t.tablename = e.name
ORDER BY e.mig, e.name NULLS FIRST;

-- ─── 2. Expected COLUMNS/CONSTRAINTS per migration 34-45 ─────────
-- (migrations that add columns to existing tables rather than create new ones)
WITH expected(mig, tbl, col) AS (VALUES
  ('00034_license_tiers',         'products',  'license_prices_cents'),
  ('00036_product_ai_visibility', 'products',  'show_ai_detection'),
  ('00041_seller_rank_ladder',    'users',     'seller_xp'),
  ('00041_seller_rank_ladder',    'users',     'seller_rank_sort'),
  ('00042_buyer_perks',           'users',     'buyer_tier'),
  ('00042_buyer_perks',           'users',     'is_premium'),
  ('00042_buyer_perks',           'users',     'premium_expires_at'),
  ('00042_buyer_perks',           'users',     'buyer_purchase_count'),
  ('00042_buyer_perks',           'users',     'buyer_total_spent_cents'),
  ('00043_user_world_map',        'users',     'show_on_map'),
  ('00043_user_world_map',        'users',     'share_exact_location'),
  ('00043_user_world_map',        'users',     'latitude'),
  ('00043_user_world_map',        'users',     'longitude')
)
SELECT
  '2. columns' AS section,
  e.mig AS migration,
  e.tbl || '.' || e.col AS column_name,
  CASE WHEN c.column_name IS NULL THEN 'MISSING' ELSE 'present (' || c.data_type || ')' END AS status
FROM expected e
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public' AND c.table_name = e.tbl AND c.column_name = e.col
ORDER BY e.mig, e.tbl, e.col;

-- ─── 3. Expected FUNCTIONS per migration 34-45 ───────────────────
WITH expected(mig, name) AS (VALUES
  ('00035_product_analyses',        'tg_product_analyses_touch'),
  ('00037_product_ownership',       'tg_product_fingerprints_touch'),
  ('00037_product_ownership',       'tg_product_ownership_checks_touch'),
  ('00038_seller_tiers',            'sync_user_seller_tier'),
  ('00039_hire_marketplace',        'tg_seller_services_touch'),
  ('00039_hire_marketplace',        'tg_service_orders_touch'),
  ('00040_service_reviews_disputes','tg_service_reviews_touch'),
  ('00040_service_reviews_disputes','tg_service_reviews_rollup'),
  ('00041_seller_rank_ladder',      'award_seller_xp'),
  ('00041_seller_rank_ladder',      'grant_invite_rank'),
  ('00042_buyer_perks',             'recompute_buyer_tier'),
  ('00043_user_world_map',          'get_map_pins'),
  ('00044_devsocial_feed',          'posts_like_count_trigger'),
  ('00044_devsocial_feed',          'posts_comment_count_trigger'),
  ('00044_devsocial_feed',          'posts_report_count_trigger'),
  ('00044_devsocial_feed',          'get_feed'),
  ('00044_devsocial_feed',          'get_trending_hashtags'),
  ('00045_tech_jobs_board',         'jobs_application_count_trigger'),
  ('00045_tech_jobs_board',         'list_jobs')
)
SELECT
  '3. functions' AS section,
  e.mig AS migration,
  e.name AS function_name,
  CASE WHEN p.proname IS NULL THEN 'MISSING' ELSE 'present' END AS status,
  CASE WHEN p.prosecdef THEN 'DEFINER' ELSE 'INVOKER' END AS security,
  COALESCE(pg_get_function_identity_arguments(p.oid), '') AS args
FROM expected e
LEFT JOIN pg_proc p ON p.proname = e.name
LEFT JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
ORDER BY e.mig, e.name;

-- ─── 4. Every SECURITY DEFINER function currently in public ──────
-- (so we catch drift — anything here that ISN'T in section 3 is
--  either from an earlier migration or was created by hand)
SELECT
  '4. all SECURITY DEFINER' AS section,
  p.proname AS name,
  pg_get_function_identity_arguments(p.oid) AS args,
  CASE
    WHEN p.proacl IS NULL THEN 'DEFAULT (PUBLIC can EXECUTE — RISK)'
    ELSE pg_catalog.array_to_string(p.proacl, E', ')
  END AS grants
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef = TRUE
ORDER BY p.proname;

-- ─── 5. RLS policies on 34-45 tables ─────────────────────────────
SELECT
  '5. policies' AS section,
  tablename,
  policyname,
  cmd AS command,
  COALESCE(roles::text, '{public}') AS roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'product_analyses', 'product_fingerprints', 'product_ownership_checks',
    'seller_stats', 'seller_services', 'service_orders', 'service_messages',
    'service_reviews', 'service_disputes', 'seller_ranks', 'seller_xp_events',
    'posts', 'post_likes', 'post_comments', 'post_reports',
    'jobs', 'job_applications'
  )
ORDER BY tablename, policyname;

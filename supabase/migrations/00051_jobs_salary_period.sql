-- Phase 7b — Jobs salary period
--
-- Adds a salary_period column so listings can express pay as
-- "$80-120k per year" vs "$60 per hour" vs "$8k per month". Toptal,
-- Upwork and LinkedIn all surface the period next to the range — a
-- single "80000" number with no unit is useless to candidates.
--
-- Default is 'year' because the majority of existing rows come from
-- full-time listings where annual comp is the norm.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS salary_period TEXT NOT NULL DEFAULT 'year'
    CHECK (salary_period IN ('hour', 'day', 'week', 'month', 'year'));

-- Rebuild list_jobs so the card + detail pages can render the period
-- without a second query. Signature stays identical to keep callers
-- working — we just add one more output column.
DROP FUNCTION IF EXISTS public.list_jobs(TEXT, BOOLEAN, TEXT, TEXT, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.list_jobs(
  p_search    TEXT    DEFAULT NULL,
  p_remote    BOOLEAN DEFAULT NULL,
  p_emp_type  TEXT    DEFAULT NULL,
  p_skill     TEXT    DEFAULT NULL,
  p_limit     INTEGER DEFAULT 30,
  p_offset    INTEGER DEFAULT 0
)
RETURNS TABLE (
  id                UUID,
  poster_id         UUID,
  title             TEXT,
  company_name      TEXT,
  company_website   TEXT,
  employment_type   TEXT,
  location          TEXT,
  remote            BOOLEAN,
  salary_min_cents  INTEGER,
  salary_max_cents  INTEGER,
  salary_currency   CHAR(3),
  salary_period     TEXT,
  description       TEXT,
  skills            TEXT[],
  application_count INTEGER,
  created_at        TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ,
  poster_name       TEXT,
  poster_avatar     TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    j.id, j.poster_id, j.title, j.company_name, j.company_website,
    j.employment_type, j.location, j.remote,
    j.salary_min_cents, j.salary_max_cents, j.salary_currency, j.salary_period,
    j.description, j.skills, j.application_count,
    j.created_at, j.expires_at,
    u.display_name AS poster_name,
    u.avatar_url   AS poster_avatar
  FROM public.jobs j
  JOIN public.users u ON u.id = j.poster_id
  WHERE j.status = 'active'
    AND j.expires_at > NOW()
    AND (p_search IS NULL OR
         j.title ILIKE '%' || p_search || '%' OR
         j.company_name ILIKE '%' || p_search || '%' OR
         j.description ILIKE '%' || p_search || '%')
    AND (p_remote   IS NULL OR j.remote = p_remote)
    AND (p_emp_type IS NULL OR j.employment_type = p_emp_type)
    AND (p_skill    IS NULL OR p_skill = ANY(j.skills))
  ORDER BY j.created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 100)
  OFFSET GREATEST(p_offset, 0);
$$;

REVOKE ALL ON FUNCTION public.list_jobs(TEXT, BOOLEAN, TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_jobs(TEXT, BOOLEAN, TEXT, TEXT, INTEGER, INTEGER)
  TO anon, authenticated;

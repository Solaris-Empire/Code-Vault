-- Phase 7 — Tech Jobs Board
--
-- Employers post roles, devs apply with their CodeVault profile (rank
-- + shipped products become the CV). Gated behind FEATURE_JOBS in
-- production; any user role can post initially so both employers and
-- existing sellers can list roles.

CREATE TABLE IF NOT EXISTS public.jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poster_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  title             TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 140),
  company_name      TEXT NOT NULL CHECK (char_length(company_name) BETWEEN 1 AND 120),
  company_website   TEXT,

  -- 'full_time' | 'part_time' | 'contract' | 'internship' | 'freelance'
  employment_type   TEXT NOT NULL DEFAULT 'full_time',

  location          TEXT,
  remote            BOOLEAN NOT NULL DEFAULT TRUE,

  salary_min_cents  INTEGER,
  salary_max_cents  INTEGER,
  salary_currency   CHAR(3) NOT NULL DEFAULT 'USD',

  description       TEXT NOT NULL CHECK (char_length(description) BETWEEN 50 AND 10000),
  requirements      TEXT,
  benefits          TEXT,

  skills            TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

  apply_url         TEXT,      -- external apply link (optional)
  apply_email       TEXT,      -- email for applications (optional)

  status            TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'paused', 'filled', 'expired', 'hidden')),

  view_count        INTEGER NOT NULL DEFAULT 0,
  application_count INTEGER NOT NULL DEFAULT 0,

  expires_at        TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_active_created
  ON public.jobs(created_at DESC)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_jobs_poster
  ON public.jobs(poster_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_jobs_skills
  ON public.jobs USING GIN (skills);

-- ─── Applications ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.job_applications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  applicant_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  cover_letter    TEXT NOT NULL CHECK (char_length(cover_letter) BETWEEN 20 AND 4000),
  portfolio_url   TEXT,
  resume_url      TEXT,
  expected_salary_cents INTEGER,

  -- 'submitted' | 'reviewed' | 'interviewing' | 'offered' | 'rejected' | 'withdrawn'
  status          TEXT NOT NULL DEFAULT 'submitted',

  employer_notes  TEXT,  -- private to employer

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (job_id, applicant_id)
);

CREATE INDEX IF NOT EXISTS idx_applications_job
  ON public.job_applications(job_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_applications_applicant
  ON public.job_applications(applicant_id, created_at DESC);

-- Application-count trigger keeps jobs.application_count fresh.
CREATE OR REPLACE FUNCTION public.jobs_application_count_trigger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.jobs SET application_count = application_count + 1 WHERE id = NEW.job_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.jobs SET application_count = GREATEST(application_count - 1, 0) WHERE id = OLD.job_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_applications_count ON public.job_applications;
CREATE TRIGGER trg_job_applications_count
AFTER INSERT OR DELETE ON public.job_applications
FOR EACH ROW EXECUTE FUNCTION public.jobs_application_count_trigger();

-- ─── RLS ───────────────────────────────────────────────────────────
ALTER TABLE public.jobs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications  ENABLE ROW LEVEL SECURITY;

-- Jobs: active listings are public. Poster sees their own regardless.
DROP POLICY IF EXISTS "jobs_read_active" ON public.jobs;
CREATE POLICY "jobs_read_active" ON public.jobs
  FOR SELECT USING (status = 'active' OR auth.uid() = poster_id);

DROP POLICY IF EXISTS "jobs_insert_own" ON public.jobs;
CREATE POLICY "jobs_insert_own" ON public.jobs
  FOR INSERT WITH CHECK (auth.uid() = poster_id);

DROP POLICY IF EXISTS "jobs_update_own" ON public.jobs;
CREATE POLICY "jobs_update_own" ON public.jobs
  FOR UPDATE USING (auth.uid() = poster_id);

DROP POLICY IF EXISTS "jobs_delete_own" ON public.jobs;
CREATE POLICY "jobs_delete_own" ON public.jobs
  FOR DELETE USING (auth.uid() = poster_id);

-- Applications: applicant sees their own, employer sees ones for their job.
DROP POLICY IF EXISTS "apps_read_applicant" ON public.job_applications;
CREATE POLICY "apps_read_applicant" ON public.job_applications
  FOR SELECT USING (auth.uid() = applicant_id);

DROP POLICY IF EXISTS "apps_read_employer" ON public.job_applications;
CREATE POLICY "apps_read_employer" ON public.job_applications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_applications.job_id AND j.poster_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "apps_insert_self" ON public.job_applications;
CREATE POLICY "apps_insert_self" ON public.job_applications
  FOR INSERT WITH CHECK (auth.uid() = applicant_id);

DROP POLICY IF EXISTS "apps_update_own" ON public.job_applications;
CREATE POLICY "apps_update_own" ON public.job_applications
  FOR UPDATE USING (auth.uid() = applicant_id);

DROP POLICY IF EXISTS "apps_update_employer" ON public.job_applications;
CREATE POLICY "apps_update_employer" ON public.job_applications
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_applications.job_id AND j.poster_id = auth.uid()
    )
  );

-- ─── List RPC — joins poster data for card rendering ───────────────
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
AS $$
  SELECT
    j.id, j.poster_id, j.title, j.company_name, j.company_website,
    j.employment_type, j.location, j.remote,
    j.salary_min_cents, j.salary_max_cents, j.salary_currency,
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

GRANT EXECUTE ON FUNCTION public.list_jobs(TEXT, BOOLEAN, TEXT, TEXT, INTEGER, INTEGER)
  TO anon, authenticated;

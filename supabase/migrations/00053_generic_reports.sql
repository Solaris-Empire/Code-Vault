-- Phase 8 — Generic report / flag system
--
-- Polymorphic so one row handles jobs, products, users, reviews,
-- job_applications, and anything we add later. The target lives in
-- (target_type, target_id) — no FK, because different targets hit
-- different tables and we don't want cascade-delete losing the
-- moderation trail when the offending row is removed.
--
-- Reports are admin-only to read (via RLS), rate-limited to one per
-- (reporter, target) via UNIQUE so a single user cannot flood a queue.

CREATE TYPE public.report_target_type AS ENUM (
  'job', 'product', 'user', 'review', 'job_application', 'service', 'post'
);

CREATE TYPE public.report_reason AS ENUM (
  'spam',
  'scam',
  'fraud',
  'illegal',
  'harassment',
  'infringement',
  'misrepresentation',
  'other'
);

CREATE TYPE public.report_status AS ENUM (
  'open', 'reviewing', 'actioned', 'dismissed'
);

CREATE TABLE IF NOT EXISTS public.reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_type   public.report_target_type NOT NULL,
  target_id     UUID NOT NULL,
  reason        public.report_reason NOT NULL,
  details       TEXT CHECK (details IS NULL OR char_length(details) <= 2000),
  status        public.report_status NOT NULL DEFAULT 'open',
  resolved_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at   TIMESTAMPTZ,
  resolution_note TEXT CHECK (resolution_note IS NULL OR char_length(resolution_note) <= 2000),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (reporter_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_reports_open
  ON public.reports (created_at DESC)
  WHERE status IN ('open', 'reviewing');

CREATE INDEX IF NOT EXISTS idx_reports_target
  ON public.reports (target_type, target_id);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can file a report, but only about their own
-- identity (so the API can't be used to inject reports from other
-- accounts).
DROP POLICY IF EXISTS reports_insert_self ON public.reports;
CREATE POLICY reports_insert_self ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

-- Admins can read and update the queue. Nobody else reads reports —
-- not even the reporter, to stop retaliation.
DROP POLICY IF EXISTS reports_admin_read ON public.reports;
CREATE POLICY reports_admin_read ON public.reports
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

DROP POLICY IF EXISTS reports_admin_update ON public.reports;
CREATE POLICY reports_admin_update ON public.reports
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

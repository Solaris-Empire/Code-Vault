-- Phase 8 — Transactional email foundation
--
-- Two pieces:
--   1. email_log     — audit row per send so we can debug bounces,
--                      prove delivery in disputes, and dedupe retries.
--   2. notification_preferences  — per-user opt-outs (everything
--      defaults to ON; opt-out only). Structured JSONB so new email
--      types can be added without a migration.
--
-- We do NOT gate sends on a column being true — we gate on the key
-- being absent or === true in the JSONB. Opt-out is the exception.

-- ─── email_log ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email       TEXT NOT NULL,
  to_user_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  kind           TEXT NOT NULL,  -- e.g. 'order_confirmation', 'new_sale'
  subject        TEXT NOT NULL,
  resend_id      TEXT,           -- Resend's message id, null when stubbed
  status         TEXT NOT NULL DEFAULT 'sent'
                   CHECK (status IN ('sent', 'failed', 'skipped')),
  error          TEXT,
  dedupe_key     TEXT UNIQUE,    -- e.g. 'order_confirmation:<order_id>'
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_log_user
  ON public.email_log(to_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_log_kind
  ON public.email_log(kind, created_at DESC);

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read the log; the service role (used by the mailer)
-- bypasses RLS already.
CREATE POLICY email_log_admin_read ON public.email_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- ─── notification_preferences on users ────────────────────────────
-- Absent key = opted in. Only false values are stored, so deleting
-- the row's JSONB re-opts the user into everything.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB
  NOT NULL DEFAULT '{}'::jsonb;

-- Code Valuator Phase 4: ownership & authenticity verification.
--
-- Two new tables:
--
-- 1. product_fingerprints
--    Per-product structural + content hash so we can detect when two
--    different sellers upload overlapping code (copy-paste theft inside
--    the marketplace).
--
-- 2. product_ownership_checks
--    Per-product authenticity report: git authorship, license, copyright
--    headers, obfuscation signals, internal fingerprint matches, and
--    public GitHub repo matches. Headline `verdict` is what admins and
--    buyers see ("verified" / "ok" / "suspicious" / "stolen").
--
-- Both are upserted once per product by the background analyzer (see
-- src/lib/analysis/store.ts). Public SELECT so buyers can see the
-- verdict badge; writes are service-role only.

-- ─── product_fingerprints ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.product_fingerprints (
  product_id UUID PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,

  -- SHA-256 of the sorted file-path list. Identical trees hash the same.
  structure_hash TEXT NOT NULL,

  -- Up to 40 SHA-256 hashes of the largest source files. Used for
  -- overlap checks even when the project structure differs.
  file_hashes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

  -- How many source files we considered in total (for context).
  total_source_files INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast equality lookup on structure
CREATE INDEX IF NOT EXISTS idx_product_fingerprints_structure
  ON public.product_fingerprints (structure_hash);

-- GIN index on the file_hashes array for "has any of these hashes" queries
CREATE INDEX IF NOT EXISTS idx_product_fingerprints_file_hashes
  ON public.product_fingerprints USING GIN (file_hashes);

-- Touch trigger
CREATE OR REPLACE FUNCTION public.tg_product_fingerprints_touch()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS product_fingerprints_touch ON public.product_fingerprints;
CREATE TRIGGER product_fingerprints_touch
  BEFORE UPDATE ON public.product_fingerprints
  FOR EACH ROW EXECUTE FUNCTION public.tg_product_fingerprints_touch();

-- RLS: service role only (no public read — fingerprint hashes are internal)
ALTER TABLE public.product_fingerprints ENABLE ROW LEVEL SECURITY;

-- ─── product_ownership_checks ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.product_ownership_checks (
  product_id UUID PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,

  -- Headline verdict shown on the product page
  verdict TEXT NOT NULL DEFAULT 'unknown'
    CHECK (verdict IN ('verified', 'ok', 'suspicious', 'stolen', 'unknown')),

  -- 0-100 score computed from the collected signals
  authenticity_score INTEGER NOT NULL DEFAULT 0
    CHECK (authenticity_score BETWEEN 0 AND 100),

  -- Detected license classification
  license_name TEXT,
  license_classification TEXT
    CHECK (license_classification IN (
      'commercial-safe', 'copyleft', 'non-commercial', 'proprietary', 'unknown'
    )),
  license_allows_resale BOOLEAN DEFAULT TRUE,

  -- Git authorship summary
  git_present BOOLEAN NOT NULL DEFAULT FALSE,
  git_unique_authors INTEGER NOT NULL DEFAULT 0,
  git_matches_seller BOOLEAN NOT NULL DEFAULT FALSE,

  -- Copyright header summary
  copyright_holders_count INTEGER NOT NULL DEFAULT 0,

  -- Obfuscation summary
  obfuscated_file_count INTEGER NOT NULL DEFAULT 0,

  -- Internal fingerprint overlap
  fingerprint_matches INTEGER NOT NULL DEFAULT 0,

  -- Public GitHub repo overlap
  github_match_count INTEGER NOT NULL DEFAULT 0,

  -- Full signal list + raw findings (array of objects). UI reads from here.
  signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lookup by verdict for admin review queue
CREATE INDEX IF NOT EXISTS idx_product_ownership_verdict
  ON public.product_ownership_checks (verdict);

-- Touch trigger
CREATE OR REPLACE FUNCTION public.tg_product_ownership_checks_touch()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS product_ownership_checks_touch ON public.product_ownership_checks;
CREATE TRIGGER product_ownership_checks_touch
  BEFORE UPDATE ON public.product_ownership_checks
  FOR EACH ROW EXECUTE FUNCTION public.tg_product_ownership_checks_touch();

-- RLS: public read of the headline verdict (buyers see the badge),
-- service role only writes.
ALTER TABLE public.product_ownership_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read ownership checks" ON public.product_ownership_checks;
CREATE POLICY "public read ownership checks"
  ON public.product_ownership_checks FOR SELECT
  USING (true);

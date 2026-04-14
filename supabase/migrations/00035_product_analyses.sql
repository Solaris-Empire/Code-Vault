-- Code Valuator Phase 1: per-product static analysis reports.
-- Stores objective metrics (LOC, languages, deps, comment ratio, red flags)
-- computed server-side when a seller uploads a product. Each product has
-- at most one current analysis; we upsert on new uploads/edits.

CREATE TABLE IF NOT EXISTS public.product_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,

  -- Headline score (0-100) and grade (A-F) derived from metrics
  quality_score INTEGER NOT NULL CHECK (quality_score BETWEEN 0 AND 100),
  grade TEXT NOT NULL CHECK (grade IN ('A', 'B', 'C', 'D', 'F')),

  -- Summary numbers (duplicated from report JSON for fast sorting/filtering)
  total_loc INTEGER NOT NULL DEFAULT 0,
  total_files INTEGER NOT NULL DEFAULT 0,
  dependency_count INTEGER NOT NULL DEFAULT 0,
  issue_count INTEGER NOT NULL DEFAULT 0,

  -- Full report blob: languages[], issues[], metrics, red flags, etc.
  report JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Engine version so we know which analyzer produced this report
  analyzer_version TEXT NOT NULL DEFAULT '1.0.0',

  -- Status: pending (queued/running), completed, failed
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  error_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One row per product (we upsert on reanalysis)
  CONSTRAINT product_analyses_product_id_unique UNIQUE (product_id)
);

-- Lookup index for sort-by-quality on listings
CREATE INDEX IF NOT EXISTS idx_product_analyses_quality_score
  ON public.product_analyses (quality_score DESC);

-- Keep updated_at fresh on upsert
CREATE OR REPLACE FUNCTION public.tg_product_analyses_touch()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS product_analyses_touch ON public.product_analyses;
CREATE TRIGGER product_analyses_touch
  BEFORE UPDATE ON public.product_analyses
  FOR EACH ROW EXECUTE FUNCTION public.tg_product_analyses_touch();

-- RLS: public read (anyone can see quality reports), only service role writes
ALTER TABLE public.product_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read product_analyses" ON public.product_analyses;
CREATE POLICY "public read product_analyses"
  ON public.product_analyses FOR SELECT
  USING (true);

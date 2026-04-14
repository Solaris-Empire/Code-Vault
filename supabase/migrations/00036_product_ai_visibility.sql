-- Sellers can choose whether to show the AI-code-detection result on the
-- public product page. Defaults to true (transparency by default).

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS show_ai_detection BOOLEAN NOT NULL DEFAULT true;

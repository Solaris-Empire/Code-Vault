-- Add weight_grams column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_grams INTEGER DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN products.weight_grams IS 'Product weight in grams';

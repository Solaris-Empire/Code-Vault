-- Add emoji column to categories table
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS emoji TEXT;

-- Update existing categories with emojis
UPDATE public.categories SET emoji = '🥬' WHERE slug = 'fruits-vegetables';
UPDATE public.categories SET emoji = '🥩' WHERE slug = 'meat-poultry';
UPDATE public.categories SET emoji = '🐟' WHERE slug = 'fish-seafood';
UPDATE public.categories SET emoji = '🥛' WHERE slug = 'dairy-eggs';
UPDATE public.categories SET emoji = '🥐' WHERE slug = 'bakery';
UPDATE public.categories SET emoji = '🧊' WHERE slug = 'frozen';
UPDATE public.categories SET emoji = '🥫' WHERE slug = 'pantry';
UPDATE public.categories SET emoji = '🍹' WHERE slug = 'drinks';
UPDATE public.categories SET emoji = '🍿' WHERE slug = 'snacks-sweets';
UPDATE public.categories SET emoji = '🍷' WHERE slug = 'alcohol';
UPDATE public.categories SET emoji = '🧹' WHERE slug = 'household';
UPDATE public.categories SET emoji = '💊' WHERE slug = 'health-beauty';

-- Alternative slug mappings
UPDATE public.categories SET emoji = '🥩' WHERE slug = 'meat-seafood' AND emoji IS NULL;
UPDATE public.categories SET emoji = '🧊' WHERE slug = 'frozen-foods' AND emoji IS NULL;
UPDATE public.categories SET emoji = '🍹' WHERE slug = 'beverages' AND emoji IS NULL;
UPDATE public.categories SET emoji = '🍿' WHERE slug = 'snacks' AND emoji IS NULL;

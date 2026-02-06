-- Migration: Add Weight Column to Products Table
-- Adds a weight column to store product weight in pounds (lbs)

ALTER TABLE products
ADD COLUMN IF NOT EXISTS weight DECIMAL(10,3) DEFAULT NULL;

COMMENT ON COLUMN products.weight IS 'Product weight in pounds (lbs), used for shipping calculations';

SELECT 'Migration complete! Added weight column to products table.' as message;

-- Verify the column was added
SELECT column_name, data_type, character_maximum_length, numeric_precision, numeric_scale, is_nullable
FROM information_schema.columns
WHERE table_name = 'products'
  AND column_name = 'weight';

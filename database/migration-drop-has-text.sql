-- Migration: Drop has_text column from orders table
-- The has_text boolean has been replaced with custom_engraving text field

-- Drop the has_text column
ALTER TABLE orders
DROP COLUMN IF EXISTS has_text;

SELECT 'Migration complete! Dropped has_text column from orders table.' as message;

-- Verify the column was removed
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'orders'
  AND column_name = 'has_text';

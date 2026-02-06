-- Migration: Replace has_text boolean with custom_engraving text field
-- This allows storing actual engraving text instead of just a boolean flag

-- Add custom_engraving column
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS custom_engraving TEXT DEFAULT NULL;

COMMENT ON COLUMN orders.custom_engraving IS 'Custom engraving text for the order (replaces has_text boolean)';

-- Optionally migrate existing has_text values
-- (Set custom_engraving to 'Custom engraving requested' for orders where has_text = true)
UPDATE orders
SET custom_engraving = 'Custom engraving requested'
WHERE has_text = true AND (custom_engraving IS NULL OR custom_engraving = '');

-- Drop the old has_text column (uncomment if you want to remove it completely)
-- ALTER TABLE orders DROP COLUMN IF EXISTS has_text;

SELECT 'Migration complete! Added custom_engraving column to orders table.' as message;

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'orders'
  AND column_name = 'custom_engraving';

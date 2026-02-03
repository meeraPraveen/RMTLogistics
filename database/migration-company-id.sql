-- Migration: Add company_id column to users table
-- Allows users to be associated with a company

-- Add company_id column
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id INTEGER;

-- Create index for company_id lookups
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);

-- Add comment for documentation
COMMENT ON COLUMN users.company_id IS 'Foreign key to companies table - associates user with a company';

SELECT 'Migration complete! Added company_id column to users table.' as message;

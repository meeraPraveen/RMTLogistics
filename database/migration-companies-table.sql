-- Migration: Create companies table
-- Stores company/organization information for multi-tenant support

-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id VARCHAR(255) UNIQUE,
    name VARCHAR(255) NOT NULL,
    enabled_modules JSONB DEFAULT '["order_management"]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_companies_org_id ON companies(org_id);
CREATE INDEX IF NOT EXISTS idx_companies_is_active ON companies(is_active);

-- Add foreign key constraint to users table (company_id references companies)
-- First, we need to change users.company_id from INTEGER to UUID
ALTER TABLE users DROP COLUMN IF EXISTS company_id;
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- Create index for users.company_id
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);

-- Update orders table: change company_id from INTEGER to UUID
ALTER TABLE orders DROP COLUMN IF EXISTS company_id;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- Create index for orders.company_id
CREATE INDEX IF NOT EXISTS idx_orders_company_id ON orders(company_id);

-- Add comments for documentation
COMMENT ON TABLE companies IS 'Companies/organizations for multi-tenant support';
COMMENT ON COLUMN companies.id IS 'Unique identifier (UUID)';
COMMENT ON COLUMN companies.org_id IS 'External organization ID (e.g., from Auth0 Organizations)';
COMMENT ON COLUMN companies.name IS 'Company display name';
COMMENT ON COLUMN companies.enabled_modules IS 'JSON array of enabled module names for this company';
COMMENT ON COLUMN companies.is_active IS 'Whether the company account is active';
COMMENT ON COLUMN users.company_id IS 'Foreign key to companies table';
COMMENT ON COLUMN orders.company_id IS 'Foreign key to companies table';

SELECT 'Migration complete! Created companies table and updated users/orders company_id to UUID.' as message;

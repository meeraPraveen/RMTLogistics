-- ============================================================
-- CONSOLIDATED DATABASE MIGRATION SCRIPT
-- ============================================================
-- This script consolidates all individual migrations into a single deployment script
-- Run this on a fresh database that has the base schema (users, role_permissions, audit_log)
-- Latest changes override older ones where conflicts exist
-- ============================================================

BEGIN;

-- ============================================================
-- 1. USER MANAGEMENT ENHANCEMENTS
-- ============================================================

-- Add user management fields (name, is_active, last_login)
ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;

-- Make email unique
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_email_unique'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
    END IF;
END $$;

-- Add index for is_active lookups
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Update existing users to be active by default
UPDATE users SET is_active = true WHERE is_active IS NULL;

-- Add comments
COMMENT ON COLUMN users.name IS 'User full name or display name';
COMMENT ON COLUMN users.is_active IS 'Whether user account is active (can access system)';
COMMENT ON COLUMN users.last_login IS 'Timestamp of users last login to the system';

-- Add status column for invite-only system
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
UPDATE users SET status = 'active' WHERE status IS NULL OR status = 'invited';
COMMENT ON COLUMN users.status IS 'User status: active (can access), suspended (blocked)';

-- Make role column nullable for deferred role assignment
ALTER TABLE users ALTER COLUMN role DROP NOT NULL;
ALTER TABLE users ALTER COLUMN role DROP DEFAULT;

-- ============================================================
-- 2. COMPANIES TABLE (UUID VERSION - LATEST)
-- ============================================================

-- Create companies table with UUID
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id VARCHAR(255) UNIQUE,
    name VARCHAR(255) NOT NULL,
    enabled_modules JSONB DEFAULT '["order_management"]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for companies
CREATE INDEX IF NOT EXISTS idx_companies_org_id ON companies(org_id);
CREATE INDEX IF NOT EXISTS idx_companies_is_active ON companies(is_active);

-- Add comments for companies
COMMENT ON TABLE companies IS 'Companies/organizations for multi-tenant support';
COMMENT ON COLUMN companies.id IS 'Unique identifier (UUID)';
COMMENT ON COLUMN companies.org_id IS 'External organization ID (e.g., from Auth0 Organizations)';
COMMENT ON COLUMN companies.name IS 'Company display name';
COMMENT ON COLUMN companies.enabled_modules IS 'JSON array of enabled module names for this company';
COMMENT ON COLUMN companies.is_active IS 'Whether the company account is active';

-- Add shipping_address to companies
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS shipping_address JSONB DEFAULT NULL;

COMMENT ON COLUMN companies.shipping_address IS 'Company shipping address in JSON format: {name, line1, line2, city, state, zip, country}';
CREATE INDEX IF NOT EXISTS idx_companies_shipping_address ON companies USING GIN (shipping_address);

-- ============================================================
-- 3. LINK USERS TO COMPANIES
-- ============================================================

-- Add company_id to users table (UUID foreign key)
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
COMMENT ON COLUMN users.company_id IS 'Foreign key to companies table - associates user with a company';

-- ============================================================
-- 4. PRODUCTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,

  -- Product identification
  sku VARCHAR(50) UNIQUE NOT NULL,

  -- Parsed SKU components (NULL for parent SKUs like CRYS-HRT)
  product_line VARCHAR(20),
  shape VARCHAR(50),
  size VARCHAR(20),
  base_type VARCHAR(20),
  orientation VARCHAR(20),

  -- Descriptive
  display_name VARCHAR(255) NOT NULL,

  -- Parent/variant relationship
  is_parent BOOLEAN DEFAULT false,
  parent_sku VARCHAR(50),

  -- Pricing
  price DECIMAL(10,2) NOT NULL,

  -- Weight for shipping
  weight DECIMAL(10,3) DEFAULT NULL,

  -- Inventory
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 50,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for products
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_shape ON products(shape);
CREATE INDEX IF NOT EXISTS idx_products_size ON products(size);
CREATE INDEX IF NOT EXISTS idx_products_base_type ON products(base_type);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_is_parent ON products(is_parent);
CREATE INDEX IF NOT EXISTS idx_products_parent_sku ON products(parent_sku);
CREATE INDEX IF NOT EXISTS idx_products_stock_low
  ON products(stock_quantity) WHERE is_active = true;

-- Auto-update trigger for products
CREATE OR REPLACE FUNCTION update_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_products_updated_at_trigger ON products;
CREATE TRIGGER update_products_updated_at_trigger
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_products_updated_at();

-- Comments for products
COMMENT ON TABLE products IS 'Product catalog for crystal photo engraving inventory';
COMMENT ON COLUMN products.sku IS 'Unique product SKU, format: CRYS-SHAPE-SIZE-BASE-ORIENT';
COMMENT ON COLUMN products.weight IS 'Product weight in pounds (lbs), used for shipping calculations';
COMMENT ON COLUMN products.is_parent IS 'True for parent/family SKUs (e.g., CRYS-HRT) that group variants';
COMMENT ON COLUMN products.parent_sku IS 'References the parent SKU for variant products';
COMMENT ON COLUMN products.low_stock_threshold IS 'Alert threshold - product shows as low stock when quantity drops below this';

-- ============================================================
-- 5. ORDERS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,

  -- Internal tracking
  internal_order_id VARCHAR(50) UNIQUE NOT NULL,  -- Auto-generated (e.g., ORD-2026-00001)

  -- External platform details
  order_type VARCHAR(20) NOT NULL,  -- 'Amazon', 'Shopify', 'Etsy', 'B2B', 'Personal'
  platform_order_id VARCHAR(100),  -- External order ID (can be NULL for Personal orders)
  order_item_id VARCHAR(100),  -- Item ID within the order

  -- Company reference (UUID foreign key)
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,

  -- Customer information
  customer_email VARCHAR(255) NOT NULL,
  shipping_address JSONB NOT NULL,  -- {name, line1, line2, city, state, zip, country}

  -- Order description
  description TEXT,  -- e.g., "Couple", "Dog", "Family"
  num_figures VARCHAR(20),  -- e.g., "1", "2", "3 +1"

  -- Product specifications
  sku VARCHAR(50),  -- e.g., "CRYS-HRT-SM-N-P" (links to products table)
  product_id VARCHAR(50),  -- Platform product ID (e.g., Amazon ASIN)

  -- Product details
  shape VARCHAR(50),  -- 'Heart', 'Rectangle', 'Square', 'Iceberg', 'Diamond'
  size VARCHAR(20),  -- 'XSmall', 'Small', 'Medium', 'Large', 'XLarge'
  orientation VARCHAR(20),  -- 'Portrait', 'Landscape'
  base_type VARCHAR(20),  -- 'Plain', 'LED'
  dimensions VARCHAR(50),  -- e.g., '7x10x6' (WxHxT in cm)

  -- Image/Background settings
  has_background BOOLEAN DEFAULT false,
  custom_engraving TEXT DEFAULT NULL,  -- Custom engraving text (replaces has_text boolean)

  -- Complementary items
  complementary_items VARCHAR(100),

  -- Pricing
  unit_rate DECIMAL(10,2),
  total_amount DECIMAL(10,2),

  -- Image information (supports multiple images)
  image_name VARCHAR(255),
  image_path VARCHAR(500),

  -- 3D Model information (supports multiple models)
  model_path VARCHAR(1500),  -- Extended to support up to 3 models with long paths

  -- Workflow and status
  status VARCHAR(50) DEFAULT 'Pending',  -- 'Pending', 'Processing', 'Ready to Print', 'Ready For QC', 'Completed', 'Shipped'
  ready_for_print_reached BOOLEAN DEFAULT false,  -- Tracks if order reached Ready for Print stage

  -- Team assignment
  assigned_artist_id INTEGER REFERENCES users(id),
  assigned_qc_id INTEGER REFERENCES users(id),

  -- Comments and feedback
  comments TEXT,  -- Special instructions
  internal_notes TEXT,  -- Internal team notes
  feedback TEXT,  -- Post-completion feedback

  -- Dates
  date_submitted TIMESTAMP,
  date_completed TIMESTAMP,
  date_shipped TIMESTAMP,

  -- Metadata
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  UNIQUE(platform_order_id, order_item_id)
);

-- Indexes for orders
CREATE INDEX IF NOT EXISTS idx_orders_internal_id ON orders(internal_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_platform_id ON orders(platform_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_order_type ON orders(order_type);
CREATE INDEX IF NOT EXISTS idx_orders_sku ON orders(sku);
CREATE INDEX IF NOT EXISTS idx_orders_artist ON orders(assigned_artist_id);
CREATE INDEX IF NOT EXISTS idx_orders_date_submitted ON orders(date_submitted);
CREATE INDEX IF NOT EXISTS idx_orders_company ON orders(company_id);
CREATE INDEX IF NOT EXISTS idx_orders_model_path ON orders(model_path) WHERE model_path IS NOT NULL;

-- Auto-update trigger for orders
CREATE OR REPLACE FUNCTION update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_orders_updated_at_trigger ON orders;
CREATE TRIGGER update_orders_updated_at_trigger
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_orders_updated_at();

-- Comments for orders
COMMENT ON TABLE orders IS 'Main orders table for order management system';
COMMENT ON COLUMN orders.internal_order_id IS 'Auto-generated internal order ID (ORD-YYYY-#####)';
COMMENT ON COLUMN orders.sku IS 'Product SKU (e.g., CRYS-HRT-SM-N-P) - links to products table';
COMMENT ON COLUMN orders.status IS 'Order status: Pending, Processing, Ready to Print, Ready For QC, Completed, Shipped';
COMMENT ON COLUMN orders.shipping_address IS 'Shipping address in JSON: {name, line1, line2, city, state, zip, country}';
COMMENT ON COLUMN orders.custom_engraving IS 'Custom engraving text for the order (replaces has_text boolean)';
COMMENT ON COLUMN orders.model_path IS '3D model file paths in JSON array format (supports up to 3 models with long paths)';
COMMENT ON COLUMN orders.ready_for_print_reached IS 'Tracks if order reached Ready for Print stage (helps distinguish first vs second QC approval)';
COMMENT ON COLUMN orders.company_id IS 'Foreign key to companies table (UUID)';

-- ============================================================
-- 6. FAILED SYNC OPERATIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS failed_sync_operations (
    id SERIAL PRIMARY KEY,
    operation_type VARCHAR(50) NOT NULL,  -- 'delete', 'create', 'update'
    auth0_user_id VARCHAR(255),           -- Auth0 user ID (if known)
    email VARCHAR(255),                   -- User email (for reference)
    payload JSONB,                        -- Original operation data
    error_message TEXT,                   -- Last error message
    retry_count INTEGER DEFAULT 0,        -- Number of retry attempts
    max_retries INTEGER DEFAULT 5,        -- Maximum retry attempts
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_retry_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- Create indexes for failed_sync_operations
CREATE INDEX IF NOT EXISTS idx_failed_sync_status ON failed_sync_operations(status);
CREATE INDEX IF NOT EXISTS idx_failed_sync_operation_type ON failed_sync_operations(operation_type);
CREATE INDEX IF NOT EXISTS idx_failed_sync_created_at ON failed_sync_operations(created_at);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_failed_sync_operations_updated_at ON failed_sync_operations;
CREATE TRIGGER update_failed_sync_operations_updated_at
    BEFORE UPDATE ON failed_sync_operations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments for failed_sync_operations
COMMENT ON TABLE failed_sync_operations IS 'Tracks Auth0 sync operations that failed and need retry';
COMMENT ON COLUMN failed_sync_operations.operation_type IS 'Type of operation: delete, create, or update';
COMMENT ON COLUMN failed_sync_operations.status IS 'Current status: pending (needs retry), completed (succeeded), failed (max retries exceeded)';

-- ============================================================
-- 7. ROLE PERMISSIONS FOR SHIPPING MODULE
-- ============================================================

-- Add shipping module permissions
INSERT INTO role_permissions (role, module, permissions) VALUES
('SuperAdmin', 'shipping', '["read", "write", "update", "delete"]'),
('Admin', 'shipping', '["read", "write", "update", "delete"]'),
('Production Tech', 'shipping', '["read", "write", "update"]')
ON CONFLICT (role, module) DO NOTHING;

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================

COMMIT;

SELECT 'Consolidated migration complete! All tables and columns created successfully.' as message;

-- Verification queries
SELECT 'Users table columns:' as info;
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position;

SELECT 'Companies table columns:' as info;
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'companies' ORDER BY ordinal_position;

SELECT 'Products table columns:' as info;
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'products' ORDER BY ordinal_position;

SELECT 'Orders table columns:' as info;
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'orders' ORDER BY ordinal_position;

SELECT 'Shipping module permissions:' as info;
SELECT role, module, permissions FROM role_permissions WHERE module = 'shipping' ORDER BY role;

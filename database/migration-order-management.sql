-- Migration: Order Management System
-- Creates orders and companies tables for order management module

-- ========================================
-- 1. COMPANIES TABLE (B2B)
-- ========================================

CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,

  -- Company identification
  company_code VARCHAR(50) UNIQUE NOT NULL,  -- Auto-generated (B2B-00001)
  company_name VARCHAR(255) NOT NULL,

  -- Contact information
  contact_person VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),

  -- Address
  address JSONB,  -- {line1, line2, city, state, zip, country}

  -- Business details
  tax_id VARCHAR(100),
  notes TEXT,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for companies
CREATE INDEX IF NOT EXISTS idx_companies_code ON companies(company_code);
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(company_name);
CREATE INDEX IF NOT EXISTS idx_companies_active ON companies(is_active);

-- Auto-update trigger for companies
CREATE OR REPLACE FUNCTION update_companies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_companies_updated_at_trigger
    BEFORE UPDATE ON companies
    FOR EACH ROW
    EXECUTE FUNCTION update_companies_updated_at();

-- Comments for companies
COMMENT ON TABLE companies IS 'B2B companies catalog for order management';
COMMENT ON COLUMN companies.company_code IS 'Auto-generated company code (B2B-00001, B2B-00002, ...)';
COMMENT ON COLUMN companies.address IS 'Company address in JSON format: {line1, line2, city, state, zip, country}';

-- ========================================
-- 2. ORDERS TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,

  -- Internal tracking
  internal_order_id VARCHAR(50) UNIQUE NOT NULL,  -- Auto-generated (e.g., ORD-2026-00001)

  -- External platform details
  order_type VARCHAR(20) NOT NULL,  -- 'Amazon', 'Shopify', 'Etsy', 'B2B', 'Personal'
  platform_order_id VARCHAR(100),  -- External order ID (can be NULL for Personal orders)
  order_item_id VARCHAR(100),  -- Item ID within the order

  -- B2B specific field
  company_id INTEGER REFERENCES companies(id),  -- NULL for non-B2B orders

  -- Customer information
  customer_email VARCHAR(255) NOT NULL,
  shipping_address JSONB NOT NULL,  -- {name, line1, line2, city, state, zip, country}

  -- Order description
  description TEXT,  -- e.g., "Couple", "Dog", "Family"
  num_figures VARCHAR(20),  -- e.g., "1", "2", "3 +1"

  -- Product specifications (for normalization later)
  sku VARCHAR(50),  -- e.g., "CRYS-HRT-SM-N-P" (links to products table in future)
  product_id VARCHAR(50),  -- Platform product ID (e.g., Amazon ASIN)

  -- Product details (will be normalized to products table later)
  shape VARCHAR(50),  -- 'Heart', 'Rectangle', 'Square', 'Iceberg', 'Diamond'
  size VARCHAR(20),  -- 'XSmall', 'Small', 'Medium', 'Large', 'XLarge'
  orientation VARCHAR(20),  -- 'Portrait', 'Landscape'
  base_type VARCHAR(20),  -- 'Plain', 'LED'
  dimensions VARCHAR(50),  -- e.g., '7x10x6' (WxHxT in cm)

  -- Image/Background settings
  has_background BOOLEAN DEFAULT false,
  has_text BOOLEAN DEFAULT false,

  -- Pricing
  unit_rate DECIMAL(10,2),
  total_amount DECIMAL(10,2),

  -- Image information (single image per order for now)
  image_name VARCHAR(255),
  image_path VARCHAR(500),

  -- Workflow and status
  status VARCHAR(50) DEFAULT 'Pending',  -- 'Pending', 'Processing', 'Ready to Print', 'In Progress', 'Completed', 'Shipped'

  -- Team assignment (will reference real users)
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

-- Auto-update trigger for orders
CREATE OR REPLACE FUNCTION update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_orders_updated_at_trigger
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_orders_updated_at();

-- Comments for orders
COMMENT ON TABLE orders IS 'Main orders table - designed for future normalization';
COMMENT ON COLUMN orders.internal_order_id IS 'Auto-generated internal order ID (ORD-YYYY-#####)';
COMMENT ON COLUMN orders.sku IS 'Product SKU (e.g., CRYS-HRT-SM-N-P) - will link to products table later';
COMMENT ON COLUMN orders.status IS 'Order status: Pending, Processing, Ready to Print, In Progress, Completed, Shipped';
COMMENT ON COLUMN orders.shape IS 'Crystal shape - will be normalized to products table later';
COMMENT ON COLUMN orders.size IS 'Product size - will be normalized to products table later';
COMMENT ON COLUMN orders.orientation IS 'Portrait or Landscape - will be normalized to products table later';
COMMENT ON COLUMN orders.base_type IS 'Plain or LED base - will be normalized to products table later';
COMMENT ON COLUMN orders.shipping_address IS 'Shipping address in JSON: {name, line1, line2, city, state, zip, country}';

-- ========================================
-- SUCCESS MESSAGE
-- ========================================

SELECT 'Migration complete! Orders and Companies tables created successfully.' as message;

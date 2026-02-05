-- Migration: Products/Inventory Management
-- Creates the products table for inventory tracking

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

  -- Inventory
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 50,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_shape ON products(shape);
CREATE INDEX IF NOT EXISTS idx_products_size ON products(size);
CREATE INDEX IF NOT EXISTS idx_products_base_type ON products(base_type);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_is_parent ON products(is_parent);
CREATE INDEX IF NOT EXISTS idx_products_parent_sku ON products(parent_sku);
CREATE INDEX IF NOT EXISTS idx_products_stock_low
  ON products(stock_quantity) WHERE is_active = true;

-- Auto-update trigger for updated_at
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

-- Comments
COMMENT ON TABLE products IS 'Product catalog for crystal photo engraving inventory';
COMMENT ON COLUMN products.sku IS 'Unique product SKU, format: CRYS-SHAPE-SIZE-BASE-ORIENT';
COMMENT ON COLUMN products.is_parent IS 'True for parent/family SKUs (e.g., CRYS-HRT) that group variants';
COMMENT ON COLUMN products.parent_sku IS 'References the parent SKU for variant products';
COMMENT ON COLUMN products.low_stock_threshold IS 'Alert threshold - product shows as low stock when quantity drops below this';

SELECT 'Products table migration complete!' as message;

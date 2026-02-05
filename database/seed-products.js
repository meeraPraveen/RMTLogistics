import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const { Pool } = pg;

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'auth0_rbac',
  password: process.env.DB_PASSWORD || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
});

// SKU parsing maps
const SHAPE_MAP = { HRT: 'Heart', REC: 'Rectangle', SQR: 'Square', ICB: 'Iceberg', DMD: 'Diamond' };
const SIZE_MAP = { XS: 'XSmall', SM: 'Small', MD: 'Medium', LG: 'Large', XL: 'XLarge' };
const BASE_MAP = { N: 'Standard', P: 'Premium' };
const ORIENT_MAP = { P: 'Portrait', L: 'Landscape' };

function parseSku(sku) {
  const parts = sku.split('-');

  // Parent SKU: CRYS-HRT (2 parts)
  if (parts.length === 2) {
    return {
      product_line: parts[0],
      shape: SHAPE_MAP[parts[1]] || parts[1],
      size: null,
      base_type: null,
      orientation: null,
      is_parent: true,
      parent_sku: null,
      display_name: `Crystal ${SHAPE_MAP[parts[1]] || parts[1]}`
    };
  }

  // Variant SKU: CRYS-HRT-SM-N-P (5 parts)
  if (parts.length === 5) {
    const shape = SHAPE_MAP[parts[1]] || parts[1];
    const size = SIZE_MAP[parts[2]] || parts[2];
    const base = BASE_MAP[parts[3]] || parts[3];
    const orient = ORIENT_MAP[parts[4]] || parts[4];
    return {
      product_line: parts[0],
      shape,
      size,
      base_type: base,
      orientation: orient,
      is_parent: false,
      parent_sku: `${parts[0]}-${parts[1]}`,
      display_name: `Crystal ${shape} - ${size} - ${base} - ${orient}`
    };
  }

  // Unknown format
  return {
    product_line: parts[0],
    shape: parts[1] ? (SHAPE_MAP[parts[1]] || parts[1]) : null,
    size: null,
    base_type: null,
    orientation: null,
    is_parent: false,
    parent_sku: null,
    display_name: sku
  };
}

function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  return lines.slice(1).map(line => {
    const values = line.split(',');
    return {
      sku: values[0].trim(),
      price: parseFloat(values[1]),
      quantity: parseInt(values[4]) || 0
    };
  });
}

async function seedProducts() {
  const client = await pool.connect();
  try {
    console.log('Starting product seeding from CSV...\n');

    const csvPath = join(__dirname, '..', 'data', 'products.csv');
    const csvText = readFileSync(csvPath, 'utf-8');
    const products = parseCSV(csvText);

    console.log(`Found ${products.length} products in CSV\n`);

    await client.query('BEGIN');

    // Insert parent SKUs first to satisfy parent_sku references
    const parents = products.filter(p => p.sku.split('-').length === 2);
    const variants = products.filter(p => p.sku.split('-').length !== 2);

    for (const product of [...parents, ...variants]) {
      const parsed = parseSku(product.sku);
      await client.query(
        `INSERT INTO products (
          sku, product_line, shape, size, base_type, orientation,
          display_name, is_parent, parent_sku, price, stock_quantity,
          low_stock_threshold, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true)
        ON CONFLICT (sku) DO UPDATE SET
          price = EXCLUDED.price,
          stock_quantity = EXCLUDED.stock_quantity,
          updated_at = CURRENT_TIMESTAMP`,
        [
          product.sku, parsed.product_line, parsed.shape, parsed.size,
          parsed.base_type, parsed.orientation, parsed.display_name,
          parsed.is_parent, parsed.parent_sku, product.price,
          product.quantity, 50
        ]
      );
      const tag = parsed.is_parent ? '[PARENT]' : '        ';
      console.log(`  ${tag} ${product.sku} - $${product.price} (qty: ${product.quantity})`);
    }

    await client.query('COMMIT');
    console.log(`\nSuccessfully seeded ${products.length} products!\n`);

    // Show summary
    const summary = await client.query(`
      SELECT shape, COUNT(*) as count, SUM(stock_quantity) as total_stock
      FROM products WHERE is_parent = false
      GROUP BY shape ORDER BY shape
    `);
    console.log('Inventory Summary by Shape:');
    summary.rows.forEach(row => {
      console.log(`  ${row.shape}: ${row.count} variants, ${row.total_stock} total stock`);
    });

    const totals = await client.query(`
      SELECT COUNT(*) as total, SUM(stock_quantity) as total_stock
      FROM products WHERE is_parent = false
    `);
    console.log(`\nTotal: ${totals.rows[0].total} variant products, ${totals.rows[0].total_stock} total units`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error seeding products:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
    console.log('\nDatabase connection closed');
  }
}

seedProducts();

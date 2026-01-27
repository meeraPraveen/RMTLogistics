import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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

// Sample orders based on CSV data
const sampleOrders = [
  {
    internal_order_id: 'ORD-2025-00001',
    order_type: 'Amazon',
    platform_order_id: 'AMZ-112-8765432-001',
    description: 'Goddess',
    num_figures: '1',
    sku: 'CRYS-SQR-SM-N-P',
    shape: 'Square',
    size: 'Small',
    orientation: 'Portrait',
    base_type: 'Plain',
    dimensions: '7.5x7.5x5',
    has_background: false,
    has_text: false,
    unit_rate: 800.00,
    total_amount: 800.00,
    status: 'Completed',
    comments: 'Full body, Extra hands and Props',
    customer_email: 'customer001@example.com',
    date_submitted: '2025-11-12'
  },
  {
    internal_order_id: 'ORD-2025-00002',
    order_type: 'Amazon',
    platform_order_id: 'AMZ-112-8765432-002',
    description: 'Couples',
    num_figures: '2',
    sku: 'CRYS-HRT-SM-N-P',
    shape: 'Heart',
    size: 'Small',
    orientation: 'Portrait',
    base_type: 'Plain',
    dimensions: '8x7x4',
    has_background: false,
    has_text: true,
    unit_rate: 300.00,
    total_amount: 600.00,
    status: 'Completed',
    customer_email: 'customer002@example.com',
    date_submitted: '2025-11-19'
  },
  {
    internal_order_id: 'ORD-2025-00003',
    order_type: 'Personal',
    platform_order_id: null,
    description: 'Man + Bike + BG',
    num_figures: '1',
    sku: 'CRYS-REC-MD-N-P',
    shape: 'Rectangle',
    size: 'Medium',
    orientation: 'Portrait',
    base_type: 'Plain',
    dimensions: '7x10x6',
    has_background: true,
    has_text: false,
    unit_rate: 1000.00,
    total_amount: 1000.00,
    status: 'Completed',
    comments: 'Full Body, B.G. and Cycle',
    customer_email: 'personal@example.com',
    date_submitted: '2025-11-24'
  },
  {
    internal_order_id: 'ORD-2025-00004',
    order_type: 'Amazon',
    platform_order_id: 'AMZ-112-8765432-003',
    description: 'Wedding Couples + Bulls',
    num_figures: '4',
    sku: 'CRYS-REC-XL-N-L',
    shape: 'Rectangle',
    size: 'XLarge',
    orientation: 'Landscape',
    base_type: 'LED',
    dimensions: '15x10x6',
    has_background: true,
    has_text: true,
    unit_rate: 1600.00,
    total_amount: 1600.00,
    status: 'Completed',
    comments: 'high detailed, background and props',
    customer_email: 'customer004@example.com',
    date_submitted: '2025-11-25'
  },
  {
    internal_order_id: 'ORD-2025-00005',
    order_type: 'Amazon',
    platform_order_id: 'AMZ-112-8765432-004',
    description: 'Family',
    num_figures: '3',
    sku: 'CRYS-REC-MD-N-P',
    shape: 'Rectangle',
    size: 'Medium',
    orientation: 'Portrait',
    base_type: 'Plain',
    dimensions: '7x10x6',
    has_background: false,
    has_text: false,
    unit_rate: 1000.00,
    total_amount: 1000.00,
    status: 'In Progress',
    comments: '3 full body with prop',
    customer_email: 'customer005@example.com',
    date_submitted: '2025-11-27'
  },
  {
    internal_order_id: 'ORD-2025-00006',
    order_type: 'Amazon',
    platform_order_id: 'AMZ-112-8765432-005',
    description: 'Dog',
    num_figures: '1',
    sku: 'CRYS-REC-MD-N-P',
    shape: 'Rectangle',
    size: 'Medium',
    orientation: 'Portrait',
    base_type: 'Plain',
    dimensions: '7x10x6',
    has_background: false,
    has_text: true,
    unit_rate: 300.00,
    total_amount: 300.00,
    status: 'Processing',
    customer_email: 'customer006@example.com',
    date_submitted: '2025-12-02'
  },
  {
    internal_order_id: 'ORD-2025-00007',
    order_type: 'Amazon',
    platform_order_id: 'AMZ-112-8765432-006',
    description: 'Couple (old photo)',
    num_figures: '2',
    sku: 'CRYS-REC-SM-N-P',
    shape: 'Rectangle',
    size: 'Small',
    orientation: 'Portrait',
    base_type: 'Plain',
    dimensions: '5x8x5',
    has_background: false,
    has_text: false,
    unit_rate: 400.00,
    total_amount: 800.00,
    status: 'Ready to Print',
    customer_email: 'customer007@example.com',
    date_submitted: '2025-12-03'
  },
  {
    internal_order_id: 'ORD-2025-00008',
    order_type: 'Amazon',
    platform_order_id: 'AMZ-112-8765432-007',
    description: '4 Boys Sitting on a Coffee Table',
    num_figures: '4',
    sku: 'CRYS-REC-MD-N-P',
    shape: 'Rectangle',
    size: 'Medium',
    orientation: 'Portrait',
    base_type: 'Plain',
    dimensions: '7x10x6',
    has_background: false,
    has_text: true,
    unit_rate: 1500.00,
    total_amount: 1500.00,
    status: 'Pending',
    comments: '4 figures+ More props',
    customer_email: 'customer008@example.com',
    date_submitted: '2025-12-04'
  },
  {
    internal_order_id: 'ORD-2025-00009',
    order_type: 'Personal',
    platform_order_id: null,
    description: 'Aamer Butt',
    num_figures: '1',
    sku: 'CRYS-REC-XL-N-P',
    shape: 'Rectangle',
    size: 'XLarge',
    orientation: 'Landscape',
    base_type: 'Plain',
    dimensions: '15x10x6',
    has_background: true,
    has_text: false,
    unit_rate: 1300.00,
    total_amount: 1300.00,
    status: 'Completed',
    comments: 'Detail Image',
    customer_email: 'aamer@example.com',
    date_submitted: '2025-12-07'
  },
  {
    internal_order_id: 'ORD-2025-00010',
    order_type: 'Amazon',
    platform_order_id: 'AMZ-112-8765432-008',
    description: '6 Adults + 2 Kids sitting',
    num_figures: '6',
    sku: 'CRYS-REC-XL-N-L',
    shape: 'Rectangle',
    size: 'XLarge',
    orientation: 'Landscape',
    base_type: 'LED',
    dimensions: '15x10x6',
    has_background: false,
    has_text: true,
    unit_rate: 2400.00,
    total_amount: 2400.00,
    status: 'Pending',
    comments: '3 Full and half figures+props',
    customer_email: 'customer010@example.com',
    date_submitted: '2025-12-07'
  }
];

async function seedOrders() {
  const client = await pool.connect();

  try {
    console.log('🌱 Starting to seed sample orders...\n');

    await client.query('BEGIN');

    for (const order of sampleOrders) {
      const shippingAddress = {
        name: 'Customer Name',
        line1: '123 Main Street',
        city: 'New York',
        state: 'NY',
        zip: '10001',
        country: 'USA'
      };

      await client.query(
        `INSERT INTO orders (
          internal_order_id, order_type, platform_order_id, order_item_id,
          customer_email, shipping_address, description, num_figures,
          sku, product_id, shape, size, orientation, base_type, dimensions,
          has_background, has_text, unit_rate, total_amount,
          status, comments, date_submitted, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
          $21, $22, $23
        )`,
        [
          order.internal_order_id,
          order.order_type,
          order.platform_order_id,
          null, // order_item_id
          order.customer_email,
          JSON.stringify(shippingAddress),
          order.description,
          order.num_figures,
          order.sku,
          null, // product_id
          order.shape,
          order.size,
          order.orientation,
          order.base_type,
          order.dimensions,
          order.has_background,
          order.has_text,
          order.unit_rate,
          order.total_amount,
          order.status,
          order.comments || null,
          order.date_submitted,
          46 // created_by (SuperAdmin user)
        ]
      );

      console.log(`✓ Created order: ${order.internal_order_id} - ${order.description}`);
    }

    await client.query('COMMIT');

    console.log(`\n✅ Successfully seeded ${sampleOrders.length} sample orders!`);

    // Show statistics
    const stats = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'Pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'Processing' THEN 1 END) as processing,
        COUNT(CASE WHEN status = 'Ready to Print' THEN 1 END) as ready_to_print,
        COUNT(CASE WHEN status = 'In Progress' THEN 1 END) as in_progress,
        COUNT(CASE WHEN status = 'Completed' THEN 1 END) as completed
      FROM orders
    `);

    console.log('\n📊 Order Statistics:');
    console.log(`   Total: ${stats.rows[0].total}`);
    console.log(`   Pending: ${stats.rows[0].pending}`);
    console.log(`   Processing: ${stats.rows[0].processing}`);
    console.log(`   Ready to Print: ${stats.rows[0].ready_to_print}`);
    console.log(`   In Progress: ${stats.rows[0].in_progress}`);
    console.log(`   Completed: ${stats.rows[0].completed}`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error seeding orders:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
    console.log('\n✅ Database connection closed');
  }
}

seedOrders();

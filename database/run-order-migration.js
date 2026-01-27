import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from parent directory
dotenv.config({ path: join(__dirname, '..', '.env') });

const { Pool } = pg;

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'auth0_rbac',
  password: process.env.DB_PASSWORD || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
});

async function runOrderMigration() {
  try {
    console.log('🚀 Starting Order Management migration...\n');

    // Read the migration SQL file
    const migrationSQL = readFileSync(
      join(__dirname, 'migration-order-management.sql'),
      'utf-8'
    );

    // Execute the migration
    await pool.query(migrationSQL);

    console.log('✅ Migration executed successfully!\n');

    // Verify tables were created
    const tablesCheck = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('orders', 'companies')
      ORDER BY table_name
    `);

    console.log('📊 Verified tables created:');
    tablesCheck.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });

    // Show orders table structure
    console.log('\n📋 Orders table columns:');
    const ordersColumns = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'orders'
      ORDER BY ordinal_position
    `);
    ordersColumns.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });

    // Show companies table structure
    console.log('\n📋 Companies table columns:');
    const companiesColumns = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'companies'
      ORDER BY ordinal_position
    `);
    companiesColumns.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });

    console.log('\n✅ Order Management tables are ready!');

  } catch (error) {
    console.error('❌ Error running migration:', error.message);
    console.error(error);
  } finally {
    await pool.end();
    console.log('\n✅ Database connection closed');
  }
}

runOrderMigration();

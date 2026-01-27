import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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

async function removeInvitedFields() {
  try {
    console.log('🔄 Removing invited_by and invited_at columns...');

    // Drop invited_by column
    await pool.query("ALTER TABLE users DROP COLUMN IF EXISTS invited_by CASCADE");
    console.log('✅ Dropped invited_by column');

    // Drop invited_at column
    await pool.query("ALTER TABLE users DROP COLUMN IF EXISTS invited_at CASCADE");
    console.log('✅ Dropped invited_at column');

    // Show current table structure
    const columns = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);

    console.log('\n📊 Current users table structure:');
    columns.rows.forEach(col => {
      console.log(`   ${col.column_name} (${col.data_type}) ${col.column_default ? `- default: ${col.column_default}` : ''}`);
    });

  } catch (error) {
    console.error('❌ Error removing invited fields:', error);
  } finally {
    await pool.end();
    console.log('\n✅ Database connection closed');
  }
}

removeInvitedFields();

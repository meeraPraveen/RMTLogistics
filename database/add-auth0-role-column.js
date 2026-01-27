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

async function addAuth0RoleColumn() {
  try {
    console.log('🔄 Adding auth0_role column to users table...');

    // Add auth0_role column
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS auth0_role VARCHAR(50)");
    console.log('✅ Added auth0_role column');

    // Add index for faster lookups
    await pool.query("CREATE INDEX IF NOT EXISTS idx_users_auth0_role ON users(auth0_role)");
    console.log('✅ Created index on auth0_role');

    // Add comment for documentation
    await pool.query("COMMENT ON COLUMN users.auth0_role IS 'Role assigned in Auth0 (for comparison with database role)'");
    console.log('✅ Added column comment');

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
    console.error('❌ Error adding auth0_role column:', error);
  } finally {
    await pool.end();
    console.log('\n✅ Database connection closed');
  }
}

addAuth0RoleColumn();

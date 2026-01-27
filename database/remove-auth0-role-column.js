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

async function removeAuth0RoleColumn() {
  try {
    console.log('🔄 Removing auth0_role column from users table...');
    console.log('   Reason: Database is the single source of truth for roles');
    console.log('   Auth0 app_metadata.role is synced FROM database, not TO database\n');

    // Drop index first
    await pool.query("DROP INDEX IF EXISTS idx_users_auth0_role");
    console.log('✅ Dropped index on auth0_role');

    // Remove auth0_role column
    await pool.query("ALTER TABLE users DROP COLUMN IF EXISTS auth0_role");
    console.log('✅ Removed auth0_role column');

    // Show current table structure
    const columns = await pool.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);

    console.log('\n📊 Updated users table structure:');
    columns.rows.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
      console.log(`   ${col.column_name} (${col.data_type}) ${nullable}${defaultVal}`);
    });

    console.log('\n✅ Migration complete - Database is now the single source of truth');

  } catch (error) {
    console.error('❌ Error removing auth0_role column:', error);
  } finally {
    await pool.end();
    console.log('\n✅ Database connection closed');
  }
}

removeAuth0RoleColumn();

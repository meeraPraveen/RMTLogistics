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

async function updateInvitedStatus() {
  try {
    // First, check if status column exists
    console.log('🔍 Checking if status column exists...');
    const columnCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'status'
    `);

    if (columnCheck.rows.length === 0) {
      console.log('⚠️  Status column does not exist. Running migration...');

      // Add status column
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by INTEGER REFERENCES users(id)");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
      await pool.query("CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)");
      await pool.query("COMMENT ON COLUMN users.status IS 'User status: active (can access), suspended (blocked)'");

      console.log('✅ Status column added successfully');
    }

    console.log('🔄 Updating status from "invited" to "active"...');

    const result = await pool.query(
      "UPDATE users SET status = 'active' WHERE status = 'invited' OR status IS NULL"
    );

    console.log(`✅ Updated ${result.rowCount} user(s) to 'active'`);

    // Show current status distribution
    const statusCount = await pool.query(
      "SELECT status, COUNT(*) as count FROM users GROUP BY status"
    );

    console.log('\n📊 Current status distribution:');
    statusCount.rows.forEach(row => {
      console.log(`   ${row.status}: ${row.count}`);
    });

  } catch (error) {
    console.error('❌ Error updating status:', error);
  } finally {
    await pool.end();
    console.log('\n✅ Database connection closed');
  }
}

updateInvitedStatus();

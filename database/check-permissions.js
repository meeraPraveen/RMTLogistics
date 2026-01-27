import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

async function checkPermissions() {
  try {
    const result = await pool.query(`
      SELECT role, module, permissions
      FROM role_permissions
      WHERE role IN ('SuperAdmin', 'Admin')
      ORDER BY role, module
    `);

    console.log('\n=== Role Permissions ===');
    result.rows.forEach(row => {
      console.log(`${row.role} -> ${row.module}: ${JSON.stringify(row.permissions)}`);
    });

    await pool.end();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkPermissions();

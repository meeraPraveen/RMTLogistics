import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database configuration
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'auth0_rbac',
  password: 'mpeoas7*',
  port: 5432,
});

async function runPermissionsMigration() {
  try {
    console.log('🔧 Adding Order Management permissions...\n');

    // Check if permissions already exist for SuperAdmin
    const superAdminCheck = await pool.query(
      `SELECT * FROM role_permissions WHERE role = 'SuperAdmin' AND module = 'order_management'`
    );

    if (superAdminCheck.rows.length === 0) {
      await pool.query(
        `INSERT INTO role_permissions (role, module, permissions)
         VALUES ('SuperAdmin', 'order_management', '["read", "write", "update", "delete"]'::jsonb)`
      );
      console.log('✅ Added Order Management permissions for SuperAdmin');
    } else {
      console.log('ℹ️  Order Management permissions already exist for SuperAdmin');
    }

    // Check if permissions already exist for Admin
    const adminCheck = await pool.query(
      `SELECT * FROM role_permissions WHERE role = 'Admin' AND module = 'order_management'`
    );

    if (adminCheck.rows.length === 0) {
      await pool.query(
        `INSERT INTO role_permissions (role, module, permissions)
         VALUES ('Admin', 'order_management', '["read", "write", "update", "delete"]'::jsonb)`
      );
      console.log('✅ Added Order Management permissions for Admin');
    } else {
      console.log('ℹ️  Order Management permissions already exist for Admin');
    }

    // Verify
    const result = await pool.query(
      `SELECT role, module, permissions FROM role_permissions WHERE module = 'order_management' ORDER BY role`
    );

    console.log('\n📊 Current Order Management Permissions:');
    result.rows.forEach(row => {
      console.log(`   ${row.role}: ${JSON.stringify(row.permissions)}`);
    });

    console.log('\n✅ Order Management permissions configured successfully!');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
    process.exit(1);
  }
}

runPermissionsMigration();

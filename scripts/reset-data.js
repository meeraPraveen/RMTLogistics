import pkg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database connection configuration
const config = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  password: process.env.DB_PASSWORD || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'auth0_rbac'
};

async function resetData() {
  console.log('🔄 Resetting database data...\n');

  const client = new Client(config);

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Delete existing data
    console.log('\n🗑️  Deleting existing data...');
    await client.query('DELETE FROM audit_log');
    await client.query('DELETE FROM users');
    await client.query('DELETE FROM role_permissions');
    console.log('✅ Existing data deleted');

    // Re-seed data
    console.log('\n🌱 Re-seeding data...');
    const seedPath = path.join(__dirname, '..', 'database', 'seed.sql');
    const seed = fs.readFileSync(seedPath, 'utf8');
    await client.query(seed);
    console.log('✅ Data re-seeded successfully');

    // Verify
    console.log('\n🔍 Verifying data...');
    const usersResult = await client.query('SELECT COUNT(*) FROM users');
    const permsResult = await client.query('SELECT COUNT(*) FROM role_permissions');

    console.log(`📊 Data summary:`);
    console.log(`   - ${usersResult.rows[0].count} users`);
    console.log(`   - ${permsResult.rows[0].count} role-permission mappings`);

    // Show permissions
    console.log('\n📋 Role Permissions:');
    const allPerms = await client.query('SELECT role, module, permissions FROM role_permissions ORDER BY role, module');
    allPerms.rows.forEach(row => {
      console.log(`   ${row.role} -> ${row.module}: ${JSON.stringify(row.permissions)}`);
    });

    await client.end();

    console.log('\n✅ Database reset complete!');
    console.log('\n📝 Next step: Restart your server');

  } catch (error) {
    console.error('\n❌ Error resetting database:', error.message);
    console.error(error);
    process.exit(1);
  }
}

resetData();

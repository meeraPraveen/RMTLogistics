import pkg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'auth0_rbac',
  password: process.env.DB_PASSWORD || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
};

async function runMigration() {
  const client = new Client(config);

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    console.log('🚀 Running consolidated migration...');
    console.log('📋 This migration includes:');
    console.log('   - User management enhancements');
    console.log('   - Companies table (UUID)');
    console.log('   - Products table with weight');
    console.log('   - Orders table with all features');
    console.log('   - Custom engraving support');
    console.log('   - Model path support');
    console.log('   - Workflow tracking');
    console.log('   - Shipping module permissions');
    console.log('   - Failed sync operations table\n');

    const migrationPath = path.join(__dirname, '..', 'database', 'migration-consolidated.sql');
    const migration = fs.readFileSync(migrationPath, 'utf8');

    await client.query(migration);

    console.log('\n✅ Consolidated migration completed successfully!\n');

    await client.end();
  } catch (error) {
    console.error('❌ Error running migration:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

runMigration();

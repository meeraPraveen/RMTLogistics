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

    // Run shipping module migration
    console.log('🚀 Running shipping module migration...');
    const migrationPath = path.join(__dirname, '..', 'database', 'migration-add-shipping-module.sql');
    const migration = fs.readFileSync(migrationPath, 'utf8');
    const result = await client.query(migration);

    console.log('✅ Migration completed successfully!\n');

    // Show results
    if (result.length > 0) {
      result.forEach(res => {
        if (res.rows && res.rows.length > 0) {
          console.log(res.rows);
        }
      });
    }

    await client.end();
  } catch (error) {
    console.error('❌ Error running migration:', error.message);
    process.exit(1);
  }
}

runMigration();

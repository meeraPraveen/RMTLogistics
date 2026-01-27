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
  database: process.env.DB_NAME || 'auth0_rbac',
  password: process.env.DB_PASSWORD || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
};

async function runMigration() {
  const migrationFile = process.argv[2];

  if (!migrationFile) {
    console.error('❌ Error: Migration file not specified');
    console.log('Usage: node scripts/run-migration.js <migration-file.sql>');
    process.exit(1);
  }

  console.log(`🔧 Running migration: ${migrationFile}\n`);

  const client = new Client(config);

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Read and run migration file
    const migrationPath = path.join(__dirname, '..', 'database', migrationFile);

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const migration = fs.readFileSync(migrationPath, 'utf8');
    const result = await client.query(migration);

    console.log('✅ Migration executed successfully');

    // Display result message if available
    if (result.rows && result.rows.length > 0) {
      console.log('\n📝 Result:', result.rows[0].message || result.rows[0]);
    }

    await client.end();

  } catch (error) {
    console.error('\n❌ Error running migration:', error.message);
    process.exit(1);
  }
}

runMigration();

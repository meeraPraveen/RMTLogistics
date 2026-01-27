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
};

async function setupDatabase() {
  console.log('🔧 Setting up PostgreSQL database...\n');

  // First, connect to default database to create our database
  const defaultClient = new Client({
    ...config,
    database: 'postgres'
  });

  try {
    await defaultClient.connect();
    console.log('✅ Connected to PostgreSQL server');

    // Create database if it doesn't exist
    const dbName = process.env.DB_NAME || 'auth0_rbac';

    try {
      await defaultClient.query(`CREATE DATABASE ${dbName}`);
      console.log(`✅ Database '${dbName}' created`);
    } catch (error) {
      if (error.code === '42P04') {
        console.log(`ℹ️  Database '${dbName}' already exists`);
      } else {
        throw error;
      }
    }

    await defaultClient.end();

    // Connect to our new database
    const appClient = new Client({
      ...config,
      database: dbName
    });

    await appClient.connect();
    console.log(`✅ Connected to database '${dbName}'`);

    // Run schema
    console.log('\n📝 Creating tables...');
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await appClient.query(schema);
    console.log('✅ Tables created successfully');

    // Run seed data
    console.log('\n🌱 Seeding initial data...');
    const seedPath = path.join(__dirname, '..', 'database', 'seed.sql');
    const seed = fs.readFileSync(seedPath, 'utf8');
    await appClient.query(seed);
    console.log('✅ Seed data inserted successfully');

    // Verify setup
    console.log('\n🔍 Verifying setup...');
    const tablesResult = await appClient.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log('📋 Tables created:');
    tablesResult.rows.forEach(row => console.log(`   - ${row.table_name}`));

    const usersResult = await appClient.query('SELECT COUNT(*) FROM users');
    const permsResult = await appClient.query('SELECT COUNT(*) FROM role_permissions');

    console.log(`\n📊 Data summary:`);
    console.log(`   - ${usersResult.rows[0].count} sample users`);
    console.log(`   - ${permsResult.rows[0].count} role-permission mappings`);

    await appClient.end();

    console.log('\n✅ Database setup complete!');
    console.log('\n📝 Next steps:');
    console.log('   1. Update sample users with real Auth0 IDs');
    console.log('   2. Configure .env file with database credentials');
    console.log('   3. Start the server: npm run dev');

  } catch (error) {
    console.error('\n❌ Error setting up database:', error.message);
    process.exit(1);
  }
}

setupDatabase();

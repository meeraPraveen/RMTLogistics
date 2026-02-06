import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pkg;

const config = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'auth0_rbac',
  password: process.env.DB_PASSWORD || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
};

async function verifyColumn() {
  const client = new Client(config);

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    const result = await client.query(`
      SELECT column_name, data_type, character_maximum_length, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'orders'
        AND column_name = 'model_path';
    `);

    if (result.rows.length > 0) {
      console.log('✅ Column "model_path" exists in orders table:');
      console.log('   Type:', result.rows[0].data_type);
      console.log('   Max Length:', result.rows[0].character_maximum_length);
      console.log('   Default:', result.rows[0].column_default || 'NULL');
      console.log('   Nullable:', result.rows[0].is_nullable);
    } else {
      console.log('❌ Column "model_path" not found');
    }

    await client.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyColumn();

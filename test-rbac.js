import pg from 'pg';
const { Client } = pg;

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'auth0_rbac',
  user: 'postgres',
  password: 'mpeoas7*'
});

async function test() {
  try {
    await client.connect();
    console.log('✅ Database connected\n');

    // Test the exact query from hasModuleAccess
    const result = await client.query(
      `SELECT 1 FROM role_permissions
       WHERE role = $1 AND module = $2
       AND jsonb_array_length(permissions) > 0`,
      ['SuperAdmin', 'user_management']
    );

    console.log('Query result:', result.rows);
    console.log('Has access:', result.rows.length > 0);

    // Also check what the permissions column contains
    const check = await client.query(
      `SELECT role, module, permissions, pg_typeof(permissions) as type FROM role_permissions
       WHERE role = 'SuperAdmin' AND module = 'user_management'`
    );

    console.log('\nPermissions data:');
    console.log(JSON.stringify(check.rows, null, 2));

  } catch (e) {
    console.error('❌ Error:', e.message);
    console.error('Stack:', e.stack);
  } finally {
    await client.end();
  }
}

test();

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

    // Check SuperAdmin permissions
    const perms = await client.query(
      `SELECT role, module, permissions FROM role_permissions WHERE role = 'SuperAdmin'`
    );
    console.log('SuperAdmin permissions:');
    console.log(JSON.stringify(perms.rows, null, 2));

  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    await client.end();
  }
}

test();

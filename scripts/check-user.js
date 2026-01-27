import { query } from '../server/config/database.js';

const email = 'meerapraveen07@gmail.com';

async function checkUser() {
  try {
    const result = await query(
      'SELECT id, auth0_user_id, email, role, created_at FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      console.log(`\n❌ User ${email} not found in database\n`);
    } else {
      console.log(`\n✅ User found in database:\n`);
      console.table(result.rows);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkUser();

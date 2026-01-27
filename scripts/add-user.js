import { query } from '../server/config/database.js';

// User details from Auth0
const user = {
  auth0_user_id: 'google-oauth2|109876543210987654321', // This should be the actual Auth0 user ID
  email: 'meerapraveen07@gmail.com',
  role: 'Admin' // Can be: SuperAdmin, Admin, Lead Artist, Artist, Production Tech
};

async function addUser() {
  try {
    console.log('\n🔍 Checking if user already exists...');

    const existingUser = await query(
      'SELECT * FROM users WHERE email = $1',
      [user.email]
    );

    if (existingUser.rows.length > 0) {
      console.log(`\n⚠️  User ${user.email} already exists in database`);
      console.table(existingUser.rows);
      process.exit(0);
    }

    console.log(`\n✅ Adding user ${user.email} to database...`);

    const result = await query(
      `INSERT INTO users (auth0_user_id, email, role)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [user.auth0_user_id, user.email, user.role]
    );

    console.log(`\n✅ User added successfully!\n`);
    console.table(result.rows);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error adding user:', error.message);
    process.exit(1);
  }
}

addUser();

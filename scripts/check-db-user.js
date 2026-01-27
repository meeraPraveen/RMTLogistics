/**
 * Check user details in database
 */

import dotenv from 'dotenv';
import { query } from '../server/config/database.js';

dotenv.config();

async function checkUser() {
  const email = process.argv[2] || 'meerapraveen07@gmail.com';

  console.log(`\n🔍 Checking user in database: ${email}\n`);

  try {
    const result = await query(
      'SELECT id, email, name, role, auth0_role, auth0_user_id, is_active, created_at, updated_at, last_login FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      console.log('❌ User not found in database');
      process.exit(1);
    }

    const user = result.rows[0];

    console.log('═'.repeat(60));
    console.log('Database User Details:');
    console.log('═'.repeat(60));
    console.log(`ID:              ${user.id}`);
    console.log(`Email:           ${user.email}`);
    console.log(`Name:            ${user.name || 'Not set'}`);
    console.log(`Role (DB):       ${user.role}`);
    console.log(`Auth0 Role:      ${user.auth0_role || 'Not set'}`);
    console.log(`Auth0 User ID:   ${user.auth0_user_id}`);
    console.log(`Is Active:       ${user.is_active ? '✅ Yes' : '❌ No'}`);
    console.log(`Created:         ${user.created_at}`);
    console.log(`Updated:         ${user.updated_at}`);
    console.log(`Last Login:      ${user.last_login || 'Never'}`);
    console.log('═'.repeat(60));

    const mismatch = user.auth0_role && user.auth0_role !== user.role;
    if (mismatch) {
      console.log(`\n⚠️  ROLE MISMATCH DETECTED:`);
      console.log(`   Database role: ${user.role}`);
      console.log(`   Auth0 role:    ${user.auth0_role}`);
    } else {
      console.log(`\n✅ Roles are in sync`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkUser();

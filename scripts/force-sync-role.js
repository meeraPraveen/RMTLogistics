/**
 * Force sync a user's role from database to Auth0
 * Use when role was updated directly in DB without going through API
 */

import dotenv from 'dotenv';
import { updateAuth0User } from '../server/services/auth0.service.js';
import { query } from '../server/config/database.js';

dotenv.config();

async function forceSyncRole() {
  const email = process.argv[2];

  if (!email) {
    console.log('❌ Please provide a user email');
    console.log('Usage: node scripts/force-sync-role.js <email>');
    process.exit(1);
  }

  console.log(`\n🔄 Force syncing role for: ${email}\n`);
  console.log('═'.repeat(60));

  try {
    // Get user from database
    const result = await query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      console.log(`❌ User not found in database: ${email}`);
      process.exit(1);
    }

    const dbUser = result.rows[0];

    console.log('📊 Current State:');
    console.log(`   Database Role:     ${dbUser.role}`);
    console.log(`   Auth0 User ID:     ${dbUser.auth0_user_id}`);
    console.log(`   Last Updated (DB): ${dbUser.updated_at}`);

    if (!dbUser.auth0_user_id || dbUser.auth0_user_id.startsWith('pending_')) {
      console.log('❌ User does not have a valid Auth0 user ID');
      process.exit(1);
    }

    console.log(`\n🔄 Syncing role "${dbUser.role}" to Auth0...`);

    // Force sync to Auth0
    const result2 = await updateAuth0User(dbUser.auth0_user_id, {
      role: dbUser.role,
      name: dbUser.name
    });

    if (result2.updated) {
      console.log(`✅ Role synced successfully to Auth0!`);
      console.log(`\n📝 Next Steps:`);
      console.log(`   1. User must LOGOUT and LOGIN again to get new token`);
      console.log(`   2. New token will contain role: "${dbUser.role}"`);
      console.log(`   3. Role mismatch warning will disappear`);
      console.log('\n' + '═'.repeat(60));
      console.log(`✅ Sync complete for ${email}\n`);
    } else {
      console.log('⚠️  Sync completed but Auth0 update status unclear');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

forceSyncRole();

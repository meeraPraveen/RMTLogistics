import { query } from '../server/config/database.js';
import { updateAuth0User, getAuth0UserByEmail } from '../server/services/auth0.service.js';

async function syncUserToAuth0() {
  try {
    console.log('\n===========================================');
    console.log('🔄 SYNCING USER TO AUTH0');
    console.log('===========================================\n');

    const email = 'meerapraveen07@gmail.com';

    // Step 1: Get user from database
    const dbResult = await query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (dbResult.rows.length === 0) {
      console.log(`❌ User ${email} NOT found in database`);
      return;
    }

    const dbUser = dbResult.rows[0];
    console.log(`✅ User found in database:`);
    console.log(`   Email: ${dbUser.email}`);
    console.log(`   Role: ${dbUser.role}`);
    console.log(`   Auth0 ID: ${dbUser.auth0_user_id}`);

    // Step 2: Check if user exists in Auth0
    console.log(`\n🔍 Looking up user in Auth0...`);
    const auth0User = await getAuth0UserByEmail(email);

    if (!auth0User) {
      console.log(`❌ User ${email} NOT found in Auth0`);
      console.log(`ℹ️  User needs to log in at least once with Google OAuth to be created in Auth0`);
      return;
    }

    console.log(`✅ User found in Auth0:`);
    console.log(`   Auth0 ID: ${auth0User.user_id}`);
    console.log(`   Name: ${auth0User.name}`);
    console.log(`   Current App Metadata:`, auth0User.app_metadata || '(none)');

    // Step 3: Sync role to Auth0
    console.log(`\n📤 Syncing role "${dbUser.role}" to Auth0...`);
    const result = await updateAuth0User(auth0User.user_id, {
      role: dbUser.role
    });

    if (result.updated) {
      console.log(`✅ Role synced successfully!`);

      // Step 4: Update database with Auth0 user ID if needed
      if (dbUser.auth0_user_id !== auth0User.user_id) {
        console.log(`\n📝 Updating database with Auth0 user ID...`);
        await query(
          'UPDATE users SET auth0_user_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [auth0User.user_id, dbUser.id]
        );
        console.log(`✅ Database updated with Auth0 user ID: ${auth0User.user_id}`);
      }
    }

    console.log('\n===========================================');
    console.log('✅ SYNC COMPLETE');
    console.log('===========================================\n');

  } catch (error) {
    console.error('❌ Error syncing user:', error.message);
    console.error(error);
  } finally {
    process.exit(0);
  }
}

syncUserToAuth0();

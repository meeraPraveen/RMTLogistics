import { query } from '../server/config/database.js';
import { updateAuth0User } from '../server/services/auth0.service.js';
import { getRolePermissions } from '../server/services/permissions.service.js';

/**
 * Sync permissions to Auth0 for all existing users
 * This script fetches each user's role from the database,
 * gets the permissions for that role, and syncs to Auth0 app_metadata
 */
async function syncAllPermissions() {
  try {
    console.log('🔄 Starting permission sync for all users...\n');

    // Get all users from database
    const result = await query(
      'SELECT id, auth0_user_id, email, name, role FROM users ORDER BY email'
    );

    const users = result.rows;
    console.log(`📊 Found ${users.length} users to sync\n`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const user of users) {
      console.log(`\n👤 Processing: ${user.email}`);
      console.log(`   Auth0 ID: ${user.auth0_user_id}`);
      console.log(`   Role: ${user.role}`);

      // Skip users without Auth0 ID or pending users
      if (!user.auth0_user_id || user.auth0_user_id.startsWith('pending_')) {
        console.log(`   ⏭️  Skipped - No Auth0 ID or pending`);
        skipCount++;
        continue;
      }

      try {
        // Get permissions for the user's role
        const permissions = await getRolePermissions(user.role);
        console.log(`   📋 Permissions:`, JSON.stringify(permissions, null, 2));

        // Sync to Auth0
        await updateAuth0User(user.auth0_user_id, {
          role: user.role,
          permissions: permissions
        });

        console.log(`   ✅ Synced successfully`);
        successCount++;

      } catch (error) {
        console.error(`   ❌ Error syncing ${user.email}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Sync Summary:');
    console.log(`   Total Users: ${users.length}`);
    console.log(`   ✅ Synced: ${successCount}`);
    console.log(`   ⏭️  Skipped: ${skipCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log('='.repeat(60));

    if (successCount > 0) {
      console.log('\n✅ Permission sync completed successfully!');
      console.log('\nNext steps:');
      console.log('1. Update your Auth0 Action to read app_metadata.permissions');
      console.log('2. Add permissions to the token as custom claims');
      console.log('3. Update your backend to use token permissions if needed');
    }

  } catch (error) {
    console.error('❌ Fatal error during permission sync:', error);
  } finally {
    process.exit(0);
  }
}

// Run the sync
syncAllPermissions();

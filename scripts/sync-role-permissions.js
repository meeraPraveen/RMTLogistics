import { query } from '../server/config/database.js';
import { updateAuth0User } from '../server/services/auth0.service.js';
import { getRolePermissions } from '../server/services/permissions.service.js';

/**
 * Sync permissions to Auth0 for all users of a specific role
 * Use this after updating role_permissions in the database
 *
 * Usage: node scripts/sync-role-permissions.js Admin
 */
async function syncRolePermissions() {
  try {
    const roleName = process.argv[2];

    if (!roleName) {
      console.error('❌ Error: Please provide a role name');
      console.log('Usage: node scripts/sync-role-permissions.js <RoleName>');
      console.log('Example: node scripts/sync-role-permissions.js Admin');
      process.exit(1);
    }

    console.log(`🔄 Syncing permissions for role: ${roleName}\n`);

    // Get current permissions for the role from database
    const permissions = await getRolePermissions(roleName);

    if (Object.keys(permissions).length === 0) {
      console.log(`⚠️  No permissions found for role: ${roleName}`);
      console.log('   Check if the role exists in role_permissions table');
      process.exit(1);
    }

    console.log('📋 Current permissions in database:');
    Object.keys(permissions).forEach(module => {
      console.log(`   ${module}:`, permissions[module].join(', '));
    });
    console.log('');

    // Get all users with this role
    const result = await query(
      'SELECT id, auth0_user_id, email, name, role FROM users WHERE role = $1 ORDER BY email',
      [roleName]
    );

    const users = result.rows;

    if (users.length === 0) {
      console.log(`⚠️  No users found with role: ${roleName}`);
      process.exit(0);
    }

    console.log(`📊 Found ${users.length} user(s) with role ${roleName}:\n`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const user of users) {
      console.log(`👤 Processing: ${user.email}`);

      // Skip users without Auth0 ID or pending users
      if (!user.auth0_user_id || user.auth0_user_id.startsWith('pending_')) {
        console.log(`   ⏭️  Skipped - No Auth0 ID or pending`);
        skipCount++;
        continue;
      }

      try {
        // Sync updated permissions to Auth0
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
    console.log(`   Role: ${roleName}`);
    console.log(`   Total Users: ${users.length}`);
    console.log(`   ✅ Synced: ${successCount}`);
    console.log(`   ⏭️  Skipped: ${skipCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log('='.repeat(60));

    if (successCount > 0) {
      console.log('\n✅ Permission sync completed successfully!');
      console.log('\n📝 Note: Users will see updated permissions after they logout and login again.');
      console.log('   (Auth0 Action will add the new permissions to their token)');
    }

  } catch (error) {
    console.error('❌ Fatal error during permission sync:', error);
  } finally {
    process.exit(0);
  }
}

// Run the sync
syncRolePermissions();

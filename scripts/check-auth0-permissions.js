import { getAuth0UserByEmail } from '../server/services/auth0.service.js';

/**
 * Check Auth0 permissions for a user
 * Usage: node scripts/check-auth0-permissions.js user@example.com
 */
async function checkAuth0Permissions() {
  try {
    const email = process.argv[2];

    if (!email) {
      console.error('❌ Error: Please provide an email address');
      console.log('Usage: node scripts/check-auth0-permissions.js user@example.com');
      process.exit(1);
    }

    console.log(`🔍 Checking Auth0 permissions for: ${email}\n`);

    // Search for user by email
    const user = await getAuth0UserByEmail(email);

    if (!user) {
      console.log(`❌ User not found in Auth0: ${email}`);
      process.exit(1);
    }

    console.log('📊 User Details:');
    console.log(`   User ID: ${user.user_id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Connection: ${user.identities?.[0]?.connection || 'N/A'}`);
    console.log(`   Last Login: ${user.last_login || 'Never'}`);
    console.log(`   Email Verified: ${user.email_verified}`);

    console.log('\n📋 App Metadata:');
    if (user.app_metadata) {
      console.log('   Role:', user.app_metadata.role || 'Not set');
      console.log('   DB Synced:', user.app_metadata.db_synced || false);
      console.log('   Synced At:', user.app_metadata.synced_at || 'Never');

      if (user.app_metadata.permissions) {
        console.log('\n   Permissions:');
        const permissions = user.app_metadata.permissions;
        Object.keys(permissions).forEach(module => {
          console.log(`     ${module}:`, permissions[module].join(', '));
        });

        console.log(`\n   Total Modules: ${Object.keys(permissions).length}`);
      } else {
        console.log('\n   ⚠️  Permissions: Not synced');
        console.log('   Run: node scripts/sync-all-permissions.js');
      }
    } else {
      console.log('   ⚠️  No app_metadata found');
      console.log('   User may not have been synced from database yet');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Check complete');

    if (!user.app_metadata?.permissions) {
      console.log('\n💡 Tip: Run sync-all-permissions.js to sync permissions');
    }

  } catch (error) {
    console.error('❌ Error checking Auth0 permissions:', error.message);
  } finally {
    process.exit(0);
  }
}

checkAuth0Permissions();

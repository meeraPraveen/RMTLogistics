/**
 * Test Script: Verify Role Updates Sync to Auth0
 *
 * This script tests if updating a user's role in the database
 * properly syncs to Auth0's app_metadata
 */

import dotenv from 'dotenv';
import { ManagementClient } from 'auth0';
import { updateUser, getUserByAuth0Id } from '../server/services/user.service.js';

dotenv.config();

// Initialize Auth0 Management Client
const auth0Management = new ManagementClient({
  domain: process.env.AUTH0_MGMT_DOMAIN,
  clientId: process.env.AUTH0_MGMT_CLIENT_ID,
  clientSecret: process.env.AUTH0_MGMT_CLIENT_SECRET
});

/**
 * Get Auth0 user details including app_metadata
 */
async function getAuth0UserDetails(auth0UserId) {
  try {
    const user = await auth0Management.users.get(auth0UserId);
    return {
      user_id: user.user_id,
      email: user.email,
      name: user.name,
      app_metadata: user.app_metadata || {},
      blocked: user.blocked
    };
  } catch (error) {
    console.error('Error fetching Auth0 user:', error.message);
    return null;
  }
}

/**
 * Test role update sync
 */
async function testRoleUpdateSync() {
  console.log('\n🧪 Testing Role Update → Auth0 Sync\n');
  console.log('═'.repeat(60));

  // Step 1: Get test user email from command line or use default
  const testEmail = process.argv[2] || 'test@example.com';

  console.log(`\n📧 Test User Email: ${testEmail}`);

  try {
    // Step 2: Find user in database by email
    console.log('\n1️⃣  Fetching user from database...');
    const users = await auth0Management.users.listUsersByEmail({ email: testEmail });

    if (!users || users.length === 0) {
      console.log(`❌ User ${testEmail} not found in Auth0`);
      console.log('Please provide a valid user email:');
      console.log('   node scripts/test-role-sync.js your-email@example.com');
      process.exit(1);
    }

    const auth0UserId = users[0].user_id;
    const dbUser = await getUserByAuth0Id(auth0UserId);

    if (!dbUser) {
      console.log(`❌ User ${testEmail} not found in database`);
      process.exit(1);
    }

    console.log(`✅ User found in database:`);
    console.log(`   - ID: ${dbUser.id}`);
    console.log(`   - Auth0 ID: ${dbUser.auth0_user_id}`);
    console.log(`   - Current Role (DB): ${dbUser.role}`);
    console.log(`   - Current Role (Auth0): ${dbUser.auth0_role || 'Not set'}`);

    // Step 3: Get current Auth0 state
    console.log('\n2️⃣  Fetching current Auth0 state...');
    const beforeAuth0 = await getAuth0UserDetails(dbUser.auth0_user_id);

    if (!beforeAuth0) {
      console.log(`❌ Could not fetch Auth0 user details`);
      process.exit(1);
    }

    console.log(`✅ Current Auth0 state:`);
    console.log(`   - Name: ${beforeAuth0.name}`);
    console.log(`   - Blocked: ${beforeAuth0.blocked}`);
    console.log(`   - Role in app_metadata: ${beforeAuth0.app_metadata.role || 'Not set'}`);

    // Step 4: Determine new role for testing
    const currentRole = dbUser.role;
    const testRoles = ['SuperAdmin', 'Admin', 'Lead Artist', 'Artist', 'Production Tech'];
    const newRole = testRoles.find(r => r !== currentRole) || 'Artist';

    console.log(`\n3️⃣  Updating role: ${currentRole} → ${newRole}...`);

    // Step 5: Update user role
    const updatedUser = await updateUser(dbUser.id, { role: newRole });

    console.log(`✅ Database updated successfully`);
    console.log(`   - New Role (DB): ${updatedUser.role}`);

    // Step 6: Verify Auth0 was updated
    console.log('\n4️⃣  Verifying Auth0 sync...');

    // Wait a moment for sync to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    const afterAuth0 = await getAuth0UserDetails(dbUser.auth0_user_id);

    if (!afterAuth0) {
      console.log(`❌ Could not fetch updated Auth0 user details`);
      process.exit(1);
    }

    console.log(`✅ Auth0 state after update:`);
    console.log(`   - Name: ${afterAuth0.name}`);
    console.log(`   - Blocked: ${afterAuth0.blocked}`);
    console.log(`   - Role in app_metadata: ${afterAuth0.app_metadata.role || 'Not set'}`);

    // Step 7: Verify sync was successful
    console.log('\n5️⃣  Verification Results:');
    console.log('═'.repeat(60));

    const dbRoleMatch = updatedUser.role === newRole;
    const auth0RoleMatch = afterAuth0.app_metadata.role === newRole;
    const syncSuccessful = dbRoleMatch && auth0RoleMatch;

    console.log(`   Database Update:     ${dbRoleMatch ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`   Auth0 Sync:          ${auth0RoleMatch ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`   Overall Status:      ${syncSuccessful ? '✅ PASSED' : '❌ FAILED'}`);

    if (syncSuccessful) {
      console.log(`\n✅ TEST PASSED: Role update synced successfully to Auth0!`);
      console.log(`   - Database role: ${updatedUser.role}`);
      console.log(`   - Auth0 app_metadata.role: ${afterAuth0.app_metadata.role}`);
      console.log(`   - Last synced: ${afterAuth0.app_metadata.synced_at || 'Unknown'}`);
    } else {
      console.log(`\n❌ TEST FAILED: Role sync mismatch detected!`);
      console.log(`   - Database role: ${updatedUser.role}`);
      console.log(`   - Auth0 app_metadata.role: ${afterAuth0.app_metadata.role || 'Not set'}`);
    }

    // Step 8: Rollback to original role
    console.log(`\n6️⃣  Rolling back to original role: ${currentRole}...`);
    await updateUser(dbUser.id, { role: currentRole });
    console.log(`✅ Rollback complete`);

    console.log('\n' + '═'.repeat(60));
    console.log('🏁 Test completed successfully\n');

    process.exit(syncSuccessful ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testRoleUpdateSync();

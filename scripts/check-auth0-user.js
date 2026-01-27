import { getAuth0UserByEmail } from '../server/services/auth0.service.js';

async function checkAuth0User() {
  try {
    console.log('\n===========================================');
    console.log('🔍 CHECKING AUTH0 USER DATA');
    console.log('===========================================\n');

    const email = 'meerapraveen07@gmail.com';

    // Search for user by email
    const auth0User = await getAuth0UserByEmail(email);

    if (!auth0User) {
      console.log(`❌ User ${email} NOT found in Auth0`);
      return;
    }

    const user = auth0User;

    console.log(`✅ User found in Auth0:\n`);
    console.log(`📧 Email: ${user.email}`);
    console.log(`🆔 User ID: ${user.user_id}`);
    console.log(`👤 Name: ${user.name}`);
    console.log(`🔒 Email Verified: ${user.email_verified}`);
    console.log(`🚫 Blocked: ${user.blocked || false}`);
    console.log(`📅 Created: ${user.created_at}`);
    console.log(`🔄 Last Updated: ${user.updated_at}`);

    console.log(`\n📦 App Metadata:`);
    if (user.app_metadata) {
      console.log(JSON.stringify(user.app_metadata, null, 2));
    } else {
      console.log('  (No app metadata)');
    }

    console.log(`\n👤 User Metadata:`);
    if (user.user_metadata) {
      console.log(JSON.stringify(user.user_metadata, null, 2));
    } else {
      console.log('  (No user metadata)');
    }

    console.log('\n===========================================');

  } catch (error) {
    console.error('❌ Error checking Auth0 user:', error.message);
    if (error.statusCode) {
      console.error(`   Status Code: ${error.statusCode}`);
    }
  }
}

checkAuth0User();

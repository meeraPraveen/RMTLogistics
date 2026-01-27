import { ManagementClient } from 'auth0';
import dotenv from 'dotenv';

dotenv.config();

const auth0Management = new ManagementClient({
  domain: process.env.AUTH0_MGMT_DOMAIN,
  clientId: process.env.AUTH0_MGMT_CLIENT_ID,
  clientSecret: process.env.AUTH0_MGMT_CLIENT_SECRET,
});

async function debugListUsers() {
  try {
    console.log('\n===========================================');
    console.log('🔍 DEBUGGING LIST USERS BY EMAIL API');
    console.log('===========================================\n');

    const email = 'meerapraveen07@gmail.com';

    console.log(`Calling listUsersByEmail with:`, { email });

    const result = await auth0Management.users.listUsersByEmail({ email });

    console.log(`\nResult type:`, typeof result);
    console.log(`Result keys:`, Object.keys(result || {}));
    console.log(`\nFull result:`);
    console.log(JSON.stringify(result, null, 2));

    console.log('\n===========================================');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
  }
}

debugListUsers();

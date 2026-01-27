import { ManagementClient } from 'auth0';
import dotenv from 'dotenv';

dotenv.config();

const auth0Management = new ManagementClient({
  domain: process.env.AUTH0_MGMT_DOMAIN,
  clientId: process.env.AUTH0_MGMT_CLIENT_ID,
  clientSecret: process.env.AUTH0_MGMT_CLIENT_SECRET,
});

async function testUpdate() {
  try {
    const userId = 'google-oauth2|105248599389785182313';

    console.log('Updating user with app_metadata...');
    const response = await auth0Management.users.update(
      userId,
      {
        app_metadata: {
          role: 'Admin',
          db_synced: true,
          synced_at: new Date().toISOString()
        }
      }
    );

    console.log('\nResponse type:', typeof response);
    console.log('Response keys:', Object.keys(response || {}));
    console.log('\nFull response:');
    console.log(JSON.stringify(response, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testUpdate();

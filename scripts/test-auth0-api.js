import { ManagementClient } from 'auth0';
import dotenv from 'dotenv';

dotenv.config();

const auth0Management = new ManagementClient({
  domain: process.env.AUTH0_MGMT_DOMAIN,
  clientId: process.env.AUTH0_MGMT_CLIENT_ID,
  clientSecret: process.env.AUTH0_MGMT_CLIENT_SECRET,
});

console.log('\nAvailable methods on auth0Management.users:');
console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(auth0Management.users)).filter(n => n !== 'constructor'));

import jwt from 'jsonwebtoken';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Test Unauthorized User Access
 * Tests that users NOT in our database are blocked, even if they authenticate with Auth0
 */

const API_BASE_URL = 'http://localhost:3001';

// User who EXISTS in Auth0 but NOT in our PostgreSQL database
const UNAUTHORIZED_USER = {
  email: 'unauthorized@example.com',
  sub: 'google-oauth2|999999999999999999',
  name: 'Unauthorized User',
  email_verified: true,
  iss: `https://${process.env.AUTH0_DOMAIN}/`,
  aud: process.env.AUTH0_CLIENT_ID,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 86400
};

// User who EXISTS in both Auth0 AND our database
const AUTHORIZED_USER = {
  email: 'meerapraveen07@gmail.com',
  sub: 'google-oauth2|109876543210987654321',
  name: 'Meera Praveen',
  email_verified: true,
  iss: `https://${process.env.AUTH0_DOMAIN}/`,
  aud: process.env.AUTH0_CLIENT_ID,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 86400
};

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║           UNAUTHORIZED USER ACCESS TEST                        ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

let testsPassed = 0;
let testsFailed = 0;

function logTest(testName, passed, details = '') {
  const icon = passed ? '✅' : '❌';
  const status = passed ? 'PASS' : 'FAIL';
  console.log(`${icon} ${testName}: ${status}`);
  if (details) {
    console.log(`   ${details}`);
  }
  if (passed) testsPassed++;
  else testsFailed++;
}

async function runTests() {
  try {
    console.log('🧪 Testing Authorization Flow\n');
    console.log('Expected behavior:');
    console.log('1. Auth0 authenticates users (validates their identity)');
    console.log('2. Our app authorizes users (checks database for permissions)');
    console.log('3. Users NOT in database should be DENIED access (403)\n');
    console.log('─'.repeat(65) + '\n');

    // ============================================
    // TEST 1: Unauthorized User Access
    // ============================================
    console.log('🚫 TEST 1: UNAUTHORIZED USER (Not in Database)\n');

    const unauthorizedToken = jwt.sign(UNAUTHORIZED_USER, 'test-secret', { algorithm: 'HS256' });
    console.log(`User: ${UNAUTHORIZED_USER.email}`);
    console.log(`Auth0 ID: ${UNAUTHORIZED_USER.sub}`);
    console.log(`Expected: 403 Forbidden (user not in database)\n`);

    try {
      await axios.get(`${API_BASE_URL}/api/permissions/user/me`, {
        headers: { 'Authorization': `Bearer ${unauthorizedToken}` }
      });
      logTest('Block unauthorized user', false, 'User was allowed access (should be blocked!)');
    } catch (error) {
      if (error.response?.status === 403) {
        logTest('Block unauthorized user', true,
          `Correctly blocked with 403: ${error.response.data.message}`);
      } else {
        logTest('Block unauthorized user', false,
          `Wrong status code: ${error.response?.status || 'unknown'}`);
      }
    }

    // Try accessing a module endpoint
    try {
      await axios.get(`${API_BASE_URL}/api/modules/order-management`, {
        headers: { 'Authorization': `Bearer ${unauthorizedToken}` }
      });
      logTest('Block unauthorized user from modules', false,
        'User accessed module (should be blocked!)');
    } catch (error) {
      if (error.response?.status === 403) {
        logTest('Block unauthorized user from modules', true,
          'Correctly blocked with 403');
      } else {
        logTest('Block unauthorized user from modules', false,
          `Wrong status code: ${error.response?.status || 'unknown'}`);
      }
    }

    console.log('\n' + '─'.repeat(65) + '\n');

    // ============================================
    // TEST 2: Authorized User Access
    // ============================================
    console.log('✅ TEST 2: AUTHORIZED USER (In Database)\n');

    const authorizedToken = jwt.sign(AUTHORIZED_USER, 'test-secret', { algorithm: 'HS256' });
    console.log(`User: ${AUTHORIZED_USER.email}`);
    console.log(`Auth0 ID: ${AUTHORIZED_USER.sub}`);
    console.log(`Expected: 200 OK (user exists in database)\n`);

    try {
      const response = await axios.get(`${API_BASE_URL}/api/permissions/user/me`, {
        headers: { 'Authorization': `Bearer ${authorizedToken}` }
      });

      logTest('Allow authorized user', response.status === 200,
        `User granted access with role: ${response.data.data.role}`);

      const hasPermissions = Object.keys(response.data.data.permissions).length > 0;
      logTest('User has permissions from database', hasPermissions,
        `Found ${Object.keys(response.data.data.permissions).length} modules`);
    } catch (error) {
      logTest('Allow authorized user', false,
        `Error: ${error.response?.data?.message || error.message}`);
    }

    // Try accessing a module they have permission for
    try {
      const response = await axios.get(`${API_BASE_URL}/api/modules/order-management`, {
        headers: { 'Authorization': `Bearer ${authorizedToken}` }
      });

      logTest('Allow authorized user to access permitted modules', response.status === 200,
        'Successfully accessed Order Management module');
    } catch (error) {
      logTest('Allow authorized user to access permitted modules', false,
        `Error: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
    }

    console.log('\n' + '─'.repeat(65) + '\n');

    // ============================================
    // TEST 3: Verify Error Messages
    // ============================================
    console.log('📝 TEST 3: VERIFY ERROR MESSAGES\n');

    try {
      await axios.get(`${API_BASE_URL}/api/permissions/user/me`, {
        headers: { 'Authorization': `Bearer ${unauthorizedToken}` }
      });
    } catch (error) {
      const errorData = error.response?.data;

      logTest('Error has "Forbidden" status', errorData?.error === 'Forbidden');
      logTest('Error has clear message', errorData?.message?.includes('not authorized'));
      logTest('Error provides help text', errorData?.details?.includes('administrator'));
    }

    console.log('\n' + '─'.repeat(65) + '\n');

    // ============================================
    // SUMMARY
    // ============================================
    console.log('📊 TEST SUMMARY\n');

    const totalTests = testsPassed + testsFailed;
    const successRate = ((testsPassed / totalTests) * 100).toFixed(1);

    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   ✅ Passed: ${testsPassed}`);
    console.log(`   ❌ Failed: ${testsFailed}`);
    console.log(`   Success Rate: ${successRate}%`);

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    if (testsFailed === 0) {
      console.log('║         ✅ AUTHORIZATION WORKING CORRECTLY! ✅                  ║');
      console.log('║                                                                ║');
      console.log('║  • Unauthorized users are blocked (403)                        ║');
      console.log('║  • Authorized users can access their permitted resources       ║');
    } else {
      console.log('║              ⚠️  SOME TESTS FAILED - REVIEW ABOVE ⚠️            ║');
    }
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    process.exit(testsFailed > 0 ? 1 : 0);

  } catch (error) {
    console.error('\n❌ CRITICAL ERROR:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the tests
runTests();

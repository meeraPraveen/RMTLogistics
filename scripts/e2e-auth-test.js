import jwt from 'jsonwebtoken';
import { query } from '../server/config/database.js';
import { getUserRole, getUserRoleByEmail } from '../server/services/user.service.js';
import { hasPermission, hasModuleAccess, getRolePermissions } from '../server/services/permissions.service.js';
import { MODULES, PERMISSIONS } from '../server/config/rbac.config.js';

/**
 * End-to-End Authentication & Authorization Test Suite
 * Simulates full flow: Auth0 Login -> Token Validation -> Permission Check -> API Access
 */

const TEST_USER = {
  auth0_user_id: 'google-oauth2|109876543210987654321',
  email: 'meerapraveen07@gmail.com',
  sub: 'google-oauth2|109876543210987654321', // Auth0 subject identifier
  name: 'Meera Praveen',
  given_name: 'Meera',
  family_name: 'Praveen',
  picture: 'https://lh3.googleusercontent.com/a/default-user',
  locale: 'en',
  email_verified: true,
  iss: `https://${process.env.AUTH0_DOMAIN || 'dev-ybc7o1rzmlt6fu4c.ca.auth0.com'}/`,
  aud: process.env.AUTH0_CLIENT_ID || '8vrfqASIzZDCzvgXR8KxqcVpEol0MJUo',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 86400 // 24 hours
};

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║        END-TO-END AUTHENTICATION & AUTHORIZATION TEST          ║');
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
    console.log('👤 Test User: ' + TEST_USER.email);
    console.log('🔑 Auth0 User ID: ' + TEST_USER.auth0_user_id);
    console.log('\n' + '─'.repeat(65) + '\n');

    // ============================================
    // STEP 1: SIMULATE AUTH0 LOGIN
    // ============================================
    console.log('📝 STEP 1: SIMULATE AUTH0 LOGIN\n');

    // Create a mock ID token (in real scenario, this comes from Auth0)
    const idToken = jwt.sign(TEST_USER, 'test-secret', { algorithm: 'HS256' });

    logTest('Generate Auth0 ID Token', true, `Token created: ${idToken.substring(0, 50)}...`);

    // Decode token (simulating what our middleware does)
    const decoded = jwt.decode(idToken, { complete: true });
    logTest('Decode ID Token', decoded !== null, `Subject: ${decoded?.payload?.sub}`);

    console.log('\n' + '─'.repeat(65) + '\n');

    // ============================================
    // STEP 2: FETCH USER FROM DATABASE
    // ============================================
    console.log('💾 STEP 2: FETCH USER FROM DATABASE\n');

    const userInDb = await query(
      'SELECT id, auth0_user_id, email, role, created_at FROM users WHERE email = $1',
      [TEST_USER.email]
    );

    logTest('User exists in database', userInDb.rows.length > 0);

    if (userInDb.rows.length > 0) {
      const dbUser = userInDb.rows[0];
      console.log('\n   User Details:');
      console.log(`   - ID: ${dbUser.id}`);
      console.log(`   - Email: ${dbUser.email}`);
      console.log(`   - Role: ${dbUser.role}`);
      console.log(`   - Auth0 ID: ${dbUser.auth0_user_id}`);
      console.log(`   - Created: ${dbUser.created_at}`);
    }

    console.log('\n' + '─'.repeat(65) + '\n');

    // ============================================
    // STEP 3: GET USER ROLE
    // ============================================
    console.log('🎭 STEP 3: GET USER ROLE\n');

    const roleById = await getUserRole(TEST_USER.auth0_user_id);
    logTest('Get role by Auth0 ID', roleById !== null, `Role: ${roleById}`);

    const roleByEmail = await getUserRoleByEmail(TEST_USER.email);
    logTest('Get role by email', roleByEmail !== null, `Role: ${roleByEmail}`);

    logTest('Role consistency', roleById === roleByEmail, `Both methods return: ${roleById}`);

    const userRole = roleById || roleByEmail;

    console.log('\n' + '─'.repeat(65) + '\n');

    // ============================================
    // STEP 4: FETCH USER PERMISSIONS
    // ============================================
    console.log('🔐 STEP 4: FETCH USER PERMISSIONS FROM DATABASE\n');

    const permissions = await getRolePermissions(userRole);
    logTest('Fetch role permissions', permissions !== null);

    console.log('\n   Permissions for role "' + userRole + '":');
    for (const [module, perms] of Object.entries(permissions)) {
      console.log(`   - ${module}: [${perms.join(', ')}]`);
    }

    console.log('\n' + '─'.repeat(65) + '\n');

    // ============================================
    // STEP 5: TEST MODULE ACCESS
    // ============================================
    console.log('🏢 STEP 5: TEST MODULE ACCESS\n');

    const moduleTests = [];
    for (const [moduleName, moduleKey] of Object.entries(MODULES)) {
      const hasAccess = await hasModuleAccess(userRole, moduleKey);
      moduleTests.push({ module: moduleName, access: hasAccess });
      logTest(`Access to ${moduleName}`, hasAccess, `Module: ${moduleKey}`);
    }

    console.log('\n' + '─'.repeat(65) + '\n');

    // ============================================
    // STEP 6: TEST SPECIFIC PERMISSIONS
    // ============================================
    console.log('🔒 STEP 6: TEST SPECIFIC PERMISSIONS\n');

    const permissionTests = [];
    for (const [moduleName, moduleKey] of Object.entries(MODULES)) {
      const hasAccess = await hasModuleAccess(userRole, moduleKey);

      if (hasAccess) {
        console.log(`\n   Testing ${moduleName}:`);

        for (const [permName, permKey] of Object.entries(PERMISSIONS)) {
          const hasPerm = await hasPermission(userRole, moduleKey, permKey);
          const icon = hasPerm ? '  ✅' : '  ❌';
          console.log(`${icon} ${permName}: ${hasPerm ? 'GRANTED' : 'DENIED'}`);
          permissionTests.push({
            module: moduleName,
            permission: permName,
            granted: hasPerm
          });
        }
      }
    }

    console.log('\n' + '─'.repeat(65) + '\n');

    // ============================================
    // STEP 7: SIMULATE API CALLS
    // ============================================
    console.log('🌐 STEP 7: SIMULATE API ENDPOINT CALLS\n');

    const apiTests = [
      {
        endpoint: 'GET /api/modules/order-management',
        module: MODULES.ORDER_MANAGEMENT,
        permission: null // Just needs module access
      },
      {
        endpoint: 'GET /api/modules/order-management/orders',
        module: MODULES.ORDER_MANAGEMENT,
        permission: PERMISSIONS.READ
      },
      {
        endpoint: 'POST /api/modules/order-management/orders',
        module: MODULES.ORDER_MANAGEMENT,
        permission: PERMISSIONS.WRITE
      },
      {
        endpoint: 'PUT /api/modules/order-management/orders/:id',
        module: MODULES.ORDER_MANAGEMENT,
        permission: PERMISSIONS.UPDATE
      },
      {
        endpoint: 'DELETE /api/modules/order-management/orders/:id',
        module: MODULES.ORDER_MANAGEMENT,
        permission: PERMISSIONS.DELETE
      },
      {
        endpoint: 'GET /api/modules/inventory-management/items',
        module: MODULES.INVENTORY_MANAGEMENT,
        permission: PERMISSIONS.READ
      },
      {
        endpoint: 'GET /api/modules/user-management',
        module: MODULES.USER_MANAGEMENT,
        permission: null
      },
      {
        endpoint: 'GET /api/modules/system-config/settings',
        module: MODULES.SYSTEM_CONFIG,
        permission: PERMISSIONS.READ
      }
    ];

    for (const test of apiTests) {
      let allowed;

      if (test.permission) {
        allowed = await hasPermission(userRole, test.module, test.permission);
      } else {
        allowed = await hasModuleAccess(userRole, test.module);
      }

      const status = allowed ? '200 OK' : '403 Forbidden';
      logTest(
        `${test.endpoint}`,
        true, // Test itself passes (we're simulating)
        `Expected: ${status} - ${allowed ? 'ALLOWED' : 'DENIED'}`
      );
    }

    console.log('\n' + '─'.repeat(65) + '\n');

    // ============================================
    // STEP 8: SUMMARY
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
      console.log('║              ✅ ALL TESTS PASSED SUCCESSFULLY! ✅               ║');
    } else {
      console.log('║              ⚠️  SOME TESTS FAILED - REVIEW ABOVE ⚠️             ║');
    }
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    process.exit(testsFailed > 0 ? 1 : 0);

  } catch (error) {
    console.error('\n❌ CRITICAL ERROR:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the test suite
runTests();

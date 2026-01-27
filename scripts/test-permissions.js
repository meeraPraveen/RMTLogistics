import { query } from '../server/config/database.js';
import { getRolePermissions, hasPermission, hasModuleAccess } from '../server/services/permissions.service.js';
import { MODULES, PERMISSIONS } from '../server/config/rbac.config.js';

/**
 * Test script to display current user permissions from the database
 */

const testUser = {
  email: 'admin@example.com',
  role: 'Admin' // Change this to test different roles: 'SuperAdmin', 'Admin', 'Lead Artist', 'Artist', 'Production Tech'
};

console.log('\n===========================================');
console.log('🧪 TESTING USER PERMISSIONS');
console.log('===========================================\n');

console.log(`👤 User: ${testUser.email}`);
console.log(`🎭 Role: ${testUser.role}\n`);

async function testPermissions() {
  try {
    // Test 1: Get all permissions for the role
    console.log('📋 Fetching all permissions for role...\n');
    const rolePermissions = await getRolePermissions(testUser.role);

    console.log('✅ Role Permissions from Database:');
    console.log(JSON.stringify(rolePermissions, null, 2));
    console.log('\n');

    // Test 2: Check module access
    console.log('🔍 Testing Module Access:\n');

    for (const [moduleName, moduleKey] of Object.entries(MODULES)) {
      const hasAccess = await hasModuleAccess(testUser.role, moduleKey);
      const icon = hasAccess ? '✅' : '❌';
      console.log(`${icon} ${moduleName} (${moduleKey}): ${hasAccess ? 'GRANTED' : 'DENIED'}`);
    }
    console.log('\n');

    // Test 3: Check specific permissions for each module
    console.log('🔐 Testing Specific Permissions:\n');

    for (const [moduleName, moduleKey] of Object.entries(MODULES)) {
      const hasAccess = await hasModuleAccess(testUser.role, moduleKey);

      if (hasAccess) {
        console.log(`📦 ${moduleName}:`);

        for (const [permName, permKey] of Object.entries(PERMISSIONS)) {
          const hasPerm = await hasPermission(testUser.role, moduleKey, permKey);
          const icon = hasPerm ? '  ✅' : '  ❌';
          console.log(`${icon} ${permName}: ${hasPerm ? 'YES' : 'NO'}`);
        }
        console.log('');
      }
    }

    // Test 4: Direct database query to show raw data
    console.log('💾 Raw Database Query:\n');
    const result = await query(
      'SELECT role, module, permissions, created_at, updated_at FROM role_permissions WHERE role = $1 ORDER BY module',
      [testUser.role]
    );

    if (result.rows.length === 0) {
      console.log(`⚠️  No permissions found in database for role: ${testUser.role}`);
    } else {
      console.table(result.rows);
    }

    console.log('\n===========================================');
    console.log('✅ Test completed successfully!');
    console.log('===========================================\n');

  } catch (error) {
    console.error('\n❌ Error during test:', error.message);
    console.error(error);
  } finally {
    process.exit(0);
  }
}

// Run the test
testPermissions();

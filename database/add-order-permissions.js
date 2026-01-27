import { query } from '../server/config/database.js';

async function addOrderPermissions() {
  try {
    console.log('🔧 Adding Order Management permissions...\n');

    // Check if order_management permissions already exist for SuperAdmin
    const existingResult = await query(
      `SELECT * FROM role_permissions WHERE role = 'SuperAdmin' AND module = 'order_management'`
    );

    if (existingResult.rows.length > 0) {
      console.log('✅ Order Management permissions already exist for SuperAdmin');
      console.log('Current permissions:', existingResult.rows[0].permissions);
    } else {
      // Add order_management permissions for SuperAdmin
      await query(
        `INSERT INTO role_permissions (role, module, permissions)
         VALUES ('SuperAdmin', 'order_management', $1)`,
        [JSON.stringify(['read', 'write', 'update', 'delete'])]
      );
      console.log('✅ Added Order Management permissions for SuperAdmin');
    }

    // Check if order_management permissions exist for Admin
    const adminResult = await query(
      `SELECT * FROM role_permissions WHERE role = 'Admin' AND module = 'order_management'`
    );

    if (adminResult.rows.length > 0) {
      console.log('✅ Order Management permissions already exist for Admin');
      console.log('Current permissions:', adminResult.rows[0].permissions);
    } else {
      // Add order_management permissions for Admin
      await query(
        `INSERT INTO role_permissions (role, module, permissions)
         VALUES ('Admin', 'order_management', $1)`,
        [JSON.stringify(['read', 'write', 'update', 'delete'])]
      );
      console.log('✅ Added Order Management permissions for Admin');
    }

    console.log('\n✅ Order Management permissions configured successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding permissions:', error);
    process.exit(1);
  }
}

addOrderPermissions();

import { query } from '../config/database.js';

/**
 * Permissions Service - Handles role-permission database operations
 */

/**
 * Get all permissions for a role
 * @param {string} role - Role name
 * @returns {Promise<Object>} - Object with module -> permissions mapping
 */
export const getRolePermissions = async (role) => {
  try {
    const result = await query(
      'SELECT module, permissions FROM role_permissions WHERE role = $1',
      [role]
    );

    // Convert to object format: { module: [permissions] }
    const permissions = {};
    result.rows.forEach((row) => {
      permissions[row.module] = row.permissions;
    });

    return permissions;
  } catch (error) {
    console.error('Error fetching role permissions:', error);
    throw error;
  }
};

/**
 * Get all role-permission mappings
 * @returns {Promise<Object>} - Object with role -> { module -> permissions } mapping
 */
export const getAllRolePermissions = async () => {
  try {
    const result = await query(
      'SELECT role, module, permissions FROM role_permissions ORDER BY role, module'
    );

    // Convert to nested object format
    const allPermissions = {};
    result.rows.forEach((row) => {
      if (!allPermissions[row.role]) {
        allPermissions[row.role] = {};
      }
      allPermissions[row.role][row.module] = row.permissions;
    });

    return allPermissions;
  } catch (error) {
    console.error('Error fetching all role permissions:', error);
    throw error;
  }
};

/**
 * Update permissions for a role and module
 * @param {string} role - Role name
 * @param {string} module - Module name
 * @param {Array<string>} permissions - Array of permissions
 * @returns {Promise<Object>} - Updated permission record
 */
export const updateRoleModulePermissions = async (role, module, permissions) => {
  try {
    const result = await query(
      `INSERT INTO role_permissions (role, module, permissions)
       VALUES ($1, $2, $3)
       ON CONFLICT (role, module)
       DO UPDATE SET permissions = $3, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [role, module, JSON.stringify(permissions)]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Error updating role module permissions:', error);
    throw error;
  }
};

/**
 * Update all permissions for a role
 * @param {string} role - Role name
 * @param {Object} modulePermissions - Object with module -> permissions mapping
 * @returns {Promise<Object>} - Updated permissions
 */
export const updateRolePermissions = async (role, modulePermissions) => {
  try {
    // Use a transaction to update all modules atomically
    const client = await query('BEGIN');

    try {
      // Delete existing permissions for this role
      await query('DELETE FROM role_permissions WHERE role = $1', [role]);

      // Insert new permissions
      for (const [module, permissions] of Object.entries(modulePermissions)) {
        if (permissions && permissions.length > 0) {
          await query(
            'INSERT INTO role_permissions (role, module, permissions) VALUES ($1, $2, $3)',
            [role, module, JSON.stringify(permissions)]
          );
        }
      }

      await query('COMMIT');

      return await getRolePermissions(role);
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error updating role permissions:', error);
    throw error;
  }
};

/**
 * Reset permissions to default values
 * @param {Object} defaultPermissions - Default permissions from config
 * @returns {Promise<boolean>} - True if successful
 */
export const resetToDefaultPermissions = async (defaultPermissions) => {
  try {
    // Delete all existing permissions
    await query('DELETE FROM role_permissions');

    // Insert default permissions
    for (const [role, modules] of Object.entries(defaultPermissions)) {
      for (const [module, permissions] of Object.entries(modules)) {
        if (permissions && permissions.length > 0) {
          await query(
            'INSERT INTO role_permissions (role, module, permissions) VALUES ($1, $2, $3)',
            [role, module, JSON.stringify(permissions)]
          );
        }
      }
    }

    return true;
  } catch (error) {
    console.error('Error resetting permissions:', error);
    throw error;
  }
};

/**
 * Check if a role has a specific permission for a module
 * @param {string} role - Role name
 * @param {string} module - Module name
 * @param {string} permission - Permission to check
 * @returns {Promise<boolean>} - True if role has the permission
 */
export const hasPermission = async (role, module, permission) => {
  try {
    const result = await query(
      `SELECT permissions FROM role_permissions
       WHERE role = $1 AND module = $2`,
      [role, module]
    );

    if (result.rows.length === 0) {
      return false;
    }

    const permissions = result.rows[0].permissions;
    return permissions.includes(permission);
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
};

/**
 * Check if a role has access to a module
 * @param {string} role - Role name
 * @param {string} module - Module name
 * @returns {Promise<boolean>} - True if role has access
 */
export const hasModuleAccess = async (role, module) => {
  try {
    const result = await query(
      `SELECT 1 FROM role_permissions
       WHERE role = $1 AND module = $2
       AND jsonb_array_length(permissions) > 0`,
      [role, module]
    );

    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking module access:', error);
    return false;
  }
};

/**
 * Delete permissions for a specific role and module
 * @param {string} role - Role name
 * @param {string} module - Module name
 * @returns {Promise<boolean>} - True if deleted
 */
export const deleteRoleModulePermissions = async (role, module) => {
  try {
    const result = await query(
      'DELETE FROM role_permissions WHERE role = $1 AND module = $2',
      [role, module]
    );

    return result.rowCount > 0;
  } catch (error) {
    console.error('Error deleting role module permissions:', error);
    throw error;
  }
};

/**
 * Delete all permissions for a role
 * @param {string} role - Role name
 * @returns {Promise<boolean>} - True if deleted
 */
export const deleteAllRolePermissions = async (role) => {
  try {
    const result = await query(
      'DELETE FROM role_permissions WHERE role = $1',
      [role]
    );

    return result.rowCount > 0;
  } catch (error) {
    console.error('Error deleting all role permissions:', error);
    throw error;
  }
};

/**
 * Create new permission entry for a role and module
 * @param {string} role - Role name
 * @param {string} module - Module name
 * @param {Array<string>} permissions - Array of permissions
 * @returns {Promise<Object>} - Created permission record
 */
export const createRoleModulePermissions = async (role, module, permissions) => {
  try {
    const result = await query(
      `INSERT INTO role_permissions (role, module, permissions)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [role, module, JSON.stringify(permissions)]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Error creating role module permissions:', error);
    throw error;
  }
};

/**
 * Sync role permissions to Auth0 for all users with that role
 * @param {string} role - Role name
 * @returns {Promise<Object>} - Sync result with counts
 */
export const syncRolePermissionsToAuth0 = async (role) => {
  try {
    const { updateAuth0User } = await import('./auth0.service.js');

    // Get current permissions for the role from database
    const permissions = await getRolePermissions(role);

    // Get all users with this role
    const result = await query(
      'SELECT id, auth0_user_id, email FROM users WHERE role = $1',
      [role]
    );

    const users = result.rows;
    let synced = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of users) {
      // Skip users without Auth0 ID or pending users
      if (!user.auth0_user_id || user.auth0_user_id.startsWith('pending_')) {
        skipped++;
        continue;
      }

      try {
        // Sync to Auth0
        await updateAuth0User(user.auth0_user_id, {
          role: role,
          permissions: permissions
        });
        synced++;
      } catch (error) {
        console.error(`Failed to sync permissions to Auth0 for ${user.email}:`, error.message);
        errors++;
      }
    }

    return {
      role,
      total: users.length,
      synced,
      skipped,
      errors
    };
  } catch (error) {
    console.error('Error syncing role permissions to Auth0:', error);
    throw error;
  }
};

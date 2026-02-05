/**
 * RBAC Configuration - Role-Based Access Control
 * Defines permissions for each role across different modules
 *
 * NOTE: This file now exports constants and default values.
 * Actual permissions are stored in PostgreSQL database.
 * Use permissions.service.js to interact with the database.
 */

import * as permissionsService from '../services/permissions.service.js';

export const MODULES = {
  USER_MANAGEMENT: 'user_management',
  ORDER_MANAGEMENT: 'order_management',
  INVENTORY_MANAGEMENT: 'inventory_management',
  PRINTING_SOFTWARE: 'printing_software',
  SYSTEM_CONFIG: 'system_config'
};

export const PERMISSIONS = {
  READ: 'read',
  WRITE: 'write',
  UPDATE: 'update',
  DELETE: 'delete'
};

export const ROLES = {
  SUPER_ADMIN: 'SuperAdmin',
  ADMIN: 'Admin',
  LEAD_ARTIST: 'Lead Artist',
  ARTIST: 'Artist',
  PRODUCTION_TECH: 'Production Tech',
  B2B_USER: 'B2B User'
};

/**
 * Default role-permission mappings
 * Structure: { role: { module: [permissions] } }
 */
export const rolePermissions = {
  [ROLES.SUPER_ADMIN]: {
    [MODULES.USER_MANAGEMENT]: [PERMISSIONS.READ, PERMISSIONS.WRITE, PERMISSIONS.UPDATE, PERMISSIONS.DELETE],
    [MODULES.ORDER_MANAGEMENT]: [PERMISSIONS.READ, PERMISSIONS.WRITE, PERMISSIONS.UPDATE, PERMISSIONS.DELETE],
    [MODULES.INVENTORY_MANAGEMENT]: [PERMISSIONS.READ, PERMISSIONS.WRITE, PERMISSIONS.UPDATE, PERMISSIONS.DELETE],
    [MODULES.PRINTING_SOFTWARE]: [PERMISSIONS.READ, PERMISSIONS.WRITE, PERMISSIONS.UPDATE, PERMISSIONS.DELETE],
    [MODULES.SYSTEM_CONFIG]: [PERMISSIONS.READ, PERMISSIONS.WRITE, PERMISSIONS.UPDATE, PERMISSIONS.DELETE]
  },
  [ROLES.ADMIN]: {
    [MODULES.ORDER_MANAGEMENT]: [PERMISSIONS.READ, PERMISSIONS.WRITE, PERMISSIONS.UPDATE, PERMISSIONS.DELETE],
    [MODULES.INVENTORY_MANAGEMENT]: [PERMISSIONS.READ, PERMISSIONS.WRITE, PERMISSIONS.UPDATE, PERMISSIONS.DELETE],
    [MODULES.PRINTING_SOFTWARE]: [PERMISSIONS.READ, PERMISSIONS.WRITE, PERMISSIONS.UPDATE, PERMISSIONS.DELETE]
  },
  [ROLES.LEAD_ARTIST]: {
    [MODULES.ORDER_MANAGEMENT]: [PERMISSIONS.READ, PERMISSIONS.WRITE, PERMISSIONS.UPDATE]
  },
  [ROLES.ARTIST]: {
    // Artist has no default permissions - can be configured via User Management
  },
  [ROLES.PRODUCTION_TECH]: {
    [MODULES.PRINTING_SOFTWARE]: [PERMISSIONS.READ, PERMISSIONS.WRITE, PERMISSIONS.UPDATE]
  },
  [ROLES.B2B_USER]: {
    [MODULES.ORDER_MANAGEMENT]: [PERMISSIONS.READ, PERMISSIONS.WRITE, PERMISSIONS.UPDATE, PERMISSIONS.DELETE]
  }
};

/**
 * Database-backed permission functions
 * These now delegate to the permissions service (PostgreSQL)
 */

export const getRolePermissions = async (role) => {
  const { getRolePermissions: getFromDb } = await import('../services/permissions.service.js');
  return await getFromDb(role);
};

export const getAllRolePermissions = async () => {
  const { getAllRolePermissions: getFromDb } = await import('../services/permissions.service.js');
  return await getFromDb();
};

export const updateRolePermissions = async (role, modulePermissions) => {
  const { updateRolePermissions: updateInDb } = await import('../services/permissions.service.js');
  return await updateInDb(role, modulePermissions);
};

export const resetPermissions = async () => {
  const { resetToDefaultPermissions } = await import('../services/permissions.service.js');
  return await resetToDefaultPermissions(rolePermissions);
};

export const hasPermission = async (userRole, module, permission) => {
  const { hasPermission: checkInDb } = await import('../services/permissions.service.js');
  return await checkInDb(userRole, module, permission);
};

export const hasModuleAccess = async (userRole, module) => {
  const { hasModuleAccess: checkInDb } = await import('../services/permissions.service.js');
  return await checkInDb(userRole, module);
};

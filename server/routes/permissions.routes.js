import express from 'express';
import {
  MODULES,
  PERMISSIONS,
  ROLES,
  getAllRolePermissions,
  getRolePermissions,
  updateRolePermissions,
  resetPermissions
} from '../config/rbac.config.js';
import { requireModule, requireSuperAdmin } from '../middleware/rbac.middleware.js';

const router = express.Router();

/**
 * GET /api/permissions
 * Get all role-permission mappings
 * Accessible by SuperAdmin only
 */
router.get('/', requireModule(MODULES.USER_MANAGEMENT), async (req, res) => {
  try {
    const permissions = await getAllRolePermissions();
    res.json({
      success: true,
      data: permissions,
      metadata: {
        roles: Object.values(ROLES),
        modules: Object.values(MODULES),
        permissions: Object.values(PERMISSIONS)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve permissions',
      message: error.message
    });
  }
});

/**
 * GET /api/permissions/user/me
 * Get current user's permissions
 * Accessible by all authenticated users
 * IMPORTANT: This must come before /:role to avoid route conflicts
 */
router.get('/user/me', async (req, res) => {
  try {
    const userRole = req.user?.role;

    if (!userRole) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User role not found'
      });
    }

    const permissions = await getRolePermissions(userRole);

    res.json({
      success: true,
      data: {
        role: userRole,
        auth0Role: req.user?.auth0Role,
        roleMismatch: req.user?.roleMismatch || false,
        email: req.user.email,
        permissions,
        accessibleModules: Object.keys(permissions)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve user permissions',
      message: error.message
    });
  }
});

/**
 * GET /api/permissions/:role
 * Get permissions for a specific role
 * Accessible by SuperAdmin only
 */
router.get('/:role', requireModule(MODULES.USER_MANAGEMENT), async (req, res) => {
  try {
    const { role } = req.params;

    if (!Object.values(ROLES).includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role',
        message: `Role must be one of: ${Object.values(ROLES).join(', ')}`
      });
    }

    const permissions = await getRolePermissions(role);
    console.log(`📋 Permissions for ${role}:`, JSON.stringify(permissions, null, 2));
    res.json({
      success: true,
      data: {
        role,
        permissions
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve role permissions',
      message: error.message
    });
  }
});

/**
 * PUT /api/permissions/:role
 * Update permissions for a specific role
 * Accessible by SuperAdmin only
 */
router.put('/:role', requireModule(MODULES.USER_MANAGEMENT), async (req, res) => {
  try {
    const { role } = req.params;
    const { permissions: modulePermissions } = req.body;

    if (!Object.values(ROLES).includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role',
        message: `Role must be one of: ${Object.values(ROLES).join(', ')}`
      });
    }

    // Validate module permissions structure
    for (const [module, permissions] of Object.entries(modulePermissions)) {
      if (!Object.values(MODULES).includes(module)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid module',
          message: `Module '${module}' is not valid`
        });
      }

      if (!Array.isArray(permissions)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid permissions format',
          message: 'Permissions must be an array'
        });
      }

      for (const permission of permissions) {
        if (!Object.values(PERMISSIONS).includes(permission)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid permission',
            message: `Permission '${permission}' is not valid`
          });
        }
      }
    }

    const updatedPermissions = await updateRolePermissions(role, modulePermissions);

    res.json({
      success: true,
      message: `Permissions updated for role: ${role}`,
      data: {
        role,
        permissions: updatedPermissions
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update permissions',
      message: error.message
    });
  }
});

/**
 * POST /api/permissions/reset
 * Reset all permissions to default
 * Accessible by SuperAdmin only
 */
router.post('/reset', requireSuperAdmin, async (req, res) => {
  try {
    const permissions = await resetPermissions();
    res.json({
      success: true,
      message: 'Permissions reset to default configuration',
      data: permissions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to reset permissions',
      message: error.message
    });
  }
});

/**
 * POST /api/permissions/:role/:module
 * Create permissions for a specific role and module
 * Accessible by SuperAdmin only
 */
router.post('/:role/:module', requireModule(MODULES.USER_MANAGEMENT), async (req, res) => {
  try {
    const { role, module } = req.params;
    const { permissions } = req.body;

    if (!Object.values(ROLES).includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role'
      });
    }

    if (!Object.values(MODULES).includes(module)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid module'
      });
    }

    if (!Array.isArray(permissions)) {
      return res.status(400).json({
        success: false,
        error: 'Permissions must be an array'
      });
    }

    const { createRoleModulePermissions } = await import('../services/permissions.service.js');
    const created = await createRoleModulePermissions(role, module, permissions);

    res.json({
      success: true,
      message: `Permissions created for ${role} on ${module}`,
      data: created
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create permissions',
      message: error.message
    });
  }
});

/**
 * PUT /api/permissions/:role/:module
 * Update permissions for a specific role and module
 * Accessible by SuperAdmin only
 */
router.put('/:role/:module', requireModule(MODULES.USER_MANAGEMENT), async (req, res) => {
  try {
    const { role, module } = req.params;
    const { permissions } = req.body;

    if (!Object.values(ROLES).includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role'
      });
    }

    if (!Object.values(MODULES).includes(module)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid module'
      });
    }

    if (!Array.isArray(permissions)) {
      return res.status(400).json({
        success: false,
        error: 'Permissions must be an array'
      });
    }

    const { updateRoleModulePermissions } = await import('../services/permissions.service.js');
    const updated = await updateRoleModulePermissions(role, module, permissions);

    res.json({
      success: true,
      message: `Permissions updated for ${role} on ${module}`,
      data: updated
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update permissions',
      message: error.message
    });
  }
});

/**
 * DELETE /api/permissions/:role/:module
 * Delete permissions for a specific role and module
 * Accessible by SuperAdmin only
 */
router.delete('/:role/:module', requireModule(MODULES.USER_MANAGEMENT), async (req, res) => {
  try {
    const { role, module } = req.params;

    if (!Object.values(ROLES).includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role'
      });
    }

    if (!Object.values(MODULES).includes(module)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid module'
      });
    }

    const { deleteRoleModulePermissions } = await import('../services/permissions.service.js');
    const deleted = await deleteRoleModulePermissions(role, module);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Permission not found'
      });
    }

    res.json({
      success: true,
      message: `Permissions deleted for ${role} on ${module}`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete permissions',
      message: error.message
    });
  }
});

/**
 * DELETE /api/permissions/:role
 * Delete all permissions for a role
 * Accessible by SuperAdmin only
 */
router.delete('/:role', requireModule(MODULES.USER_MANAGEMENT), async (req, res) => {
  try {
    const { role } = req.params;

    if (!Object.values(ROLES).includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role'
      });
    }

    const { deleteAllRolePermissions } = await import('../services/permissions.service.js');
    const deleted = await deleteAllRolePermissions(role);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'No permissions found for this role'
      });
    }

    res.json({
      success: true,
      message: `All permissions deleted for ${role}`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete role permissions',
      message: error.message
    });
  }
});

export default router;

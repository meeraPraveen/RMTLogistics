import { hasPermission, hasModuleAccess } from '../config/rbac.config.js';

/**
 * RBAC Middleware - Checks if user has access to a specific module
 * Usage: requireModule(MODULES.ORDER_MANAGEMENT)
 */
export const requireModule = (module) => {
  return async (req, res, next) => {
    const userRole = req.user?.role;

    console.log(`🔍 RBAC Check - Module: ${module}, User Role: ${userRole}, User:`, req.user?.email);

    if (!userRole) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User role not found'
      });
    }

    const hasAccess = await hasModuleAccess(userRole, module);

    console.log(`🔍 hasModuleAccess result for ${userRole} on ${module}:`, hasAccess);

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Access denied to module: ${module}`,
        userRole,
        module
      });
    }

    next();
  };
};

/**
 * RBAC Middleware - Checks if user has a specific permission for a module
 * Usage: requirePermission(MODULES.ORDER_MANAGEMENT, PERMISSIONS.WRITE)
 */
export const requirePermission = (module, permission) => {
  return async (req, res, next) => {
    const userRole = req.user?.role;

    if (!userRole) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User role not found'
      });
    }

    const permitted = await hasPermission(userRole, module, permission);

    if (!permitted) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Permission denied. Required: ${permission} on ${module}`,
        userRole,
        module,
        requiredPermission: permission
      });
    }

    next();
  };
};

/**
 * Check if user has one of the specified roles
 * Usage: requireRole(['Admin', 'SuperAdmin'])
 */
export const requireRole = (roles) => {
  return (req, res, next) => {
    const userRole = req.user?.role;

    if (!userRole) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User role not found'
      });
    }

    if (!roles.includes(userRole)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. Required role: ${roles.join(' or ')}`,
        userRole,
        requiredRoles: roles
      });
    }

    next();
  };
};

/**
 * Check if user has SuperAdmin role
 */
export const requireSuperAdmin = (req, res, next) => {
  if (req.user?.role !== 'SuperAdmin') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'SuperAdmin access required'
    });
  }
  next();
};

/**
 * Attach user's module permissions to the response
 * Useful for frontend to know what features to show
 */
export const attachUserPermissions = (req, res, next) => {
  res.locals.userPermissions = {
    role: req.user?.role,
    modules: {}
  };
  next();
};

/**
 * Token-based permission checking functions
 * These check permissions from req.user.permissions (populated from JWT token)
 * No database queries - fast and scalable
 */

/**
 * Check if user has access to a module (has any permission for it)
 * @param {Object} userPermissions - Permissions object from token
 * @param {string} module - Module name
 * @returns {boolean}
 */
const hasModuleAccessFromToken = (userPermissions, module) => {
  if (!userPermissions || typeof userPermissions !== 'object') {
    return false;
  }
  const modulePerms = userPermissions[module];
  return Array.isArray(modulePerms) && modulePerms.length > 0;
};

/**
 * Check if user has a specific permission for a module
 * @param {Object} userPermissions - Permissions object from token
 * @param {string} module - Module name
 * @param {string} permission - Permission name (read, write, update, delete)
 * @returns {boolean}
 */
const hasPermissionFromToken = (userPermissions, module, permission) => {
  if (!userPermissions || typeof userPermissions !== 'object') {
    return false;
  }
  const modulePerms = userPermissions[module];
  return Array.isArray(modulePerms) && modulePerms.includes(permission);
};

/**
 * RBAC Middleware - Checks if user has access to a specific module
 * TOKEN-BASED: Uses permissions from JWT token (req.user.permissions)
 * Usage: requireModule(MODULES.ORDER_MANAGEMENT)
 */
export const requireModule = (module) => {
  return (req, res, next) => {
    const userRole = req.user?.role;
    const userPermissions = req.user?.permissions;

    console.log(`🔍 Token-based RBAC - Module: ${module}, User: ${req.user?.email}, Role: ${userRole}`);

    if (!userRole) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User role not found'
      });
    }

    const hasAccess = hasModuleAccessFromToken(userPermissions, module);

    console.log(`🎫 Token permissions check - Module: ${module}, Has Access: ${hasAccess}`);

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
 * TOKEN-BASED: Uses permissions from JWT token (req.user.permissions)
 * Usage: requirePermission(MODULES.ORDER_MANAGEMENT, PERMISSIONS.WRITE)
 */
export const requirePermission = (module, permission) => {
  return (req, res, next) => {
    const userRole = req.user?.role;
    const userPermissions = req.user?.permissions;

    if (!userRole) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User role not found'
      });
    }

    const permitted = hasPermissionFromToken(userPermissions, module, permission);

    console.log(`🎫 Token permission check - Module: ${module}, Permission: ${permission}, Granted: ${permitted}`);

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

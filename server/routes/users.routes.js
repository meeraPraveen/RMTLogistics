import express from 'express';
import {
  getAllUsers,
  getUserByAuth0Id,
  createUser,
  updateUser,
  deleteUser,
  inviteUser,
  updateUserRole,
  suspendUser,
  reactivateUser
} from '../services/user.service.js';
import { requireModule, requireSuperAdmin } from '../middleware/rbac.middleware.js';
import { MODULES } from '../config/rbac.config.js';

const router = express.Router();

/**
 * GET /api/users/me
 * Get current user's information
 * Accessible by any authenticated user
 */
router.get('/me', async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const user = await getUserByAuth0Id(req.user.auth0UserId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        company_id: user.company_id
      }
    });
  } catch (error) {
    console.error('Error fetching current user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user info',
      message: error.message
    });
  }
});

/**
 * GET /api/users
 * Get all users with pagination and filters
 * Accessible by:
 * - SuperAdmin or users with user_management access (full access)
 * - Lead Artists (can only query role=Artist for assignment purposes)
 * Query params: page, limit, role, is_active, search
 */
router.get('/', async (req, res) => {
  try {
    const { page, limit, role, is_active, search } = req.query;

    // Check permissions
    const hasUserManagement = req.user.permissions?.user_management?.includes('read');
    const isLeadArtist = req.user.role === 'Lead Artist';

    // Lead Artists can only query for Artists (for assignment purposes)
    if (isLeadArtist && !hasUserManagement) {
      if (role !== 'Artist') {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'Lead Artists can only query for Artist users'
        });
      }
    } else if (!hasUserManagement && !isLeadArtist) {
      // Others need user_management permission
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You do not have permission to access user management'
      });
    }

    const options = {
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 25,
      role,
      is_active: is_active !== undefined ? is_active === 'true' : undefined,
      search
    };

    const result = await getAllUsers(options);

    // Don't expose sensitive fields
    const safeUsers = result.users.map(user => ({
      id: user.id,
      auth0_user_id: user.auth0_user_id,
      email: user.email,
      name: user.name,
      role: user.role,
      auth0_role: user.auth0_role, // For SuperAdmin to see role discrepancies
      is_active: user.is_active,
      status: user.status,
      created_at: user.created_at,
      last_login: user.last_login,
      company_id: user.company_id,
      company_name: user.company_name
    }));

    res.json({
      success: true,
      data: safeUsers,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users',
      message: error.message
    });
  }
});

/**
 * POST /api/users
 * Create a new user
 * Accessible by Admin and SuperAdmin
 */
router.post('/', requireModule(MODULES.USER_MANAGEMENT), async (req, res) => {
  try {
    const { email, name, role } = req.body;

    if (!email || !name) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Email and name are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Get current user's ID for audit
    const createdBy = req.user.id;

    const user = await createUser({ email, name, role: role || null }, createdBy);

    res.status(201).json({
      success: true,
      message: `User ${email} created successfully`,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        is_active: user.is_active,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Error creating user:', error);

    if (error.code === '23505') { // Unique violation
      return res.status(409).json({
        success: false,
        error: 'User already exists',
        message: 'A user with this email already exists'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create user',
      message: error.message
    });
  }
});

/**
 * PUT /api/users/:id
 * Update user details
 * Accessible by Admin and SuperAdmin
 */
router.put('/:id', requireModule(MODULES.USER_MANAGEMENT), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { name, role, is_active, company_id } = req.body;

    if (!name && !role && is_active === undefined && company_id === undefined) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update',
        message: 'At least one field (name, role, is_active, or company_id) is required'
      });
    }

    const user = await updateUser(userId, { name, role, is_active, company_id });

    res.json({
      success: true,
      message: 'User updated successfully',
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        is_active: user.is_active,
        company_id: user.company_id
      }
    });
  } catch (error) {
    console.error('Error updating user:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update user',
      message: error.message
    });
  }
});

/**
 * DELETE /api/users/:id
 * Delete a user
 * Accessible by SuperAdmin only
 */
router.delete('/:id', requireSuperAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // Prevent deleting yourself
    if (userId === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete yourself'
      });
    }

    // Get user to check if they're a SuperAdmin
    const { query } = await import('../config/database.js');
    const userResult = await query('SELECT role FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length > 0 && userResult.rows[0].role === 'SuperAdmin') {
      return res.status(403).json({
        success: false,
        error: 'Cannot delete SuperAdmin users',
        message: 'SuperAdmin users are protected and cannot be deleted'
      });
    }

    const deleted = await deleteUser(userId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete user',
      message: error.message
    });
  }
});

/**
 * POST /api/users/invite
 * Invite a new user (legacy endpoint)
 * Accessible by SuperAdmin only
 */
router.post('/invite', requireSuperAdmin, async (req, res) => {
  try {
    const { email, role } = req.body;

    if (!email || !role) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Email and role are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Get current user's ID for audit
    const invitedBy = req.user.id;

    const user = await inviteUser(null, email, role, invitedBy);

    res.json({
      success: true,
      message: `User ${email} invited successfully`,
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Error inviting user:', error);

    if (error.code === '23505') { // Unique violation
      return res.status(409).json({
        success: false,
        error: 'User already exists',
        message: 'A user with this email already exists'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to invite user',
      message: error.message
    });
  }
});

/**
 * PUT /api/users/:id/role
 * Update user's role
 * Accessible by SuperAdmin only
 */
router.put('/:auth0UserId/role', requireSuperAdmin, async (req, res) => {
  try {
    const { auth0UserId } = req.params;
    const { role } = req.body;

    if (!role) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field',
        message: 'Role is required'
      });
    }

    const user = await updateUserRole(auth0UserId, role);

    res.json({
      success: true,
      message: `User role updated to ${role}`,
      data: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user role',
      message: error.message
    });
  }
});

/**
 * POST /api/users/:id/suspend
 * Suspend a user (block access)
 * Accessible by SuperAdmin only
 */
router.post('/:auth0UserId/suspend', requireSuperAdmin, async (req, res) => {
  try {
    const { auth0UserId } = req.params;
    console.log(`📥 Suspend request received for: ${auth0UserId}`);

    // Get user to check if they're a SuperAdmin
    const { query } = await import('../config/database.js');
    const userResult = await query('SELECT role FROM users WHERE auth0_user_id = $1', [auth0UserId]);
    if (userResult.rows.length > 0 && userResult.rows[0].role === 'SuperAdmin') {
      return res.status(403).json({
        success: false,
        error: 'Cannot suspend SuperAdmin users',
        message: 'SuperAdmin users are protected and cannot be disabled'
      });
    }

    const user = await suspendUser(auth0UserId);

    res.json({
      success: true,
      message: 'User suspended successfully',
      data: {
        id: user.id,
        email: user.email,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Error suspending user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to suspend user',
      message: error.message
    });
  }
});

/**
 * POST /api/users/:id/reactivate
 * Reactivate a suspended user
 * Accessible by SuperAdmin only
 */
router.post('/:auth0UserId/reactivate', requireSuperAdmin, async (req, res) => {
  try {
    const { auth0UserId } = req.params;
    console.log(`📥 Reactivate request received for: ${auth0UserId}`);

    const user = await reactivateUser(auth0UserId);

    res.json({
      success: true,
      message: 'User reactivated successfully',
      data: {
        id: user.id,
        email: user.email,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Error reactivating user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reactivate user',
      message: error.message
    });
  }
});

/**
 * DELETE /api/users/:id
 * Delete a user
 * Accessible by SuperAdmin only
 */
router.delete('/:auth0UserId', requireSuperAdmin, async (req, res) => {
  try {
    const { auth0UserId } = req.params;

    // Prevent deleting yourself
    if (auth0UserId === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete yourself'
      });
    }

    // Get user to check if they're a SuperAdmin
    const { query } = await import('../config/database.js');
    const userResult = await query('SELECT role FROM users WHERE auth0_user_id = $1', [auth0UserId]);
    if (userResult.rows.length > 0 && userResult.rows[0].role === 'SuperAdmin') {
      return res.status(403).json({
        success: false,
        error: 'Cannot delete SuperAdmin users',
        message: 'SuperAdmin users are protected and cannot be deleted'
      });
    }

    const deleted = await deleteUser(auth0UserId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete user',
      message: error.message
    });
  }
});

export default router;

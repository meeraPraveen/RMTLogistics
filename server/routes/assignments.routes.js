import express from 'express';
import { query } from '../config/database.js';

const router = express.Router();

/**
 * GET /api/assignments/available-users
 * Get users available for order assignment
 * Returns only minimal info: id, name, role
 *
 * Access control:
 * - Admin/SuperAdmin: Can see Artist, Lead Artist, Production Tech
 * - Lead Artist: Can see only Artists
 * - Others: Forbidden
 */
router.get('/available-users', async (req, res) => {
  try {
    const userRole = req.user?.role;
    console.log('📥 /api/assignments/available-users called by:', req.user?.email, 'Role:', userRole);

    // Check if user has permission to assign orders
    const canAssign =
      userRole === 'SuperAdmin' ||
      userRole === 'Admin' ||
      userRole === 'Lead Artist';

    if (!canAssign) {
      console.log('❌ Access denied - user role:', userRole);
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You do not have permission to assign orders'
      });
    }

    // Determine which roles can be fetched based on current user's role
    let result;
    if (userRole === 'Lead Artist') {
      // Lead Artists can assign to Artists + themselves
      console.log('🎨 Lead Artist - fetching Artists + self');
      result = await query(
        `SELECT id, name, role
         FROM users
         WHERE (role = 'Artist' OR (role = 'Lead Artist' AND id = $1))
         AND is_active = true
         ORDER BY name ASC`,
        [req.user.id]
      );
    } else {
      // Admin/SuperAdmin can assign to all assignable roles
      console.log('👑 Admin/SuperAdmin - fetching all assignable roles');
      const allowedRoles = ['Artist', 'Lead Artist', 'Production Tech'];
      result = await query(
        `SELECT id, name, role
         FROM users
         WHERE role = ANY($1)
         AND is_active = true
         ORDER BY name ASC`,
        [allowedRoles]
      );
    }

    console.log(`✅ Found ${result.rows.length} assignable users:`, result.rows.map(u => `${u.name} (${u.role})`));

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Error fetching assignable users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch assignable users',
      message: error.message
    });
  }
});

export default router;

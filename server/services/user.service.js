import { query } from '../config/database.js';
import { createAuth0User, updateAuth0User, deleteAuth0User } from './auth0.service.js';

/**
 * User Service - Handles user-role database operations
 */

/**
 * Get user role by Auth0 user ID (only if active)
 * @param {string} auth0UserId - Auth0 user ID (e.g., "auth0|123456")
 * @returns {Promise<string|null>} - User role or null if not found/not active
 */
export const getUserRole = async (auth0UserId) => {
  try {
    const result = await query(
      `SELECT role FROM users
       WHERE auth0_user_id = $1`,
      [auth0UserId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0].role;
  } catch (error) {
    console.error('Error fetching user role:', error);
    throw error;
  }
};

/**
 * Get user by Auth0 user ID
 * @param {string} auth0UserId - Auth0 user ID (e.g., "auth0|123456")
 * @returns {Promise<Object|null>} - User object or null if not found
 */
export const getUserByAuth0Id = async (auth0UserId) => {
  try {
    const result = await query(
      `SELECT id, auth0_user_id, email, name, role, is_active
       FROM users
       WHERE auth0_user_id = $1`,
      [auth0UserId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error) {
    console.error('Error fetching user by Auth0 ID:', error);
    throw error;
  }
};

/**
 * Get user role by email (fallback method, only if active)
 * @param {string} email - User email
 * @returns {Promise<string|null>} - User role or null if not found/not active
 */
export const getUserRoleByEmail = async (email) => {
  try {
    const result = await query(
      `SELECT role FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0].role;
  } catch (error) {
    console.error('Error fetching user role by email:', error);
    throw error;
  }
};

/**
 * Create or update a user
 * @param {string} auth0UserId - Auth0 user ID
 * @param {string} email - User email
 * @param {string} role - User role (default: 'Artist')
 * @returns {Promise<Object>} - Created/updated user
 */
export const upsertUser = async (auth0UserId, email, role = 'Artist') => {
  try {
    // First check if user exists by email
    const existingUser = await query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      // Update existing user with new auth0_user_id
      const result = await query(
        `UPDATE users
         SET auth0_user_id = $1, role = $2, updated_at = CURRENT_TIMESTAMP
         WHERE email = $3
         RETURNING *`,
        [auth0UserId, role, email]
      );
      return result.rows[0];
    } else {
      // Insert new user
      const result = await query(
        `INSERT INTO users (auth0_user_id, email, role)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [auth0UserId, email, role]
      );
      return result.rows[0];
    }
  } catch (error) {
    console.error('Error upserting user:', error);
    throw error;
  }
};

/**
 * Update user role
 * @param {string} auth0UserId - Auth0 user ID
 * @param {string} role - New role
 * @returns {Promise<Object>} - Updated user
 */
export const updateUserRole = async (auth0UserId, role) => {
  try {
    const result = await query(
      `UPDATE users
       SET role = $1, updated_at = CURRENT_TIMESTAMP
       WHERE auth0_user_id = $2
       RETURNING *`,
      [role, auth0UserId]
    );

    if (result.rows.length === 0) {
      throw new Error(`User with Auth0 ID ${auth0UserId} not found`);
    }

    return result.rows[0];
  } catch (error) {
    console.error('Error updating user role:', error);
    throw error;
  }
};

/**
 * Get all users with pagination and filters
 * @param {Object} options - Query options
 * @param {number} options.page - Page number (default: 1)
 * @param {number} options.limit - Items per page (default: 25)
 * @param {string} options.role - Filter by role
 * @param {boolean} options.is_active - Filter by active status
 * @param {string} options.search - Search by email or name
 * @returns {Promise<Object>} - Object with users array and pagination info
 */
export const getAllUsers = async (options = {}) => {
  try {
    const {
      page = 1,
      limit = 25,
      role,
      is_active,
      search
    } = options;

    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // Build WHERE clause
    if (role) {
      conditions.push(`role = $${paramIndex++}`);
      params.push(role);
    }

    if (is_active !== undefined) {
      conditions.push(`is_active = $${paramIndex++}`);
      params.push(is_active);
    }

    if (search) {
      conditions.push(`(email ILIKE $${paramIndex} OR name ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM users ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get paginated users
    params.push(limit, offset);
    const result = await query(
      `SELECT id, auth0_user_id, email, name, role, is_active, created_at, updated_at, last_login
       FROM users
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    return {
      users: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error fetching all users:', error);
    throw error;
  }
};

/**
 * Create a new user
 * @param {Object} userData - User data
 * @param {string} userData.email - User email
 * @param {string} userData.name - User name
 * @param {string} userData.role - User role
 * @param {number} createdBy - ID of user creating this user
 * @returns {Promise<Object>} - Created user
 */
export const createUser = async (userData, createdBy) => {
  try {
    const { email, name, role } = userData;

    // Step 1: Create user in PostgreSQL (source of truth)
    const result = await query(
      `INSERT INTO users (auth0_user_id, email, name, role, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
      [`pending_${email}`, email, name, role]
    );

    const dbUser = result.rows[0];

    // Step 2: Sync to Auth0 for authentication
    try {
      const auth0Result = await createAuth0User({
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role
      });

      // Step 3: Update PostgreSQL with Auth0 user ID
      if (auth0Result.auth0_user_id) {
        const updateResult = await query(
          `UPDATE users SET auth0_user_id = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2
           RETURNING *`,
          [auth0Result.auth0_user_id, dbUser.id]
        );

        console.log(`✅ User ${email} created and synced to Auth0`);
        return updateResult.rows[0];
      }

      return dbUser;
    } catch (auth0Error) {
      console.error(`⚠️  User created in DB but Auth0 sync failed for ${email}:`, auth0Error.message);
      // User still exists in DB, return it
      return dbUser;
    }
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

/**
 * Update user
 * @param {number} userId - User ID
 * @param {Object} userData - User data to update
 * @returns {Promise<Object>} - Updated user
 */
export const updateUser = async (userId, userData) => {
  try {
    const { name, role, is_active } = userData;
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(name);
    }

    if (role !== undefined) {
      updates.push(`role = $${paramIndex++}`);
      params.push(role);
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(is_active);
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(userId);

    // Step 1: Update user in PostgreSQL (source of truth)
    const result = await query(
      `UPDATE users
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      throw new Error(`User with ID ${userId} not found`);
    }

    const dbUser = result.rows[0];

    // Step 2: Sync to Auth0 if user has auth0_user_id
    if (dbUser.auth0_user_id && !dbUser.auth0_user_id.startsWith('pending_')) {
      try {
        const auth0Updates = {};
        if (name !== undefined) auth0Updates.name = name;
        if (role !== undefined) auth0Updates.role = role;
        if (is_active !== undefined) auth0Updates.blocked = !is_active;

        await updateAuth0User(dbUser.auth0_user_id, auth0Updates);
        console.log(`✅ User ${dbUser.email} updated and synced to Auth0`);
      } catch (auth0Error) {
        console.error(`⚠️  User updated in DB but Auth0 sync failed for ${dbUser.email}:`, auth0Error.message);
        // Continue - DB is source of truth
      }
    }

    return dbUser;
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
};

/**
 * Delete a user
 * @param {number} userId - User ID
 * @returns {Promise<boolean>} - True if deleted
 */
export const deleteUser = async (userId) => {
  try {
    // Step 1: Get user details before deletion
    const userResult = await query(
      'SELECT auth0_user_id, email FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error(`User with ID ${userId} not found`);
    }

    const user = userResult.rows[0];

    // Step 2: Delete from PostgreSQL (source of truth)
    const result = await query(
      'DELETE FROM users WHERE id = $1',
      [userId]
    );

    // Step 3: Block user in Auth0 (we block instead of delete to preserve audit trails)
    if (user.auth0_user_id && !user.auth0_user_id.startsWith('pending_')) {
      try {
        await deleteAuth0User(user.auth0_user_id);
        console.log(`✅ User ${user.email} deleted from DB and blocked in Auth0`);
      } catch (auth0Error) {
        console.error(`⚠️  User deleted from DB but Auth0 block failed for ${user.email}:`, auth0Error.message);
        // Continue - DB is source of truth
      }
    }

    return result.rowCount > 0;
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
};

/**
 * Invite a new user (creates user with 'invited' status)
 * @param {string} auth0UserId - Auth0 user ID (optional if not known yet)
 * @param {string} email - User email
 * @param {string} role - User role
 * @param {number} invitedBy - ID of user creating the invite
 * @returns {Promise<Object>} - Created user
 */
export const inviteUser = async (auth0UserId, email, role, invitedBy) => {
  try {
    const result = await query(
      `INSERT INTO users (auth0_user_id, email, role, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING *`,
      [auth0UserId || `pending_${email}`, email, role]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Error inviting user:', error);
    throw error;
  }
};

/**
 * Activate a user (change from 'invited' to 'active')
 * Called when user logs in for the first time
 * @param {string} auth0UserId - Auth0 user ID
 * @param {string} email - User email
 * @returns {Promise<Object>} - Updated user
 */
export const activateUser = async (auth0UserId, email) => {
  try {
    // First, try to find by auth0_user_id
    let result = await query(
      `UPDATE users
       SET is_active = true, auth0_user_id = $1, updated_at = CURRENT_TIMESTAMP
       WHERE auth0_user_id = $1
       RETURNING *`,
      [auth0UserId]
    );

    // If not found, try to match by email (for invited users)
    if (result.rows.length === 0) {
      result = await query(
        `UPDATE users
         SET is_active = true, auth0_user_id = $1, updated_at = CURRENT_TIMESTAMP
         WHERE email = $2
         RETURNING *`,
        [auth0UserId, email]
      );
    }

    return result.rows[0] || null;
  } catch (error) {
    console.error('Error activating user:', error);
    throw error;
  }
};

/**
 * Suspend a user (block access)
 * @param {string} auth0UserId - Auth0 user ID
 * @returns {Promise<Object>} - Updated user
 */
export const suspendUser = async (auth0UserId) => {
  try {
    const result = await query(
      `UPDATE users
       SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE auth0_user_id = $1
       RETURNING *`,
      [auth0UserId]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Error suspending user:', error);
    throw error;
  }
};

/**
 * Reactivate a suspended user
 * @param {string} auth0UserId - Auth0 user ID
 * @returns {Promise<Object>} - Updated user
 */
export const reactivateUser = async (auth0UserId) => {
  try {
    const result = await query(
      `UPDATE users
       SET is_active = true, updated_at = CURRENT_TIMESTAMP
       WHERE auth0_user_id = $1
       RETURNING *`,
      [auth0UserId]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Error reactivating user:', error);
    throw error;
  }
};

/**
 * Update user's last login timestamp
 * @param {string} auth0UserId - Auth0 user ID
 * @returns {Promise<void>}
 */
export const updateLastLogin = async (auth0UserId) => {
  try {
    await query(
      `UPDATE users
       SET last_login = CURRENT_TIMESTAMP
       WHERE auth0_user_id = $1`,
      [auth0UserId]
    );
  } catch (error) {
    console.error('Error updating last login:', error);
    // Don't throw - last login tracking shouldn't break authentication
  }
};

/**
 * Log user action to audit log
 * @param {number} userId - User ID (from users table)
 * @param {string} action - Action performed
 * @param {Object} details - Additional details
 */
export const logAudit = async (userId, action, details = {}) => {
  try {
    await query(
      'INSERT INTO audit_log (user_id, action, details) VALUES ($1, $2, $3)',
      [userId, action, JSON.stringify(details)]
    );
  } catch (error) {
    console.error('Error logging audit:', error);
    // Don't throw - audit logging shouldn't break the app
  }
};

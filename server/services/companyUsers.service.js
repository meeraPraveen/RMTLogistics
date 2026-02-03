import { query } from '../config/database.js';
import { createAuth0User, updateAuth0User, deleteAuth0User, addUserToAuth0Organization, removeUserFromAuth0Organization } from './auth0.service.js';
import { getRolePermissions } from './permissions.service.js';

/**
 * Company Users Service - Handles B2B user operations
 * Separate from B2C user management
 */

/**
 * Get all users for a specific company with pagination
 * @param {string} companyId - Company UUID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Users and pagination info
 */
export const getCompanyUsers = async (companyId, options = {}) => {
  try {
    const { page = 1, limit = 25, search, is_active } = options;
    const offset = (page - 1) * limit;
    const conditions = ['company_id = $1'];
    const params = [companyId];
    let paramIndex = 2;

    if (search) {
      conditions.push(`(email ILIKE $${paramIndex} OR name ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (is_active !== undefined) {
      conditions.push(`is_active = $${paramIndex++}`);
      params.push(is_active);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

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
       FROM users ${whereClause}
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
    console.error('Error fetching company users:', error);
    throw error;
  }
};

/**
 * Create a new user for a company
 * @param {string} companyId - Company UUID
 * @param {Object} userData - User data
 * @returns {Promise<Object>} - Created user
 */
export const createCompanyUser = async (companyId, userData) => {
  try {
    const { email, name, role } = userData;

    // Validate role - SuperAdmin not allowed for company users
    if (role === 'SuperAdmin') {
      throw new Error('SuperAdmin role is not allowed for company users');
    }

    // Step 1: Verify company exists and is active
    const companyResult = await query(
      'SELECT id, name, org_id, is_active FROM companies WHERE id = $1',
      [companyId]
    );

    if (companyResult.rows.length === 0) {
      throw new Error('Company not found');
    }

    const company = companyResult.rows[0];
    if (!company.is_active) {
      throw new Error('Cannot add users to inactive company');
    }

    // Step 2: Check if email already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      throw new Error('A user with this email already exists');
    }

    // Step 3: Create user in PostgreSQL with company_id
    const result = await query(
      `INSERT INTO users (auth0_user_id, email, name, role, company_id, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING *`,
      [`pending_${email}`, email, name, role, companyId]
    );

    const dbUser = result.rows[0];
    console.log(`✅ Company user created in DB: ${email} for company ${company.name}`);

    // Step 4: Sync to Auth0 with company metadata
    try {
      const permissions = await getRolePermissions(role);
      console.log(`📋 Fetched permissions for role "${role}":`, JSON.stringify(permissions));

      const auth0Result = await createAuth0User({
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role,
        permissions: permissions,
        company_id: companyId,
        company_name: company.name,
        org_id: company.org_id  // Auth0 Organization ID
      });

      // Step 5: Update with Auth0 user ID
      if (auth0Result.auth0_user_id) {
        const updateResult = await query(
          `UPDATE users SET auth0_user_id = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2 RETURNING *`,
          [auth0Result.auth0_user_id, dbUser.id]
        );
        console.log(`✅ Company user ${email} synced to Auth0`);

        // Step 6: Add user to Auth0 Organization if company has org_id
        if (company.org_id) {
          try {
            await addUserToAuth0Organization(company.org_id, auth0Result.auth0_user_id);
            console.log(`✅ Company user ${email} added to Auth0 Organization ${company.org_id}`);
          } catch (orgError) {
            console.error(`⚠️  User created but failed to add to Organization:`, orgError.message);
          }
        } else {
          console.log(`ℹ️  Company ${company.name} has no org_id, skipping Organization membership`);
        }

        return updateResult.rows[0];
      }
    } catch (auth0Error) {
      console.error(`⚠️  Company user created in DB but Auth0 sync failed for ${email}:`, auth0Error.message);
    }

    return dbUser;
  } catch (error) {
    console.error('Error creating company user:', error);
    throw error;
  }
};

/**
 * Update a company user
 * @param {string} companyId - Company UUID
 * @param {number} userId - User ID
 * @param {Object} userData - User data to update
 * @returns {Promise<Object>} - Updated user
 */
export const updateCompanyUser = async (companyId, userId, userData) => {
  try {
    const { name, role, is_active } = userData;

    // Validate role - SuperAdmin not allowed for company users
    if (role === 'SuperAdmin') {
      throw new Error('SuperAdmin role is not allowed for company users');
    }

    // Verify user belongs to this company
    const userCheck = await query(
      'SELECT id, auth0_user_id, email FROM users WHERE id = $1 AND company_id = $2',
      [userId, companyId]
    );

    if (userCheck.rows.length === 0) {
      throw new Error('User not found in this company');
    }

    const existingUser = userCheck.rows[0];

    // Build update query
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

    const result = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    const dbUser = result.rows[0];

    // Sync to Auth0
    if (existingUser.auth0_user_id && !existingUser.auth0_user_id.startsWith('pending_')) {
      try {
        const auth0Updates = {};
        if (name !== undefined) auth0Updates.name = name;
        if (role !== undefined) {
          auth0Updates.role = role;
          const permissions = await getRolePermissions(role);
          auth0Updates.permissions = permissions;
        }
        if (is_active !== undefined) auth0Updates.blocked = !is_active;

        await updateAuth0User(existingUser.auth0_user_id, auth0Updates);
        console.log(`✅ Company user ${existingUser.email} updated and synced to Auth0`);
      } catch (auth0Error) {
        console.error(`⚠️  User updated in DB but Auth0 sync failed:`, auth0Error.message);
      }
    }

    return dbUser;
  } catch (error) {
    console.error('Error updating company user:', error);
    throw error;
  }
};

/**
 * Delete/remove a user from a company
 * @param {string} companyId - Company UUID
 * @param {number} userId - User ID
 * @returns {Promise<boolean>} - True if deleted
 */
export const deleteCompanyUser = async (companyId, userId) => {
  try {
    // Verify user belongs to this company and get company org_id
    const userCheck = await query(
      `SELECT u.auth0_user_id, u.email, c.org_id
       FROM users u
       JOIN companies c ON u.company_id = c.id
       WHERE u.id = $1 AND u.company_id = $2`,
      [userId, companyId]
    );

    if (userCheck.rows.length === 0) {
      throw new Error('User not found in this company');
    }

    const user = userCheck.rows[0];

    // Delete from PostgreSQL
    const result = await query(
      'DELETE FROM users WHERE id = $1 AND company_id = $2',
      [userId, companyId]
    );

    // Remove from Auth0 Organization and block user
    if (user.auth0_user_id && !user.auth0_user_id.startsWith('pending_')) {
      try {
        // Remove from Organization first
        if (user.org_id) {
          try {
            await removeUserFromAuth0Organization(user.org_id, user.auth0_user_id);
            console.log(`✅ User ${user.email} removed from Auth0 Organization`);
          } catch (orgError) {
            console.error(`⚠️  Failed to remove user from Organization:`, orgError.message);
          }
        }

        // Then block the user in Auth0
        await deleteAuth0User(user.auth0_user_id);
        console.log(`✅ Company user ${user.email} deleted from DB and blocked in Auth0`);
      } catch (auth0Error) {
        console.error(`⚠️  User deleted from DB but Auth0 sync failed:`, auth0Error.message);
      }
    }

    return result.rowCount > 0;
  } catch (error) {
    console.error('Error deleting company user:', error);
    throw error;
  }
};

/**
 * Toggle company user active status
 * @param {string} companyId - Company UUID
 * @param {number} userId - User ID
 * @returns {Promise<Object>} - Updated user
 */
export const toggleCompanyUserStatus = async (companyId, userId) => {
  try {
    // Verify user belongs to this company and get current status
    const userCheck = await query(
      'SELECT id, auth0_user_id, email, is_active FROM users WHERE id = $1 AND company_id = $2',
      [userId, companyId]
    );

    if (userCheck.rows.length === 0) {
      throw new Error('User not found in this company');
    }

    const user = userCheck.rows[0];
    const newStatus = !user.is_active;

    // Update in PostgreSQL
    const result = await query(
      `UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 RETURNING *`,
      [newStatus, userId]
    );

    const dbUser = result.rows[0];

    // Sync to Auth0
    if (user.auth0_user_id && !user.auth0_user_id.startsWith('pending_')) {
      try {
        await updateAuth0User(user.auth0_user_id, { blocked: !newStatus });
        console.log(`✅ Company user ${user.email} ${newStatus ? 'enabled' : 'disabled'} in Auth0`);
      } catch (auth0Error) {
        console.error(`⚠️  User status updated in DB but Auth0 sync failed:`, auth0Error.message);
      }
    }

    return dbUser;
  } catch (error) {
    console.error('Error toggling company user status:', error);
    throw error;
  }
};

export default {
  getCompanyUsers,
  createCompanyUser,
  updateCompanyUser,
  deleteCompanyUser,
  toggleCompanyUserStatus
};

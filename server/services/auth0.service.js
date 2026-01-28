import { ManagementClient } from 'auth0';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Auth0 Management Service
 * Handles all interactions with Auth0 Management API
 *
 * Purpose: Sync user data from PostgreSQL (source of truth) to Auth0
 */

/**
 * Generate a secure temporary password for new users
 * User will reset this via the password change email
 */
const generateTempPassword = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 24; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

// Initialize Auth0 Management Client
const auth0Management = new ManagementClient({
  domain: process.env.AUTH0_MGMT_DOMAIN,
  clientId: process.env.AUTH0_MGMT_CLIENT_ID,
  clientSecret: process.env.AUTH0_MGMT_CLIENT_SECRET,
  scope: 'read:users update:users delete:users create:users update:users_app_metadata create:user_tickets'
});

/**
 * Create a user in Auth0
 * @param {Object} userData - User data from PostgreSQL
 * @param {string} userData.email - User email
 * @param {string} userData.name - User full name
 * @param {string} userData.role - User role from DB
 * @returns {Promise<Object>} - Created Auth0 user
 */
export const createAuth0User = async (userData) => {
  try {
    console.log(`📤 Creating user in Auth0: ${userData.email}`);

    const auth0User = await auth0Management.users.create({
      email: userData.email,
      name: userData.name,
      connection: 'Username-Password-Authentication',
      password: generateTempPassword(),
      email_verified: false,
      verify_email: true,

      // Store PostgreSQL role and permissions in Auth0 metadata
      // The Auth0 Action reads these and adds them to the token
      app_metadata: {
        role: userData.role,
        permissions: userData.permissions || {},
        db_synced: true,
        synced_at: new Date().toISOString()
      },

      // User metadata (editable by user)
      user_metadata: {
        created_via: 'admin_portal'
      }
    });

    console.log(`✅ User created in Auth0: ${auth0User.user_id}`);

    // Send password setup email (for email/password auth) or invitation
    await sendInvitationEmail(auth0User.user_id, userData.email);

    return {
      auth0_user_id: auth0User.user_id,
      email: auth0User.email,
      created: true
    };

  } catch (error) {
    console.error(`❌ Error creating user in Auth0:`, error);

    // Check if user already exists in Auth0
    if (error.statusCode === 409) {
      console.log(`⚠️  User ${userData.email} already exists in Auth0, attempting to update...`);
      return await syncExistingAuth0User(userData);
    }

    throw new Error(`Failed to create user in Auth0: ${error.message}`);
  }
};

/**
 * Update an existing user in Auth0
 * @param {string} auth0UserId - Auth0 user ID (e.g., 'google-oauth2|123')
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} - Updated Auth0 user
 */
export const updateAuth0User = async (auth0UserId, updates) => {
  try {
    console.log(`📤 Updating user in Auth0: ${auth0UserId}`);

    const updateData = {};

    // Check if this is a social login (Google, etc.) - can't update name for social connections
    const isSocialLogin = auth0UserId.includes('google-oauth2') ||
                         auth0UserId.includes('facebook') ||
                         auth0UserId.includes('twitter') ||
                         auth0UserId.includes('github');

    // Update name if provided (only for non-social connections)
    if (updates.name && !isSocialLogin) {
      updateData.name = updates.name;
    }

    // Update role and permissions in app_metadata if provided
    if (updates.role || updates.permissions) {
      updateData.app_metadata = {
        ...(updates.role && { role: updates.role }),
        ...(updates.permissions && { permissions: updates.permissions }),
        db_synced: true,
        synced_at: new Date().toISOString()
      };
    }

    // Block/unblock user if provided
    if (updates.blocked !== undefined) {
      updateData.blocked = updates.blocked;
    }

    const auth0User = await auth0Management.users.update(
      auth0UserId,
      updateData
    );

    console.log(`✅ User updated in Auth0: ${auth0UserId}`);

    return {
      auth0_user_id: auth0User.user_id,
      updated: true
    };

  } catch (error) {
    console.error(`❌ Error updating user in Auth0:`, error);

    if (error.statusCode === 404) {
      console.warn(`⚠️  User ${auth0UserId} not found in Auth0`);
      return { auth0_user_id: auth0UserId, updated: false, error: 'User not found in Auth0' };
    }

    throw new Error(`Failed to update user in Auth0: ${error.message}`);
  }
};

/**
 * Delete a user from Auth0
 * @param {string} auth0UserId - Auth0 user ID
 * @returns {Promise<Object>}
 */
export const deleteAuth0User = async (auth0UserId) => {
  try {
    console.log(`📤 Deleting user from Auth0: ${auth0UserId}`);

    await auth0Management.users.delete({ id: auth0UserId });

    console.log(`✅ User deleted from Auth0: ${auth0UserId}`);

    return { auth0_user_id: auth0UserId, deleted: true };

  } catch (error) {
    console.error(`❌ Error deleting user in Auth0:`, error);

    if (error.statusCode === 404) {
      console.warn(`⚠️  User ${auth0UserId} not found in Auth0`);
      return { auth0_user_id: auth0UserId, deleted: false, error: 'User not found' };
    }

    throw new Error(`Failed to delete user in Auth0: ${error.message}`);
  }
};

/**
 * Get Auth0 user by email
 * @param {string} email - User email
 * @returns {Promise<Object|null>} - Auth0 user or null
 */
export const getAuth0UserByEmail = async (email) => {
  try {
    const users = await auth0Management.users.listUsersByEmail({ email });

    if (users && users.length > 0) {
      return users[0]; // Return first match
    }

    return null;
  } catch (error) {
    console.error(`❌ Error fetching user from Auth0:`, error);
    return null;
  }
};

/**
 * Sync existing Auth0 user with PostgreSQL data
 * @param {Object} userData - User data from PostgreSQL
 * @returns {Promise<Object>}
 */
const syncExistingAuth0User = async (userData) => {
  try {
    const auth0User = await getAuth0UserByEmail(userData.email);

    if (!auth0User) {
      throw new Error('User not found in Auth0');
    }

    // Update Auth0 user with PostgreSQL data
    await updateAuth0User(auth0User.user_id, {
      name: userData.name,
      role: userData.role
    });

    return {
      auth0_user_id: auth0User.user_id,
      email: auth0User.email,
      created: false,
      synced: true
    };

  } catch (error) {
    throw new Error(`Failed to sync existing Auth0 user: ${error.message}`);
  }
};

/**
 * Send invitation/verification email to user
 * @param {string} auth0UserId - Auth0 user ID
 * @param {string} email - User email
 */
const sendInvitationEmail = async (auth0UserId, email) => {
  try {
    console.log(`📧 Sending invitation email to: ${email}`);

    // Create a password change ticket (this sends an email invitation)
    const ticket = await auth0Management.tickets.changePassword({
      user_id: auth0UserId,
      result_url: process.env.AUTH0_CALLBACK_URL || 'http://localhost:3000',
      mark_email_as_verified: false,
      includeEmailInRedirect: true
    });

    console.log(`✅ Invitation email sent to: ${email}`);
    console.log(`🔗 Invitation link: ${ticket.ticket}`);

    return ticket;

  } catch (error) {
    console.error(`❌ Error sending invitation email:`, error);
    // Don't throw - user is created, email is optional
    console.warn(`⚠️  User created but invitation email failed. User can still log in via social login.`);
  }
};

/**
 * Verify Auth0 connection status
 * @returns {Promise<boolean>}
 */
export const verifyAuth0Connection = async () => {
  try {
    // Try to get client info to verify connection
    const client = await auth0Management.clients.get({
      client_id: process.env.AUTH0_MGMT_CLIENT_ID
    });

    console.log(`✅ Auth0 Management API connected: ${client.name}`);
    return true;

  } catch (error) {
    console.error(`❌ Auth0 Management API connection failed:`, error.message);
    return false;
  }
};

/**
 * Bulk sync users from PostgreSQL to Auth0
 * @param {Array} users - Array of user objects from PostgreSQL
 * @returns {Promise<Object>} - Sync results
 */
export const bulkSyncUsers = async (users) => {
  const results = {
    total: users.length,
    created: 0,
    updated: 0,
    failed: 0,
    errors: []
  };

  console.log(`🔄 Starting bulk sync of ${users.length} users...`);

  for (const user of users) {
    try {
      if (user.auth0_user_id) {
        // User has Auth0 ID, update
        await updateAuth0User(user.auth0_user_id, {
          name: user.name,
          role: user.role
        });
        results.updated++;
      } else {
        // User doesn't have Auth0 ID, create
        const result = await createAuth0User(user);
        if (result.created) {
          results.created++;
        } else {
          results.updated++;
        }
      }
    } catch (error) {
      results.failed++;
      results.errors.push({
        email: user.email,
        error: error.message
      });
      console.error(`❌ Failed to sync user ${user.email}:`, error.message);
    }
  }

  console.log(`✅ Bulk sync completed: ${results.created} created, ${results.updated} updated, ${results.failed} failed`);

  return results;
};

export default {
  createAuth0User,
  updateAuth0User,
  deleteAuth0User,
  getAuth0UserByEmail,
  verifyAuth0Connection,
  bulkSyncUsers
};

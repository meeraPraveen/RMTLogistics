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
  scope: 'read:users update:users delete:users create:users update:users_app_metadata create:user_tickets read:organizations create:organizations update:organizations delete:organizations read:organization_members create:organization_members delete:organization_members'
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

    // First check if user already exists in Auth0 (any connection - Google, Facebook, etc.)
    const existingAuth0User = await getAuth0UserByEmail(userData.email);
    if (existingAuth0User) {
      console.log(`⚠️  User ${userData.email} already exists in Auth0 (${existingAuth0User.user_id}), syncing instead of creating...`);
      return await syncExistingAuth0User(userData);
    }

    const auth0User = await auth0Management.users.create({
      email: userData.email,
      name: userData.name,
      connection: 'Username-Password-Authentication',
      password: generateTempPassword(),
      email_verified: false,
      verify_email: true,

      // Store PostgreSQL role and permissions in Auth0 metadata
      // The Auth0 Action reads these and adds them to the token
      // If no role is assigned, omit role/permissions so Auth0 Action blocks login
      app_metadata: {
        ...(userData.role && { role: userData.role }),
        ...(userData.role && { permissions: userData.permissions || {} }),
        // B2B company info (if provided)
        ...(userData.company_id && { company_id: userData.company_id }),
        ...(userData.org_id && { org_id: userData.org_id }),
        db_synced: true,
        synced_at: new Date().toISOString()
      },

      // User metadata (editable by user)
      user_metadata: {
        created_via: userData.company_id ? 'company_admin_portal' : 'admin_portal'
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
    console.log(`   Updates received:`, JSON.stringify(updates));

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

    // Update role, permissions, and company info in app_metadata if provided
    const hasRole = updates.role !== undefined;
    const hasPermissions = updates.permissions !== undefined;
    const hasCompanyId = updates.company_id !== undefined;
    const hasOrgId = updates.org_id !== undefined;

    if (hasRole || hasPermissions || hasCompanyId || hasOrgId) {
      updateData.app_metadata = {
        ...(hasRole && { role: updates.role }),
        ...(hasPermissions && { permissions: updates.permissions }),
        ...(hasCompanyId && { company_id: updates.company_id }),
        ...(hasOrgId && { org_id: updates.org_id }),
        db_synced: true,
        synced_at: new Date().toISOString()
      };
      console.log(`   app_metadata to sync:`, JSON.stringify(updateData.app_metadata));
    }

    // Block/unblock user if provided
    if (updates.blocked !== undefined) {
      updateData.blocked = updates.blocked;
    }

    console.log(`   Full updateData being sent to Auth0:`, JSON.stringify(updateData));

    const auth0User = await auth0Management.users.update(
      auth0UserId,
      updateData
    );

    console.log(`✅ User updated in Auth0: ${auth0UserId}`);
    console.log(`   Auth0 response app_metadata:`, JSON.stringify(auth0User.app_metadata));

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
 * Block a user in Auth0 (used for delete/disable operations)
 * We block instead of delete to preserve audit trails and allow recovery
 * @param {string} auth0UserId - Auth0 user ID
 * @returns {Promise<Object>}
 */
export const deleteAuth0User = async (auth0UserId) => {
  try {
    console.log(`📤 Blocking user in Auth0: ${auth0UserId}`);

    await auth0Management.users.update(auth0UserId, { blocked: true });

    console.log(`✅ User blocked in Auth0: ${auth0UserId}`);

    return { auth0_user_id: auth0UserId, blocked: true };

  } catch (error) {
    console.error(`❌ Error blocking user in Auth0:`, error);

    if (error.statusCode === 404) {
      console.warn(`⚠️  User ${auth0UserId} not found in Auth0`);
      return { auth0_user_id: auth0UserId, blocked: false, error: 'User not found' };
    }

    throw new Error(`Failed to block user in Auth0: ${error.message}`);
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

    console.log(`🔄 Syncing existing Auth0 user: ${userData.email}`);
    console.log(`   Auth0 User ID: ${auth0User.user_id}`);
    console.log(`   Current blocked status: ${auth0User.blocked}`);
    console.log(`   Current app_metadata: ${JSON.stringify(auth0User.app_metadata)}`);
    console.log(`   New role to sync: ${userData.role || 'none'}`);
    console.log(`   New permissions to sync: ${JSON.stringify(userData.permissions)}`);

    // Update Auth0 user: unblock + sync role + permissions + company info
    const syncData = {
      name: userData.name,
      company_id: userData.company_id,
      org_id: userData.org_id,
      blocked: false  // Unblock user if they were previously blocked
    };

    // Always sync role - if no role assigned, explicitly clear it
    syncData.role = userData.role || null;
    syncData.permissions = userData.role ? (userData.permissions || {}) : {};

    await updateAuth0User(auth0User.user_id, syncData);

    console.log(`✅ User ${userData.email} synced to Auth0 with role: ${userData.role || 'none'}`);

    return {
      auth0_user_id: auth0User.user_id,
      email: auth0User.email,
      created: false,
      synced: true,
      unblocked: auth0User.blocked === true
    };

  } catch (error) {
    console.error(`❌ Failed to sync existing Auth0 user ${userData.email}:`, error);
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

// ==========================================
// Auth0 Organization Functions
// ==========================================

/**
 * Create an Auth0 Organization
 * @param {Object} orgData - Organization data
 * @param {string} orgData.name - Unique organization identifier (slug)
 * @param {string} orgData.display_name - Display name
 * @param {Object} orgData.metadata - Custom metadata
 * @returns {Promise<Object>} - Created Auth0 organization
 */
export const createAuth0Organization = async (orgData) => {
  try {
    console.log(`📤 Creating Auth0 Organization: ${orgData.name}`);

    const org = await auth0Management.organizations.create({
      name: orgData.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'), // Slug format
      display_name: orgData.display_name,
      metadata: orgData.metadata || {},
      branding: orgData.branding || {}
    });

    console.log(`✅ Auth0 Organization created: ${org.id}`);

    return {
      org_id: org.id,
      name: org.name,
      display_name: org.display_name,
      created: true
    };

  } catch (error) {
    console.error(`❌ Error creating Auth0 Organization:`, error);

    if (error.statusCode === 409) {
      console.log(`⚠️  Organization ${orgData.name} already exists`);
      throw new Error('Organization with this name already exists');
    }

    throw new Error(`Failed to create Auth0 Organization: ${error.message}`);
  }
};

/**
 * Update an Auth0 Organization
 * @param {string} orgId - Auth0 Organization ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} - Updated organization
 */
export const updateAuth0Organization = async (orgId, updates) => {
  try {
    console.log(`📤 Updating Auth0 Organization: ${orgId}`);

    const updateData = {};
    if (updates.display_name) updateData.display_name = updates.display_name;
    if (updates.metadata) updateData.metadata = updates.metadata;
    if (updates.branding) updateData.branding = updates.branding;

    const org = await auth0Management.organizations.update({ id: orgId }, updateData);

    console.log(`✅ Auth0 Organization updated: ${orgId}`);

    return {
      org_id: org.id,
      updated: true
    };

  } catch (error) {
    console.error(`❌ Error updating Auth0 Organization:`, error);
    throw new Error(`Failed to update Auth0 Organization: ${error.message}`);
  }
};

/**
 * Delete an Auth0 Organization
 * @param {string} orgId - Auth0 Organization ID
 * @returns {Promise<Object>}
 */
export const deleteAuth0Organization = async (orgId) => {
  try {
    console.log(`📤 Deleting Auth0 Organization: ${orgId}`);

    await auth0Management.organizations.delete({ id: orgId });

    console.log(`✅ Auth0 Organization deleted: ${orgId}`);

    return { org_id: orgId, deleted: true };

  } catch (error) {
    console.error(`❌ Error deleting Auth0 Organization:`, error);

    if (error.statusCode === 404) {
      console.warn(`⚠️  Organization ${orgId} not found in Auth0`);
      return { org_id: orgId, deleted: false, error: 'Organization not found' };
    }

    throw new Error(`Failed to delete Auth0 Organization: ${error.message}`);
  }
};

/**
 * Get an Auth0 Organization by ID
 * @param {string} orgId - Auth0 Organization ID
 * @returns {Promise<Object|null>}
 */
export const getAuth0Organization = async (orgId) => {
  try {
    const org = await auth0Management.organizations.getByID({ id: orgId });
    return org;
  } catch (error) {
    console.error(`❌ Error fetching Auth0 Organization:`, error);
    return null;
  }
};

/**
 * Get Auth0 Management API access token for direct REST calls
 * @returns {Promise<string>} Access token
 */
const getAuth0ManagementToken = async () => {
  const response = await fetch(`https://${process.env.AUTH0_MGMT_DOMAIN}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.AUTH0_MGMT_CLIENT_ID,
      client_secret: process.env.AUTH0_MGMT_CLIENT_SECRET,
      audience: `https://${process.env.AUTH0_MGMT_DOMAIN}/api/v2/`,
      grant_type: 'client_credentials'
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to get Auth0 token: ${response.statusText}`);
  }

  const data = await response.json();
  return data.access_token;
};

/**
 * Add a user to an Auth0 Organization as a member
 * Uses direct REST API call due to SDK v5 bugs with organization members
 * @param {string} orgId - Auth0 Organization ID (e.g., "org_xxxxx")
 * @param {string} auth0UserId - Auth0 User ID (e.g., "auth0|xxxxx")
 * @returns {Promise<Object>}
 */
export const addUserToAuth0Organization = async (orgId, auth0UserId) => {
  try {
    // Ensure orgId is a string
    const orgIdString = typeof orgId === 'object' && orgId !== null ? orgId.org_id || orgId.id : orgId;
    console.log(`📤 Adding user ${auth0UserId} to Auth0 Organization: ${orgIdString}`);

    // Get fresh access token
    const token = await getAuth0ManagementToken();

    // Direct REST API call to add member
    const response = await fetch(
      `https://${process.env.AUTH0_MGMT_DOMAIN}/api/v2/organizations/${orgIdString}/members`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ members: [auth0UserId] })
      }
    );

    if (!response.ok) {
      const errorBody = await response.json();
      console.error(`❌ Auth0 API error:`, errorBody);
      throw new Error(errorBody.message || `HTTP ${response.status}`);
    }

    console.log(`✅ User ${auth0UserId} added to Organization ${orgIdString}`);
    return { success: true, orgId: orgIdString, auth0UserId };
  } catch (error) {
    console.error(`❌ Error adding user to Auth0 Organization:`, error);
    throw new Error(`Failed to add user to Auth0 Organization: ${error.message}`);
  }
};

/**
 * Remove a user from an Auth0 Organization
 * Uses direct REST API call due to SDK v5 bugs
 * @param {string} orgId - Auth0 Organization ID
 * @param {string} auth0UserId - Auth0 User ID
 * @returns {Promise<Object>}
 */
export const removeUserFromAuth0Organization = async (orgId, auth0UserId) => {
  try {
    // Ensure orgId is a string
    const orgIdString = typeof orgId === 'object' && orgId !== null ? orgId.org_id || orgId.id : orgId;
    console.log(`📤 Removing user ${auth0UserId} from Auth0 Organization: ${orgIdString}`);

    // Get fresh access token
    const token = await getAuth0ManagementToken();

    // Direct REST API call to remove member
    const response = await fetch(
      `https://${process.env.AUTH0_MGMT_DOMAIN}/api/v2/organizations/${orgIdString}/members`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ members: [auth0UserId] })
      }
    );

    if (!response.ok) {
      const errorBody = await response.json();
      console.error(`❌ Auth0 API error:`, errorBody);
      throw new Error(errorBody.message || `HTTP ${response.status}`);
    }

    console.log(`✅ User ${auth0UserId} removed from Organization ${orgIdString}`);
    return { success: true, orgId: orgIdString, auth0UserId };
  } catch (error) {
    console.error(`❌ Error removing user from Auth0 Organization:`, error);
    throw new Error(`Failed to remove user from Auth0 Organization: ${error.message}`);
  }
};

export default {
  createAuth0User,
  updateAuth0User,
  deleteAuth0User,
  getAuth0UserByEmail,
  verifyAuth0Connection,
  bulkSyncUsers,
  createAuth0Organization,
  updateAuth0Organization,
  deleteAuth0Organization,
  getAuth0Organization,
  addUserToAuth0Organization,
  removeUserFromAuth0Organization
};

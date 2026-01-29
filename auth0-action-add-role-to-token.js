/**
 * Auth0 Action: Add Role and Permissions to Token
 *
 * This action:
 * 1. BLOCKS users who don't have a role assigned in app_metadata
 * 2. Adds the user's role and permissions from app_metadata to the ID and access tokens
 *
 * The role and permissions are synced from PostgreSQL database (source of truth) to Auth0 app_metadata.
 *
 * FLOW:
 * 1. User logs in
 * 2. Auth0 Action checks if user has role in app_metadata
 * 3. If no role: BLOCK LOGIN - user sees Auth0 error page
 * 4. If role exists: Add role and permissions to token as custom claims
 * 5. Application receives token with role information
 *
 * NOTE:
 * - Users without roles are blocked at Auth0 level (never reach the application)
 * - All users created via User Management have roles assigned automatically
 * - PostgreSQL database is the source of truth for roles and permissions
 *
 * HOW TO CONFIGURE IN AUTH0:
 *
 * 1. Go to Auth0 Dashboard: https://manage.auth0.com
 * 2. Navigate to: Actions > Flows > Login
 * 3. Click "Custom" tab on the right
 * 4. Click "+ Create Action" (or edit existing "Add Role to Token")
 * 5. Name: "Add Role to Token"
 * 6. Copy and paste this code into the editor
 * 7. Click "Deploy" button (top right)
 * 8. Go back to Actions > Flows > Login
 * 9. Drag the action from Custom tab to the flow (between Start and Complete)
 * 10. Click "Apply"
 */

/**
 * Handler that will be called during the execution of a PostLogin flow.
 *
 * @param {Event} event - Details about the user and the context in which they are logging in.
 * @param {PostLoginAPI} api - Interface whose methods can be used to change the behavior of the login.
 */
exports.onExecutePostLogin = async (event, api) => {
  // Get user's role and permissions from app_metadata (synced from PostgreSQL database)
  const role = event.user.app_metadata?.role;
  const permissions = event.user.app_metadata?.permissions;

  console.log(`[Auth0 Action] User login: ${event.user.email}`);
  console.log(`[Auth0 Action] app_metadata:`, JSON.stringify(event.user.app_metadata));
  console.log(`[Auth0 Action] role found:`, role);
  console.log(`[Auth0 Action] permissions found:`, permissions ? Object.keys(permissions) : 'none');

  // BLOCK USER IF NO ROLE ASSIGNED
  // Users must have a role in app_metadata to access the application
  if (!role) {
    console.log(`[Auth0 Action] ❌ BLOCKING USER - No role in app_metadata for: ${event.user.email}`);
    api.access.deny(
      'Access denied. Your account has not been assigned a role. Please contact your administrator.'
    );
    return;
  }

  // Add role to token
  // Use both namespaced and non-namespaced claims for compatibility
  api.idToken.setCustomClaim('https://dev-ybc7o1rzmlt6fu4c.ca.auth0.com/app_role', role);
  api.accessToken.setCustomClaim('https://dev-ybc7o1rzmlt6fu4c.ca.auth0.com/app_role', role);

  // Also try non-namespaced (some Auth0 configurations allow this)
  api.idToken.setCustomClaim('app_role', role);
  api.accessToken.setCustomClaim('app_role', role);

  console.log(`[Auth0 Action] ✅ Added role to token: ${role}`);

  // Add permissions to token if they exist
  if (permissions && Object.keys(permissions).length > 0) {
    api.idToken.setCustomClaim('https://dev-ybc7o1rzmlt6fu4c.ca.auth0.com/app_permissions', permissions);
    api.accessToken.setCustomClaim('https://dev-ybc7o1rzmlt6fu4c.ca.auth0.com/app_permissions', permissions);

    // Also try non-namespaced
    api.idToken.setCustomClaim('app_permissions', permissions);
    api.accessToken.setCustomClaim('app_permissions', permissions);

    console.log(`[Auth0 Action] ✅ Added permissions to token for modules:`, Object.keys(permissions));
  } else {
    console.log(`[Auth0 Action] ⚠️  No permissions in app_metadata (role: ${role})`);
  }
};


/**
 * Handler that will be invoked when this action is resuming after an external redirect.
 *
 * @param {Event} event - Details about the user and the context in which they are logging in.
 * @param {PostLoginAPI} api - Interface whose methods can be used to change the behavior of the login.
 */
exports.onContinuePostLogin = async (event, api) => {
  // Not used in this action
};

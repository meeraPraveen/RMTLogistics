/**
 * Auth0 Action: Add Role to Token
 *
 * This action adds the user's role from app_metadata to the ID and access tokens.
 * The role is synced from PostgreSQL database (source of truth) to Auth0 app_metadata.
 *
 * FLOW:
 * 1. User logs in
 * 2. Auth0 Action reads role from user.app_metadata.role (synced from database)
 * 3. Adds role to token as custom claim 'app_role'
 * 4. Application receives token with role information
 *
 * NOTE:
 * - This action does NOT block users - signup is disabled, only admins can create users
 * - All users created via User Management have roles assigned automatically
 * - PostgreSQL database is the source of truth for roles and permissions
 *
 * HOW TO CONFIGURE IN AUTH0:
 *
 * 1. Go to Auth0 Dashboard: https://manage.auth0.com
 * 2. Navigate to: Actions > Flows > Login
 * 3. Click "Custom" tab on the right
 * 4. Click "+ Create Action" (or edit existing "Block Users Without Roles")
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

  // Add role to token if it exists
  if (role) {
    // Use both namespaced and non-namespaced claims for compatibility
    api.idToken.setCustomClaim('https://dev-ybc7o1rzmlt6fu4c.ca.auth0.com/app_role', role);
    api.accessToken.setCustomClaim('https://dev-ybc7o1rzmlt6fu4c.ca.auth0.com/app_role', role);

    // Also try non-namespaced (some Auth0 configurations allow this)
    api.idToken.setCustomClaim('app_role', role);
    api.accessToken.setCustomClaim('app_role', role);

    console.log(`[Auth0 Action] ✅ Added role to token: ${role}`);
  } else {
    console.log(`[Auth0 Action] ⚠️  No role in app_metadata - user may be blocked`);
  }

  // Add permissions to token if they exist
  if (permissions) {
    api.idToken.setCustomClaim('https://dev-ybc7o1rzmlt6fu4c.ca.auth0.com/app_permissions', permissions);
    api.accessToken.setCustomClaim('https://dev-ybc7o1rzmlt6fu4c.ca.auth0.com/app_permissions', permissions);

    // Also try non-namespaced
    api.idToken.setCustomClaim('app_permissions', permissions);
    api.accessToken.setCustomClaim('app_permissions', permissions);

    console.log(`[Auth0 Action] ✅ Added permissions to token for modules:`, Object.keys(permissions));
  } else {
    console.log(`[Auth0 Action] ⚠️  No permissions in app_metadata`);
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

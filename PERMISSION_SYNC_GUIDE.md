# Permission Sync to Auth0 - Implementation Guide

## Overview

Permissions are now automatically synced from PostgreSQL to Auth0 `app_metadata.permissions` along with roles. This enables:
- **Offline permission checks** - Permissions available in JWT token without DB lookup
- **Faster frontend** - No need to fetch permissions from API
- **Consistent state** - Permissions match across database and Auth0
- **Automatic updates** - Role changes trigger permission sync

## Architecture

```
┌─────────────────────┐
│   PostgreSQL DB     │
│ role_permissions    │ ◄── Source of Truth
└──────────┬──────────┘
           │
           │ Fetch permissions by role
           ▼
┌─────────────────────┐
│  Backend Service    │
│ getRolePermissions()│
└──────────┬──────────┘
           │
           │ Sync on create/update
           ▼
┌─────────────────────┐
│      Auth0          │
│  app_metadata:      │
│  {                  │
│    role: "Admin"    │
│    permissions: {}  │ ◄── Sync Target
│  }                  │
└──────────┬──────────┘
           │
           │ Auth0 Action adds to token
           ▼
┌─────────────────────┐
│    JWT Token        │
│  app_permissions    │ ◄── Available to app
└─────────────────────┘
```

## Data Structure

### Database (role_permissions table)
```sql
role            | module                | permissions
----------------|----------------------|---------------------------
SuperAdmin      | user_management      | ["read","write","update","delete"]
SuperAdmin      | order_management     | ["read","write","update","delete"]
Admin           | order_management     | ["read","write","update","delete"]
Lead Artist     | order_management     | ["read","write","update"]
Production Tech | printing_software    | ["read","write","update"]
```

### Auth0 app_metadata
```json
{
  "role": "Admin",
  "permissions": {
    "order_management": ["read", "write", "update", "delete"],
    "inventory_management": ["read", "write", "update", "delete"],
    "printing_software": ["read", "write", "update", "delete"]
  },
  "db_synced": true,
  "synced_at": "2026-01-27T21:59:12.054Z"
}
```

### JWT Token (Custom Claims)
```json
{
  "https://dev-ybc7o1rzmlt6fu4c.ca.auth0.com/app_role": "Admin",
  "https://dev-ybc7o1rzmlt6fu4c.ca.auth0.com/app_permissions": {
    "order_management": ["read", "write", "update", "delete"],
    "inventory_management": ["read", "write", "update", "delete"],
    "printing_software": ["read", "write", "update", "delete"]
  },
  "email": "user@example.com",
  "sub": "google-oauth2|123456789"
}
```

## Implementation Details

### 1. Backend Services

#### auth0.service.js
Updated to sync permissions when creating or updating users:

```javascript
// createAuth0User
app_metadata: {
  role: userData.role,
  permissions: userData.permissions || {},  // NEW
  db_synced: true,
  synced_at: new Date().toISOString()
}

// updateAuth0User
if (updates.role || updates.permissions) {
  updateData.app_metadata = {
    ...(updates.role && { role: updates.role }),
    ...(updates.permissions && { permissions: updates.permissions }),  // NEW
    db_synced: true,
    synced_at: new Date().toISOString()
  };
}
```

#### user.service.js
Fetches and syncs permissions on user create/update:

```javascript
// createUser
const { getRolePermissions } = await import('./permissions.service.js');
const permissions = await getRolePermissions(dbUser.role);
console.log(`📋 Syncing permissions for new user with role ${dbUser.role}`);

const auth0Result = await createAuth0User({
  email: dbUser.email,
  name: dbUser.name,
  role: dbUser.role,
  permissions: permissions  // NEW
});

// updateUser (when role changes)
if (role !== undefined) {
  auth0Updates.role = role;

  const { getRolePermissions } = await import('./permissions.service.js');
  const permissions = await getRolePermissions(role);
  auth0Updates.permissions = permissions;  // NEW
  console.log(`📋 Syncing permissions for role ${role}`);
}
```

### 2. Auth0 Action

Updated [auth0-action-add-role-to-token.js](auth0-action-add-role-to-token.js):

```javascript
exports.onExecutePostLogin = async (event, api) => {
  const role = event.user.app_metadata?.role;
  const permissions = event.user.app_metadata?.permissions;  // NEW

  // Add role to token
  if (role) {
    api.idToken.setCustomClaim('https://dev-ybc7o1rzmlt6fu4c.ca.auth0.com/app_role', role);
    api.accessToken.setCustomClaim('https://dev-ybc7o1rzmlt6fu4c.ca.auth0.com/app_role', role);
  }

  // Add permissions to token (NEW)
  if (permissions) {
    api.idToken.setCustomClaim('https://dev-ybc7o1rzmlt6fu4c.ca.auth0.com/app_permissions', permissions);
    api.accessToken.setCustomClaim('https://dev-ybc7o1rzmlt6fu4c.ca.auth0.com/app_permissions', permissions);

    console.log(`[Auth0 Action] ✅ Added permissions to token for modules:`, Object.keys(permissions));
  }
};
```

### 3. Scripts

#### Sync Permissions for Specific Role
Run this after modifying role permissions in the `role_permissions` table:

```bash
node scripts/sync-role-permissions.js <RoleName>
```

Example:
```bash
# After removing "printing_software" module from Admin role
node scripts/sync-role-permissions.js Admin
```

Output:
```
🔄 Syncing permissions for role: Admin

📋 Current permissions in database:
   order_management: read, write, update, delete
   inventory_management: read, write, update, delete

📊 Found 1 user(s) with role Admin:

👤 Processing: meerapraveen07@gmail.com
   ✅ Synced successfully

============================================================
📊 Sync Summary:
   Role: Admin
   Total Users: 1
   ✅ Synced: 1
============================================================
```

#### Sync All Permissions (bulk operation)
Run this to sync permissions for all users across all roles:

```bash
node scripts/sync-all-permissions.js
```

Output:
```
🔄 Starting permission sync for all users...
📊 Found 3 users to sync

👤 Processing: meerapraveen07@gmail.com
   Role: Admin
   📋 Permissions: { order_management: [...], ... }
   ✅ Synced successfully

============================================================
📊 Sync Summary:
   Total Users: 3
   ✅ Synced: 3
   ⏭️  Skipped: 0
   ❌ Errors: 0
============================================================
```

#### Check Permissions
Verify permissions are correctly synced to Auth0:

```bash
node scripts/check-auth0-permissions.js user@example.com
```

Output:
```
🔍 Checking Auth0 permissions for: meerapraveen07@gmail.com

📊 User Details:
   User ID: google-oauth2|105248599389785182313
   Email: meerapraveen07@gmail.com
   Role: Admin

📋 App Metadata:
   Role: Admin
   DB Synced: true
   Synced At: 2026-01-27T21:59:12.054Z

   Permissions:
     order_management: read, write, update, delete
     inventory_management: read, write, update, delete
     printing_software: read, write, update, delete

   Total Modules: 3
```

## Automatic Sync Triggers

Permissions are automatically synced in these scenarios:

1. **New User Created**
   ```javascript
   POST /api/users
   → createUser()
   → getRolePermissions(role)
   → createAuth0User({ role, permissions })
   ```

2. **User Role Updated**
   ```javascript
   PUT /api/users/:id
   → updateUser({ role: 'NewRole' })
   → getRolePermissions('NewRole')
   → updateAuth0User({ role, permissions })
   ```

3. **Role Permissions Modified** (e.g., Admin loses access to printing_software)
   ```bash
   # After updating role_permissions table, sync to all users with that role
   node scripts/sync-role-permissions.js Admin
   ```

4. **Manual Sync** (for existing users or bulk operations)
   ```bash
   # Sync all users (all roles)
   node scripts/sync-all-permissions.js
   ```

## Usage in Frontend

Once deployed and users login again, permissions will be in the token:

```javascript
// Decode JWT token
const token = localStorage.getItem('id_token');
const decoded = jwt_decode(token);

// Access permissions
const permissions = decoded['https://dev-ybc7o1rzmlt6fu4c.ca.auth0.com/app_permissions'];

// Check permission
function hasPermission(module, action) {
  return permissions[module]?.includes(action);
}

// Example
if (hasPermission('order_management', 'delete')) {
  // Show delete button
}
```

## Deployment Steps

### 1. Update Backend (Already Done)
```bash
git pull origin master
npm install
npm run dev:all
```

### 2. Sync Existing Users
```bash
node scripts/sync-all-permissions.js
```

### 3. Update Auth0 Action
1. Go to [Auth0 Dashboard](https://manage.auth0.com)
2. Navigate to **Actions** → **Library**
3. Open "Add Role to Token" action
4. Replace code with updated [auth0-action-add-role-to-token.js](auth0-action-add-role-to-token.js)
5. Click **Deploy**
6. Verify it's in the **Login** flow

### 4. Test
1. Logout completely from the app
2. Login again (to get new token with permissions)
3. Check token at [jwt.io](https://jwt.io)
4. Verify `app_permissions` claim exists

## Verification

### Check Database
```bash
node scripts/check-db-user.js user@example.com
```

### Check Auth0
```bash
node scripts/check-auth0-permissions.js user@example.com
```

### Check Token
1. Login to app
2. Open browser DevTools → Console
3. Run:
   ```javascript
   const token = localStorage.getItem('id_token');
   console.log(jwt_decode(token));
   ```
4. Look for `app_permissions` claim

## Troubleshooting

### Problem: Permissions not in Auth0
**Solution**: Run sync script
```bash
node scripts/sync-all-permissions.js
```

### Problem: Permissions not in token
**Causes**:
1. Auth0 Action not deployed
2. Auth0 Action not in Login flow
3. User needs to logout/login again (old token cached)

**Solution**:
1. Deploy Auth0 Action
2. Add to Login flow
3. Logout completely + Clear browser cache + Login again

### Problem: Permissions out of date after modifying role_permissions
**Cause**: Role permissions changed in `role_permissions` table but not synced to Auth0

**Example**: Removed "printing_software" module from Admin role, but Auth0 still shows it.

**Solution**:
```bash
# Sync all users with specific role (recommended)
node scripts/sync-role-permissions.js Admin

# OR sync all users (all roles)
node scripts/sync-all-permissions.js
```

**Why this happens**: Changing `role_permissions` table doesn't automatically update Auth0. You must manually sync.

**When to use**:
- After adding/removing module access for a role
- After changing permissions (read, write, update, delete) for a module
- After bulk updates to role_permissions table

## Benefits

✅ **Performance** - No DB lookup for permissions on every request
✅ **Offline Capable** - Frontend can check permissions without API
✅ **Consistent** - Same permissions across all tokens and sessions
✅ **Automatic** - Syncs on role changes
✅ **Single Source of Truth** - Database remains authoritative
✅ **Scalable** - Auth0 handles token distribution

## Related Documentation

- [CHANGELOG.md](CHANGELOG.md) - Full change history
- [README.md](README.md) - General setup
- [TROUBLESHOOTING_TOKEN_CLAIMS.md](TROUBLESHOOTING_TOKEN_CLAIMS.md) - Token issues
- [AUTH0_SETUP_GUIDE.md](AUTH0_SETUP_GUIDE.md) - Auth0 configuration

## Next Steps

1. **Update Frontend** - Use token permissions for UI rendering
2. **Optimize Backend** - Consider using token permissions for faster checks
3. **Monitor** - Watch Auth0 logs for any issues
4. **Document** - Update API docs to reflect permission structure

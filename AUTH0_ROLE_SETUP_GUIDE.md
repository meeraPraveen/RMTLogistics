# Auth0 Role-Based Access Control Setup Guide

This guide explains how to set up role-based access control using Auth0 roles for authentication and PostgreSQL for permissions.

## Architecture Overview

### Two-Layer Security Model:

1. **Auth0 Roles** (Authentication Layer)
   - Controls WHO can access the application
   - User without role → Blocked at login
   - User with role → Allowed to login

2. **PostgreSQL Database** (Authorization Layer)
   - Controls WHAT users can do
   - Stores role-based permissions for each module
   - Backend queries database to determine user capabilities

---

## Step 1: Create Roles in Auth0

1. **Navigate to Roles:**
   - Go to Auth0 Dashboard: https://manage.auth0.com
   - Click **User Management** → **Roles**

2. **Create Each Role:**
   Click **+ Create Role** and create these roles:

   | Role Name | Description |
   |-----------|-------------|
   | `SuperAdmin` | Full access to all modules |
   | `Admin` | Order, Inventory, Printing access |
   | `Lead Artist` | Order Management access |
   | `Artist` | Limited access (define in your app) |
   | `Production Tech` | Printing Software access |

   **Important:** Role names must match EXACTLY with your PostgreSQL roles

3. **Leave Permissions Empty**
   - Don't add any permissions to the roles in Auth0
   - Permissions are managed in PostgreSQL

---

## Step 2: Configure Auth0 Action

1. **Go to Actions:**
   - Navigate to **Actions** → **Flows** → **Login**

2. **Create Action:**
   - Click **Custom** tab (right side)
   - Click **+ Create Action**
   - Name: `Block Users Without Roles`
   - Copy code from: `auth0-action-block-unauthorized-users.js`
   - Paste into editor

3. **Deploy Action:**
   - Click **Deploy** (top right)

4. **Add to Login Flow:**
   - Go back to **Actions** → **Flows** → **Login**
   - Drag "Block Users Without Roles" action into the flow
   - Place between **Start** and **Complete**
   - Click **Apply**

---

## Step 3: Assign Roles to Users

### For Existing Users:

1. **Navigate to Users:**
   - Go to **User Management** → **Users**

2. **Select a User:**
   - Click on the user's name

3. **Assign Role:**
   - Go to **Roles** tab
   - Click **Assign Roles**
   - Select the appropriate role
   - Click **Assign**

### For New Users:

**Option A: Pre-authorize (Recommended)**
1. Add user to Auth0 manually before they login
2. Assign role immediately
3. User can login on first attempt

**Option B: Assign After Blocked Login**
1. User tries to login
2. Gets blocked (no role assigned)
3. Admin assigns role in Auth0
4. User tries login again → Success

---

## Step 4: Manage Permissions in PostgreSQL

Your PostgreSQL database stores **what each role can do** in each module:

```sql
-- View current permissions
SELECT * FROM role_permissions;

-- Update permissions for a role
UPDATE role_permissions
SET permissions = '["read", "write", "update"]'
WHERE role = 'Artist' AND module = 'order_management';
```

### Permission Structure:

Each role has permissions for each module:
- `read` - Can view data
- `write` - Can create new data
- `update` - Can modify existing data
- `delete` - Can remove data

---

## Testing the Setup

### Test 1: Block Unauthorized User

1. **Logout** from your application
2. Try to login with a Google account that **does not have a role assigned** in Auth0
3. **Expected Result:** Login blocked with error message:
   > "Your account is not authorized to access this application. Please contact your administrator to request access."

### Test 2: Allow Authorized User

1. Assign a role to your test user in Auth0 (e.g., `Admin`)
2. Try to login with that user
3. **Expected Result:** Login successful, redirected to dashboard

### Test 3: Verify Permissions

1. Login as user with `Artist` role
2. Try to access different modules
3. **Expected Result:** Can only access modules where Artist has permissions in PostgreSQL

---

## User Onboarding Workflow

### Recommended Flow:

1. **Admin creates user in Auth0:**
   - User Management → Users → Create User
   - Set email and temporary password
   - Assign appropriate role

2. **Admin notifies user:**
   - Send email with login instructions
   - User can login immediately

3. **User logs in:**
   - Auth0 verifies role → Allows login
   - Backend queries PostgreSQL for permissions
   - User sees only modules they have access to

---

## Troubleshooting

### User can't login - "No roles assigned"

**Problem:** User exists in Auth0 but has no role
**Solution:**
1. Go to User Management → Users
2. Find the user
3. Go to Roles tab
4. Assign appropriate role

### User can login but sees empty dashboard

**Problem:** Role exists in Auth0 but not in PostgreSQL permissions table
**Solution:**
1. Check database: `SELECT * FROM role_permissions WHERE role = 'UserRole';`
2. Add missing permissions for that role

### Auth0 Action not blocking users

**Problem:** Action may not be in the Login flow
**Solution:**
1. Go to Actions → Flows → Login
2. Verify action is between Start and Complete
3. Click Apply if not saved

---

## Maintenance

### Adding a New Role:

1. **Create in Auth0:**
   - User Management → Roles → Create Role

2. **Add to PostgreSQL:**
   ```sql
   INSERT INTO role_permissions (role, module, permissions) VALUES
   ('NewRole', 'order_management', '["read"]');
   ```

3. **Assign to Users:**
   - User Management → Users → Select user → Assign Role

### Removing a Role:

1. **Unassign from all users first**
2. **Delete from PostgreSQL:**
   ```sql
   DELETE FROM role_permissions WHERE role = 'OldRole';
   ```
3. **Delete from Auth0:**
   - User Management → Roles → Delete

---

## Summary

✅ **What's Controlled by Auth0:**
- User authentication
- Role assignment
- Login blocking (no role = no access)

✅ **What's Controlled by PostgreSQL:**
- Module permissions
- Feature-level access control
- Permission granularity (read/write/update/delete)

This hybrid approach gives you:
- Simple login control (Auth0)
- Flexible permission management (PostgreSQL)
- No database calls during Auth0 login flow
- Easy role assignment via Auth0 Dashboard

# Admin Guide: Auth0 Gatekeeper Approach

## 🔐 Security Model

**Auth0 acts as the gatekeeper** - only users created in Auth0 can login.
**Your PostgreSQL database** stores roles and permissions for those users.

### How It Works

```
User tries to login
    ↓
Auth0: Is this user in Auth0? ❌ Block at login / ✅ Allow
    ↓
User reaches your app
    ↓
Your DB: What role does this user have?
    ↓
Grant access based on role permissions
```

## 👥 Adding New Users (Two-Step Process)

To add a new user, you must create them in **BOTH** places:

### Step 1: Create User in Auth0

1. Go to [Auth0 Dashboard](https://manage.auth0.com/)
2. Navigate to **User Management** > **Users**
3. Click **Create User**
4. Fill in:
   - **Email**: user@example.com
   - **Password**: (set a temp password or use passwordless)
   - **Connection**: Username-Password-Authentication (or your connection)
5. Click **Create**
6. **Copy the User ID** (e.g., `auth0|63f8d7b3a1b2c3d4e5f6g7h8`)

**⚠️ Important:** If you skip this step, the user **cannot login** at all.

### Step 2: Add User to PostgreSQL

Connect to your database and run:

```sql
-- Connect to database
psql -U postgres -d auth0_rbac

-- Insert user with their role
INSERT INTO users (auth0_user_id, email, role)
VALUES ('auth0|USER_ID_FROM_STEP_1', 'user@example.com', 'Admin');

-- Verify
SELECT * FROM users WHERE email = 'user@example.com';
```

**Available Roles:**
- `SuperAdmin` - Full access to everything
- `Admin` - Access to Order, Inventory, Printing modules
- `Lead Artist` - Access to Order Management only
- `Artist` - No default access (can be configured)
- `Production Tech` - Access to Printing Software only

**Note:** You can add users to the database either BEFORE or AFTER their first login:
- **Before (recommended):** User immediately gets the correct role
- **After:** User temporarily gets default 'Artist' role, then you assign proper role

### What Happens When User Logs In

1. **Auth0 authenticates** → ✅ User is in Auth0 / ❌ Blocked
2. **App checks PostgreSQL** → Get user's role
3. **If user in database** → Use assigned role (e.g., 'Admin')
4. **If user NOT in database** → Use default role ('Artist')
5. **App loads permissions** for that role
6. **User accesses modules** based on permissions

## 🔄 Quick Add Script

For convenience, use this script to add users:

```sql
-- Add a new user (simple version)
INSERT INTO users (auth0_user_id, email, role)
VALUES ('auth0|YOUR_ID_HERE', 'newuser@example.com', 'Admin')
ON CONFLICT (auth0_user_id) DO NOTHING;
```

**The `status` field is optional** - it's only useful if you want to track:
- Who hasn't logged in yet ('invited')
- Who is actively using the system ('active')
- Who has been blocked ('suspended')

For the basic Auth0 Gatekeeper approach, you can ignore the `status` field completely.

## 📋 Managing Users

### View All Users

```sql
SELECT
  email,
  role,
  status,
  created_at,
  updated_at
FROM users
ORDER BY created_at DESC;
```

### Change User Role

```sql
UPDATE users
SET role = 'SuperAdmin'
WHERE email = 'user@example.com';
```

### Suspend User Access

```sql
UPDATE users
SET status = 'suspended'
WHERE email = 'user@example.com';
```

**Note:** Suspended users can still login to Auth0, but will be blocked by your app.

### Reactivate User

```sql
UPDATE users
SET status = 'active'
WHERE email = 'user@example.com';
```

### Delete User (Both Places)

**Step 1: Delete from Auth0**
1. Go to Auth0 Dashboard → Users
2. Find the user
3. Click **Actions** → **Delete**

**Step 2: Delete from Database**
```sql
DELETE FROM users WHERE email = 'user@example.com';
```

## 🎯 Using the API (SuperAdmin Only)

You can also manage users via API endpoints:

### Get All Users

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/users
```

### Invite User (Creates in DB, you still need to add to Auth0)

```bash
curl -X POST http://localhost:3001/api/users/invite \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "role": "Admin"
  }'
```

### Update User Role

```bash
curl -X PUT http://localhost:3001/api/users/auth0|USER_ID/role \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "SuperAdmin"}'
```

### Suspend User

```bash
curl -X POST http://localhost:3001/api/users/auth0|USER_ID/suspend \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🚨 Important Security Notes

### ✅ What This Protects Against:
- **Unauthorized access**: Users not in Auth0 cannot login
- **Role-based access**: Users can only access modules they're allowed
- **Account takeover**: Auth0 handles authentication securely
- **Brute force**: Auth0 has built-in protections

### ⚠️ Admin Responsibilities:
1. **Keep both systems in sync** - User in Auth0 = User in DB
2. **Remove users from both places** when they leave
3. **Review permissions regularly**
4. **Use strong Auth0 connection settings**
5. **Enable MFA in Auth0** for sensitive roles

## 📊 Audit and Monitoring

### Check for Sync Issues

Users in Auth0 but not in DB:
```sql
-- After first login, check for users with default role
SELECT * FROM users WHERE role = 'Artist' AND status = 'active';
```

Users in DB but not in Auth0:
- Check Auth0 Dashboard manually
- If user deleted from Auth0, remove from DB too

### View Audit Log

```sql
SELECT
  u.email,
  al.action,
  al.details,
  al.created_at
FROM audit_log al
JOIN users u ON al.user_id = u.id
ORDER BY al.created_at DESC
LIMIT 50;
```

## 🔧 Troubleshooting

### User can't login at all
**Cause:** User not in Auth0
**Fix:** Create user in Auth0 first

### User can login but sees "Access Denied"
**Cause:** User's role doesn't have permissions
**Fix:** Update user's role or grant permissions to that role

### User can login but has wrong role
**Cause:** Database has wrong role assigned
**Fix:** Update role in database

### User should be blocked but can still access
**Cause:** User status in DB is 'active' or user not created in DB yet
**Fix:** Set status to 'suspended' or remove from Auth0

## 📝 Best Practices

### For Production:

1. **Document the two-step process** for your team
2. **Create a script** to automate user creation in both places
3. **Set up monitoring** for users who login but aren't in DB
4. **Regular audits** to ensure Auth0 and DB are in sync
5. **Use Auth0 Organizations** (paid feature) for better user management
6. **Enable MFA** for SuperAdmin accounts
7. **Set password policies** in Auth0
8. **Monitor failed logins** in Auth0 Dashboard

### Recommended Workflow:

```bash
# 1. Create in Auth0 (via Dashboard)
# 2. Get Auth0 User ID
# 3. Add to PostgreSQL
psql -U postgres -d auth0_rbac <<EOF
INSERT INTO users (auth0_user_id, email, role, status)
VALUES ('auth0|USER_ID', 'email@domain.com', 'ROLE', 'invited');
EOF
# 4. Notify user to login
# 5. Verify they appear as 'active' in database
```

## 🎓 Training Checklist for Admins

- [ ] Understand Auth0 is the gatekeeper
- [ ] Know how to create users in Auth0
- [ ] Know how to add users to PostgreSQL
- [ ] Can change user roles
- [ ] Can suspend/reactivate users
- [ ] Know how to delete users properly
- [ ] Understand the audit log
- [ ] Know where to find this guide!

## 📞 Support

For technical issues:
- Check server logs: `npm run dev`
- Check PostgreSQL: `SELECT * FROM users;`
- Check Auth0: Dashboard → Users
- Review audit log for recent changes

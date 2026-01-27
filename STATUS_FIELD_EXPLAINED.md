# Status Field - Optional Feature

## ❓ What is the `status` field?

The `status` field in the `users` table is an **optional** feature that helps you track user account states.

## 🎯 Do You Need It?

**For basic Auth0 Gatekeeper approach: NO**

You can completely ignore the `status` field. Just use:
```sql
INSERT INTO users (auth0_user_id, email, role)
VALUES ('auth0|123', 'user@example.com', 'Admin');
```

## 📊 Status Values (If You Use It)

If you want to track user states, the `status` field supports:

| Status | Meaning | Use Case |
|--------|---------|----------|
| `invited` | User created but hasn't logged in yet | Track who you've added but hasn't activated |
| `active` | User has logged in and is using the system | Normal operating state |
| `suspended` | User is blocked from accessing the system | Temporarily disable access without deleting |

## 🔧 How to Add the Status Field

The status field is added via migration (optional):

```bash
# Run the migration to add status tracking
psql -U postgres -d auth0_rbac -f database/migration-invite-only.sql
```

This adds:
- `status` column (default: 'invited')
- `invited_by` column (tracks who created the user)
- `invited_at` timestamp

## 💡 When to Use Status Field

### ✅ Use it if you want to:
- Track which users haven't logged in yet
- Temporarily suspend users without deleting them
- See audit trail of who invited whom
- Generate reports on user adoption

### ❌ Don't need it if:
- You just want basic role-based access
- Auth0 gatekeeper is enough security
- You don't care about tracking activation
- You prefer to delete users instead of suspending

## 🔄 With Status Field

```sql
-- Add user with status tracking
INSERT INTO users (auth0_user_id, email, role, status)
VALUES ('auth0|123', 'user@example.com', 'Admin', 'invited');

-- User logs in → Status changes to 'active'

-- Later, suspend user
UPDATE users SET status = 'suspended' WHERE email = 'user@example.com';

-- User blocked from app but can still login to Auth0
```

## 🚫 Without Status Field

```sql
-- Add user (simpler)
INSERT INTO users (auth0_user_id, email, role)
VALUES ('auth0|123', 'user@example.com', 'Admin');

-- User has immediate access

-- To block user, delete them
DELETE FROM users WHERE email = 'user@example.com';

-- User blocked from app, can still login to Auth0 but gets default 'Artist' role
```

## 🎭 Code Behavior

The code handles both cases:

```javascript
// With status field
if (user.status !== 'active') {
  return null; // Block access
}

// Without status field (status is undefined/null)
// User automatically gets access based on role
```

## 📝 Recommendation

**Start without status field** - Keep it simple!

Add it later if you need:
- User lifecycle tracking
- Suspend/reactivate functionality
- Invitation audit trail
- Compliance/reporting requirements

## 🔄 Migration Path

**Currently no status field?** Stay that way!

**Want to add it?**
```bash
psql -U postgres -d auth0_rbac -f database/migration-invite-only.sql
```

**Want to remove it?**
```sql
ALTER TABLE users DROP COLUMN IF EXISTS status;
ALTER TABLE users DROP COLUMN IF EXISTS invited_by;
ALTER TABLE users DROP COLUMN IF EXISTS invited_at;
```

---

**Bottom Line:** The `status` field is a nice-to-have feature for advanced user management. The basic Auth0 Gatekeeper approach works perfectly without it.

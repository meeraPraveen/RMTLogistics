# User Management Implementation Guide
## PostgreSQL as Source of Truth with Auth0 Sync

### Overview
This guide explains how to implement user management where:
- **PostgreSQL** is the source of truth for users, roles, and permissions
- **Auth0** handles authentication (login) and issues JWT tokens
- Changes in PostgreSQL automatically sync to Auth0
- Admins manage users through your application UI

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    COMPLETE USER FLOW                         │
└──────────────────────────────────────────────────────────────┘

1. ADMIN CREATES USER
   └─> [Admin UI]
       └─> Save to PostgreSQL (email, role, permissions)
           └─> Sync to Auth0 via Management API
               └─> Auth0 sends invitation email to user

2. USER FIRST LOGIN
   └─> [Auth0 Login Screen]
       └─> User enters credentials
           └─> Auth0 validates & issues JWT token
               └─> App receives JWT
                   └─> Looks up user in PostgreSQL
                       └─> Loads role & permissions from DB
                           └─> User gets access

3. ADMIN UPDATES USER ROLE
   └─> [Admin UI]
       └─> Update PostgreSQL
           └─> Sync to Auth0 app_metadata
               └─> Next login: New permissions apply

4. ADMIN DELETES USER
   └─> [Admin UI]
       └─> Delete from PostgreSQL
           └─> Block/delete in Auth0
               └─> User cannot log in anymore
```

---

## Implementation Steps

### Step 1: Set Up Auth0 Management API Access

You need a Machine-to-Machine application in Auth0 to make API calls.

**In Auth0 Dashboard:**

1. Go to **Applications** → **Applications** → **Create Application**
2. Name: "User Management API"
3. Type: **Machine to Machine Applications**
4. API: **Auth0 Management API**
5. Permissions needed:
   - `read:users`
   - `create:users`
   - `update:users`
   - `delete:users`
   - `update:users_app_metadata`
   - `create:user_tickets` (for password reset emails)

6. Copy:
   - Domain
   - Client ID
   - Client Secret

7. Add to `.env`:
```env
# Auth0 Management API
AUTH0_MGMT_DOMAIN=dev-ybc7o1rzmlt6fu4c.ca.auth0.com
AUTH0_MGMT_CLIENT_ID=your_m2m_client_id
AUTH0_MGMT_CLIENT_SECRET=your_m2m_client_secret
```

---

### Step 2: Install Auth0 Management SDK

```bash
npm install auth0
```

---

### Step 3: Create Auth0 Service

Create `server/services/auth0.service.js`:

This service handles all Auth0 Management API operations:
- Create user in Auth0
- Update user metadata (role, permissions)
- Block/unblock users
- Delete users
- Send invitation emails

---

### Step 4: Update User Service

Modify `server/services/user.service.js`:

**Key Changes:**
- `createUser()` → Saves to PostgreSQL THEN syncs to Auth0
- `updateUser()` → Updates PostgreSQL THEN syncs to Auth0
- `deleteUser()` → Deletes from PostgreSQL THEN blocks in Auth0

---

### Step 5: Data Flow

#### Creating a User:
```javascript
1. Admin fills form: { email: "user@example.com", role: "Admin" }
2. POST /api/users
3. user.service.createUser():
   a. INSERT into PostgreSQL users table
   b. Call auth0.service.createAuth0User()
   c. Auth0 creates user + sends invitation email
   d. Return success to admin
```

#### User Logs In:
```javascript
1. User clicks "Login with Google"
2. Auth0 authenticates user
3. Auth0 returns JWT token with user's email and sub (user ID)
4. Frontend sends token to backend
5. auth.middleware extracts token
6. Looks up user in PostgreSQL by email/auth0_user_id
7. Loads role and permissions from PostgreSQL
8. User gets access based on DB permissions
```

#### Updating a User:
```javascript
1. Admin changes role from "Artist" to "Admin"
2. PUT /api/users/:id
3. user.service.updateUser():
   a. UPDATE PostgreSQL users table
   b. Call auth0.service.updateAuth0User()
   c. Auth0 updates app_metadata with new role
   d. Next time user logs in, JWT will have updated info
```

---

### Step 6: Database Schema

Your current schema already has the `users` table. We just need to ensure it has:

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    auth0_user_id VARCHAR(255) UNIQUE,  -- Can be NULL initially
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'Artist',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Important Fields:**
- `auth0_user_id`: NULL when first created, filled in after Auth0 sync
- `email`: Source of truth, used to match Auth0 users
- `role`: Source of truth for authorization

---

### Step 7: JWT Token Flow

**What's in the JWT Token (from Auth0):**
```json
{
  "sub": "google-oauth2|123456",
  "email": "user@example.com",
  "email_verified": true,
  "name": "John Doe",
  "iss": "https://your-domain.auth0.com/",
  "aud": "your_client_id",
  "iat": 1234567890,
  "exp": 1234654290
}
```

**What Your App Does with the Token:**
1. Validates token signature
2. Extracts `email` and `sub`
3. Looks up user in PostgreSQL
4. Loads role and permissions from DB
5. Attaches to `req.user` for authorization

**Your DB is Always the Source of Truth!**

---

### Step 8: Security Considerations

✅ **Auth0 handles authentication** (who you are)
✅ **PostgreSQL handles authorization** (what you can do)

**Protection Layers:**
1. Auth0: Only users in Auth0 can get a token
2. Your Middleware: Only users in PostgreSQL can access app
3. RBAC: Only users with correct permissions can access modules

**User States:**
- In Auth0 + In PostgreSQL = ✅ Full access
- In Auth0 + NOT in PostgreSQL = ❌ 403 Forbidden
- NOT in Auth0 = ❌ Cannot even log in

---

## Testing Plan

### Test 1: Create User
1. Admin creates user with email + role
2. Verify user in PostgreSQL
3. Verify user in Auth0
4. User receives invitation email
5. User can log in
6. User has correct permissions

### Test 2: Update User
1. Admin changes user's role
2. Verify role updated in PostgreSQL
3. Verify app_metadata updated in Auth0
4. User logs out and back in
5. User now has new permissions

### Test 3: Delete User
1. Admin deletes user
2. Verify user removed from PostgreSQL
3. Verify user blocked in Auth0
4. User cannot log in anymore

---

## Benefits of This Architecture

✅ **Single Source of Truth**: PostgreSQL controls everything
✅ **No Dual Management**: Don't manage users in two places
✅ **Instant Updates**: Role changes apply on next login
✅ **Scalable**: Auth0 handles auth infrastructure
✅ **Secure**: JWT tokens + database validation
✅ **Flexible**: Easy to add custom fields to your DB

---

## Next Steps

1. Set up Auth0 Management API credentials
2. Install `auth0` npm package
3. Create auth0.service.js
4. Update user.service.js with sync logic
5. Test create user flow
6. Test update user flow
7. Test delete user flow
8. Build admin UI for user management

---

## Questions?

- How to handle Auth0 sync failures?
  → Implement retry logic + manual sync button in UI

- What if Auth0 and DB get out of sync?
  → Build a sync audit page to show discrepancies

- How to bulk import users?
  → Create CSV import endpoint that syncs each user


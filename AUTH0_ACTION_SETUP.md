# Auth0 Action Setup - Add Role to Token

## Overview

This action adds the user's role from `app_metadata` to ID and access tokens during login.

**File:** `auth0-action-add-role-to-token.js`

## What It Does

1. Reads the user's role from `user.app_metadata.role` (synced from PostgreSQL)
2. Adds the role as a custom claim `app_role` to both ID and access tokens
3. Logs login activity with role information
4. **Does NOT block users** - all authorization is handled by your backend

## Setup Instructions

### 1. Go to Auth0 Dashboard

Navigate to: https://manage.auth0.com

### 2. Create or Update the Action

1. Go to **Actions** → **Flows** → **Login**
2. Click **Custom** tab (right side)
3. Find existing "Block Users Without Roles" action or click **+ Create Action**
4. Name: `Add Role to Token`
5. Copy the code from `auth0-action-add-role-to-token.js`
6. Paste into the editor
7. Click **Deploy** (top right)

### 3. Add to Login Flow

1. Go back to **Actions** → **Flows** → **Login**
2. Drag the "Add Role to Token" action from Custom tab
3. Place it between **Start** and **Complete** in the flow
4. Remove any old "Block Users Without Roles" action if present
5. Click **Apply**

## How It Works

### Login Flow

```
User logs in
    ↓
Auth0 authenticates user
    ↓
Action reads user.app_metadata.role
    ↓
Role added to token as 'app_role' claim
    ↓
Token sent to application
    ↓
Backend validates token and uses role
```

### Token Claims

After login, tokens will include:

```json
{
  "app_role": "Admin",
  "email": "user@example.com",
  "sub": "google-oauth2|123456",
  ...
}
```

## Role Sync Flow

```
User Management UI (Admin edits user)
    ↓
PUT /api/users/:id (role: "Production Tech")
    ↓
updateUser() function
    ↓
1. Update PostgreSQL database
    ↓
2. Sync to Auth0 app_metadata via updateAuth0User()
    ↓
3. Auth0 app_metadata.role = "Production Tech"
    ↓
Next login: Action reads updated role and adds to token
```

## Verification

### Check if Action is Active

1. Go to **Actions** → **Flows** → **Login**
2. Verify "Add Role to Token" appears in the flow between Start and Complete

### Test Login

1. Login to your application
2. Check browser console or network tab
3. Decode the ID token (use jwt.io)
4. Verify `app_role` claim is present

### Check Auth0 Logs

1. Go to **Monitoring** → **Logs** in Auth0 Dashboard
2. Look for login events
3. You should see logs like: `User user@example.com logged in with role: Admin`

## Troubleshooting

### User can't login

**Symptom:** "Your account is not authorized to access this application"

**Solution:**
- This means the old blocking action is still active
- Go to Actions → Flows → Login and remove the old action
- Replace it with the new "Add Role to Token" action

### Role not in token

**Symptom:** `app_role` claim missing from token

**Solutions:**
1. Check Auth0 Dashboard → User Details → Metadata
2. Verify `app_metadata.role` exists
3. If missing, update user via User Management UI to trigger sync
4. Verify Action is deployed and in the login flow

### Role is outdated in token

**Symptom:** Token shows old role after update

**Solutions:**
1. Token is cached - user needs to logout and login again
2. Check if role was synced to Auth0 via User Management API
3. Run test: `node scripts/test-role-sync.js user@example.com`

## Benefits of This Approach

✅ **Simple** - Minimal code, easy to understand
✅ **No blocking** - Signup is disabled, no need to block users
✅ **Database is truth** - PostgreSQL manages all roles
✅ **Auto-sync** - Roles sync from DB → Auth0 → Token automatically
✅ **Optional** - Even if removed, backend can fetch roles from DB

## Alternative: Remove Action Entirely

Since your backend already fetches roles from the database, you can:

1. Remove this Action completely from Auth0
2. Backend will continue to work (it fetches role from DB on each request)
3. Pro: Simpler architecture
4. Con: Slight performance overhead (extra DB query per request)

The Action is just a **performance optimization** - it reduces DB queries by including the role in the token.

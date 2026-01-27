# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2026-01-27

### Fixed - Auth0 Token Claims Issue
**Problem**: Users seeing "Loading" role in UI because Auth0 was stripping non-namespaced custom claims from tokens.

**Root Cause**: Auth0 security policy removes custom claims that don't use proper namespace format (e.g., `app_role` gets stripped, but `https://yourapp.com/app_role` is preserved).

**Solution**:
- Updated Auth0 Action to use namespaced claims: `https://yourapp.com/app_role`
- Added enhanced debugging with console.log statements
- Created comprehensive troubleshooting guide: [TROUBLESHOOTING_TOKEN_CLAIMS.md](TROUBLESHOOTING_TOKEN_CLAIMS.md)

**Files Changed**:
- `auth0-action-add-role-to-token.js` - Added namespaced claim format
- `TROUBLESHOOTING_TOKEN_CLAIMS.md` - New troubleshooting guide
- `README.md` - Updated with link to token claims guide

**Impact**: Users must update their Auth0 Action code and redeploy for the fix to take effect.

---

### Removed - auth0_role Column (Single Source of Truth)
**Problem**: Having both `role` (database) and `auth0_role` (from Auth0) columns created confusion about which was authoritative, causing role mismatch warnings.

**Solution**: Removed `auth0_role` column entirely. Database is now the single source of truth.

**Architecture**:
```
┌─────────────┐
│  PostgreSQL │ ◄── Source of Truth
│  role col   │
└──────┬──────┘
       │ Sync FROM DB
       ▼
┌─────────────┐
│    Auth0    │
│ app_metadata│ ◄── Sync Target Only
│    .role    │
└─────────────┘
```

**Changes**:
1. **Database**:
   - Dropped `auth0_role` column from `users` table
   - Dropped `idx_users_auth0_role` index
   - Migration script: [database/remove-auth0-role-column.js](database/remove-auth0-role-column.js)

2. **Backend**:
   - `getUserByAuth0Id()` - Removed `auth0_role` from SELECT query
   - `getUsers()` - Removed `auth0_role` from SELECT query
   - `updateLastLogin()` - Removed `auth0_role` parameter and UPDATE
   - `auth.middleware.js` - Removed role mismatch checking logic
   - Simplified logging: `✅ Access GRANTED for user@example.com - Database Role: Admin`

3. **Frontend**:
   - `UserManagement.jsx` - Removed "Auth0 Role" column from user table
   - Simplified UI to show only database role

**Benefits**:
- ✅ Eliminates confusion about which role is authoritative
- ✅ Removes "ROLE MISMATCH" warnings from logs
- ✅ Simplifies architecture - one source of truth
- ✅ Auth0 app_metadata is purely a sync target, not a source
- ✅ Cleaner codebase with less redundancy

**Verified Working**:
- meerapraveen07@gmail.com now logs in successfully with Admin role
- info@redmooseonline.com logs in successfully with SuperAdmin role
- No more "No role in Auth0 token" errors (after Auth0 Action is updated)
- User Management page displays correctly without Auth0 Role column

---

## Migration Guide

### For Existing Deployments

If you're updating an existing deployment:

1. **Update Auth0 Action** (fixes "Loading" role issue):
   ```bash
   # Copy code from auth0-action-add-role-to-token.js
   # Deploy in Auth0 Dashboard -> Actions -> Library
   ```

2. **Run Database Migration** (removes auth0_role column):
   ```bash
   node database/remove-auth0-role-column.js
   ```

3. **Restart Application**:
   ```bash
   npm run dev:all
   ```

4. **Test**:
   - Users should be able to login without "Loading" role issue
   - User Management page should show simplified role display
   - No database errors about missing auth0_role column

---

## Documentation Updates

- [TROUBLESHOOTING_TOKEN_CLAIMS.md](TROUBLESHOOTING_TOKEN_CLAIMS.md) - New guide for token/claims issues ⭐
- [TROUBLESHOOTING_LOADING_ROLE.md](TROUBLESHOOTING_LOADING_ROLE.md) - General loading issues
- [README.md](README.md) - Updated architecture documentation

---

## Commits

- `caabf5f` - Fix Auth0 Action to use namespaced custom claims
- `3ba0fcb` - Remove auth0_role column - database is now the single source of truth

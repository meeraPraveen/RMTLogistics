# Troubleshooting: Role Not Appearing in Token (Token Claims Issue)

## Problem

User sees **"Loading"** role in the UI, and backend logs show:
```
⚠️  No role in Auth0 token for user@example.com
```

Even though:
- ✅ User exists in database with correct role
- ✅ User's Auth0 `app_metadata.role` is correctly synced
- ✅ Auth0 Action is deployed and executing

## Root Cause

**Auth0 strips non-namespaced custom claims from tokens.**

When you use:
```javascript
api.idToken.setCustomClaim('app_role', role);  // ❌ Gets stripped
```

Auth0 removes this claim because it's not properly namespaced. According to Auth0's security rules, custom claims must use a namespaced format to prevent collision with standard OIDC claims.

## Solution

### Step 1: Update Auth0 Action Code

Copy the updated code from [`auth0-action-add-role-to-token.js`](auth0-action-add-role-to-token.js):

```javascript
exports.onExecutePostLogin = async (event, api) => {
  const role = event.user.app_metadata?.role;

  console.log(`[Auth0 Action] User login: ${event.user.email}`);
  console.log(`[Auth0 Action] app_metadata:`, JSON.stringify(event.user.app_metadata));
  console.log(`[Auth0 Action] role found:`, role);

  if (role) {
    // Use NAMESPACED claim (required by Auth0)
    api.idToken.setCustomClaim('https://dev-ybc7o1rzmlt6fu4c.ca.auth0.com/app_role', role);
    api.accessToken.setCustomClaim('https://dev-ybc7o1rzmlt6fu4c.ca.auth0.com/app_role', role);

    // Also add non-namespaced (for compatibility)
    api.idToken.setCustomClaim('app_role', role);
    api.accessToken.setCustomClaim('app_role', role);

    console.log(`[Auth0 Action] ✅ Added role to token: ${role}`);
  } else {
    console.log(`[Auth0 Action] ⚠️  No role in app_metadata`);
  }
};
```

**Key changes:**
1. Added **namespaced claim** `https://dev-ybc7o1rzmlt6fu4c.ca.auth0.com/app_role` (Auth0 respects this)
2. Keep non-namespaced `app_role` as fallback
3. Added detailed console.log statements for debugging

### Step 2: Deploy Updated Action in Auth0

1. Go to **Auth0 Dashboard** → **Actions** → **Library**
2. Find your "Add Role to Token" action
3. Click **Edit**
4. Replace the code with the updated version above
5. Click **Deploy** (top right)
6. Verify it appears in **Actions** → **Flows** → **Login** flow

### Step 3: Clear User Session

The updated action only affects **new logins**, not existing sessions:

1. **Logout completely** from the application
2. **Close all browser tabs** for the app
3. **Clear cookies** (or use Incognito/Private window)
4. **Login again**

### Step 4: Verify in Auth0 Logs

1. Go to **Auth0 Dashboard** → **Monitoring** → **Logs**
2. Find the most recent "Success Login" (sl) event
3. Click to expand
4. Look for console.log output:

You should see:
```
[Auth0 Action] User login: user@example.com
[Auth0 Action] app_metadata: {"role":"Production Tech"}
[Auth0 Action] role found: Production Tech
[Auth0 Action] ✅ Added role to token: Production Tech
```

If you see:
```
[Auth0 Action] ⚠️  No role in app_metadata
```

Then the role is not synced to Auth0. Run:
```bash
node scripts/force-sync-role.js user@example.com
```

### Step 5: Verify Token Contents (Advanced)

If role still doesn't appear, decode the token:

1. Open browser DevTools → Network tab
2. Login to the app
3. Find a request with `Authorization: Bearer ...` header
4. Copy the token (long string after "Bearer ")
5. Go to [jwt.io](https://jwt.io)
6. Paste token
7. Check payload for:

```json
{
  "https://dev-ybc7o1rzmlt6fu4c.ca.auth0.com/app_role": "Production Tech",
  "app_role": "Production Tech",
  "email": "user@example.com",
  ...
}
```

## Why Namespacing Matters

Auth0 enforces namespace requirements to:
1. **Prevent collision** with standard OIDC claims (`sub`, `email`, `name`, etc.)
2. **Security** - Ensures custom claims are clearly identified
3. **Compliance** with OpenID Connect specification

**Format:** Use any URL you control (doesn't need to exist):
- ✅ `https://dev-ybc7o1rzmlt6fu4c.ca.auth0.com/app_role`
- ✅ `https://mycompany.com/claims/role`
- ✅ `https://example.com/role`
- ❌ `app_role` (no namespace)
- ❌ `role` (might conflict with standard claims)

## Backend Compatibility

The backend middleware already checks for both formats ([auth.middleware.js:57](server/middleware/auth.middleware.js#L57)):

```javascript
const auth0Role = req.auth.app_role || req.auth['https://dev-ybc7o1rzmlt6fu4c.ca.auth0.com/app_role'];
```

So the updated Action (which sets both) will work immediately.

## Common Mistakes

### ❌ Mistake 1: Not Using Namespace
```javascript
api.idToken.setCustomClaim('app_role', role);  // Gets stripped by Auth0
```

### ✅ Fix: Use Namespaced Claim
```javascript
api.idToken.setCustomClaim('https://dev-ybc7o1rzmlt6fu4c.ca.auth0.com/app_role', role);
```

### ❌ Mistake 2: Not Redeploying Action
Editing the code is not enough - you **must click Deploy**.

### ❌ Mistake 3: Not Clearing Session
Old tokens are cached. You **must logout and login again**.

### ❌ Mistake 4: Checking Old Logs
Check the **latest login** after deploying the fix, not old logs.

## Testing Checklist

- [ ] Auth0 Action code updated with namespaced claim
- [ ] Action deployed (Deploy button clicked)
- [ ] Action appears in Login flow (Actions → Flows → Login)
- [ ] User logged out completely
- [ ] Browser cookies cleared (or using Incognito)
- [ ] User logged in again
- [ ] Auth0 logs show `[Auth0 Action] ✅ Added role to token`
- [ ] Backend logs show `✅ Access GRANTED` (not `⚠️  No role in Auth0 token`)
- [ ] UI shows correct role (not "Loading")

## Still Not Working?

If role still doesn't appear after following all steps:

### Check 1: Verify app_metadata in Auth0
```bash
node scripts/check-auth0-user.js user@example.com
```

Should show:
```
app_metadata: { role: 'Production Tech' }
```

If not, sync it:
```bash
node scripts/force-sync-role.js user@example.com
```

### Check 2: Verify Action is Actually Running

Auth0 Dashboard → Monitoring → Logs → Find "Success Login" event

If no console.log output appears, the Action might not be executing:
1. Check Action is in the Login flow
2. Check Action status is "Deployed" (not "Draft")
3. Try removing and re-adding Action to flow

### Check 3: Check Auth0 Action Errors

Auth0 Dashboard → Monitoring → Logs → Look for "Failed Login" (f) events

If you see errors related to the Action, fix the code and redeploy.

## Related Documentation

- [Auth0 Custom Claims](https://auth0.com/docs/secure/tokens/json-web-tokens/create-custom-claims)
- [Auth0 Actions](https://auth0.com/docs/customize/actions)
- [TROUBLESHOOTING_LOADING_ROLE.md](TROUBLESHOOTING_LOADING_ROLE.md) - General role loading issues
- [HOW_TO_FIX_AUTH0_ACTION.md](HOW_TO_FIX_AUTH0_ACTION.md) - Auth0 Action setup guide

## Summary

**Problem:** Non-namespaced custom claims get stripped by Auth0
**Solution:** Use namespaced format `https://dev-ybc7o1rzmlt6fu4c.ca.auth0.com/app_role`
**Required:** Redeploy Action + Clear session + Login again

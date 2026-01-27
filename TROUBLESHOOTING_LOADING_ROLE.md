# Troubleshooting: Role Shows "Loading" in UI

## Problem
User role shows as "Loading" in the UI after login.

## Root Cause
The Auth0 ID token does **NOT** contain the `app_role` claim. The backend rejects all API requests with:
```
🚫 Access DENIED for meerapraveen07@gmail.com - No role in Auth0 token
```

## Why This Happens

### Issue 1: Auth0 Action Not Deployed
The Auth0 Action that adds `app_role` to the token is not deployed or not active in the Login flow.

### Issue 2: Cached Token
Even if the Action is deployed, the user's browser has a **cached token** from before the Action was deployed. The cached token doesn't have the `app_role` claim.

## Solution

### Step 1: Verify Auth0 Action is Deployed

1. Go to https://manage.auth0.com
2. Navigate to: **Actions** → **Flows** → **Login**
3. Verify you see the action in the flow between Start and Complete
4. Click on the action to verify it has this code:

```javascript
exports.onExecutePostLogin = async (event, api) => {
  const role = event.user.app_metadata?.role;

  if (role) {
    api.idToken.setCustomClaim('app_role', role);
    api.accessToken.setCustomClaim('app_role', role);
    console.log(`User ${event.user.email} logged in with role: ${role}`);
  } else {
    console.log(`User ${event.user.email} logged in without a role in app_metadata`);
  }
};
```

5. Make sure it's **Deployed** (green checkmark)
6. Make sure it's **Applied** to the flow

### Step 2: Force Complete Logout

The user MUST completely logout to invalidate the cached token:

#### Option A: Use Logout Button
1. Click the **Logout** button in your application
2. Wait for redirect to complete

#### Option B: Manual Logout URL
Go to this URL (replace placeholders):
```
https://YOUR_AUTH0_DOMAIN/v2/logout?client_id=YOUR_CLIENT_ID&returnTo=http://localhost:3000
```

Example:
```
https://dev-ybc7o1rzmlt6fu4c.ca.auth0.com/v2/logout?client_id=YOUR_CLIENT_ID&returnTo=http://localhost:3000
```

### Step 3: Clear Browser Cache

After logging out:

#### Chrome/Edge
1. Press `Ctrl+Shift+Delete` (Windows) or `Cmd+Shift+Delete` (Mac)
2. Select "Cookies and other site data" and "Cached images and files"
3. Click "Clear data"

#### Alternative: Use Incognito/Private Mode
1. Open Incognito/Private browser window
2. Navigate to http://localhost:3000
3. Login fresh

### Step 4: Login Again

1. Go to http://localhost:3000
2. Click Login
3. Authenticate with Google/Email
4. You should now see your role correctly

## Verification

### Check Backend Logs

After login, check the server logs. You should see:

✅ **Success:**
```
🔐 Auth0 authenticated user: meerapraveen07@gmail.com (google-oauth2|...)
✅ Access GRANTED for meerapraveen07@gmail.com - Auth0 Role: Production Tech, Database Role: Production Tech
```

❌ **Still Failing:**
```
🔐 Auth0 authenticated user: meerapraveen07@gmail.com (google-oauth2|...)
🚫 Access DENIED for meerapraveen07@gmail.com - No role in Auth0 token
```

### Check Auth0 Logs

1. Go to https://manage.auth0.com
2. Navigate to: **Monitoring** → **Logs**
3. Look for recent login (type: "Success Login")
4. Click on the log entry
5. Check "Context Data" → "Actions" → Should see your action executed
6. Should see console.log: `User email logged in with role: RoleName`

### Check Browser Console

1. Open browser DevTools (F12)
2. Go to **Application** tab → **Local Storage** → http://localhost:3000
3. Look for Auth0 tokens
4. Copy the ID token
5. Go to https://jwt.io
6. Paste the token
7. Check the payload - you should see:
   ```json
   {
     "app_role": "Production Tech",
     "email": "meerapraveen07@gmail.com",
     ...
   }
   ```

## If Still Not Working

### Check if app_metadata has the role

Run this script:
```bash
node scripts/check-auth0-user.js meerapraveen07@gmail.com
```

You should see:
```
📦 App Metadata:
{
  "db_synced": true,
  "role": "Production Tech",
  "synced_at": "2026-01-27T..."
}
```

If `role` is missing or wrong, sync it:
```bash
node scripts/force-sync-role.js meerapraveen07@gmail.com
```

### Check Auth0 Action Logs

1. Go to Auth0 Dashboard → **Monitoring** → **Logs**
2. Filter by your login email
3. Look for errors in the Action execution
4. Common issues:
   - Action not deployed
   - Action has syntax errors
   - Action not in the Login flow
   - Action is disabled

### Nuclear Option: Reset Everything

```bash
# 1. Force sync role from DB to Auth0
node scripts/force-sync-role.js meerapraveen07@gmail.com

# 2. User must:
#    - Logout completely
#    - Clear all browser data
#    - Close ALL browser windows
#    - Re-open browser in Incognito
#    - Login again
```

## Common Mistakes

1. ❌ **Not logging out** - Just refreshing the page won't work
2. ❌ **Not clearing cache** - Token is cached in browser
3. ❌ **Action not deployed** - Must click "Deploy" AND "Apply"
4. ❌ **Wrong action code** - Make sure `event.user.app_metadata.role` is correct
5. ❌ **Testing with same browser** - Use Incognito to avoid cache issues

## Why "Loading" Appears

The UI shows "Loading" because:

1. Frontend calls `/api/permissions/user/me` to get role
2. Backend middleware checks `req.auth.app_role` (from token)
3. If missing → Returns 403 Forbidden
4. Frontend never gets the role → Shows "Loading" forever
5. Check browser Network tab → You'll see 403 errors

## Summary Checklist

- [ ] Auth0 Action is deployed with correct code
- [ ] Auth0 Action is in the Login flow (between Start and Complete)
- [ ] Auth0 Action is Applied (not just drafted)
- [ ] User's `app_metadata.role` exists in Auth0
- [ ] User has logged out completely
- [ ] Browser cache cleared OR using Incognito
- [ ] User logged in fresh after all above steps
- [ ] Backend logs show "Access GRANTED" (not "Access DENIED")
- [ ] Token contains `app_role` claim (verify at jwt.io)

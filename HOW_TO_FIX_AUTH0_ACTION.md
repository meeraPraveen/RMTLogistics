# How to Fix: Auth0 Action Not Adding Role to Token

## Problem
Backend logs show:
```
🚫 Access DENIED for meerapraveen07@gmail.com - No role in Auth0 token
```

## Diagnosis

✅ **User has role in Auth0:** `app_metadata.role = "Production Tech"`
❌ **Token does NOT have `app_role` claim**
❌ **Auth0 Action is NOT executing**

## Root Cause

The Auth0 Action is either:
1. Not deployed properly
2. Not in the Login flow
3. Has a syntax error
4. Is disabled/inactive

## Step-by-Step Fix

### Step 1: Verify Auth0 Action Code

1. Go to https://manage.auth0.com
2. Navigate to: **Actions** → **Library**
3. Look for your action (might be called "Block Users Without Roles" or "Add Role to Token")
4. Click on it
5. **Verify the code is EXACTLY:**

```javascript
exports.onExecutePostLogin = async (event, api) => {
  // Get user's role from app_metadata (synced from PostgreSQL database)
  const role = event.user.app_metadata?.role;

  // Add role to token if it exists
  if (role) {
    api.idToken.setCustomClaim('app_role', role);
    api.accessToken.setCustomClaim('app_role', role);

    console.log(`User ${event.user.email} logged in with role: ${role}`);
  } else {
    console.log(`User ${event.user.email} logged in without a role in app_metadata`);
  }
};

exports.onContinuePostLogin = async (event, api) => {
  // Not used in this action
};
```

6. If the code is different, **replace it** with the code above
7. Click **Deploy** (top right) - it should show a green checkmark ✅
8. Wait for "Deployment successful" message

### Step 2: Add Action to Login Flow

1. Go to **Actions** → **Flows** → **Login**
2. You should see a flow diagram with:
   - **Start** (left side)
   - **Complete** (right side)
   - Your action should be **between them**

3. If your action is NOT in the flow:
   - Look at the **Custom** tab on the right
   - Find your action
   - **Drag and drop** it between Start and Complete
   - Click **Apply** (top right)

4. If there's an old "Block Users Without Roles" action:
   - Remove it (drag it out or click X)
   - Add the new one
   - Click **Apply**

### Step 3: Verify Action is Active

After deploying and applying:

1. Go to **Actions** → **Flows** → **Login**
2. You should see:
   ```
   [Start] → [Your Action Name] → [Complete]
   ```
3. The action should have a **green indicator** (not yellow or red)
4. Click on the action in the flow - should say "Last deployed: X minutes ago"

### Step 4: Test with Auth0 Logs

1. **User must logout completely** from your app
2. **User logs in again** (incognito mode recommended)
3. Go to Auth0 Dashboard → **Monitoring** → **Logs**
4. Look for the latest "Success Login" entry for meerapraveen07@gmail.com
5. Click on it
6. Look for:
   - **Type:** "Success Login" (should be green)
   - **Actions:** Should show your action executed
   - **Console Logs:** Should see: `User meerapraveen07@gmail.com logged in with role: Production Tech`

### Step 5: Verify Token Contains app_role

After user logs in:

1. Open browser DevTools (F12)
2. Go to **Application** tab → **Local Storage** → `http://localhost:3000`
3. Look for keys starting with `@@auth0spajs@@`
4. Find the entry with `body` containing the ID token
5. Copy the long JWT string (starts with `eyJ...`)
6. Go to https://jwt.io
7. Paste the token
8. In the payload section, you should see:

```json
{
  "app_role": "Production Tech",
  "email": "meerapraveen07@gmail.com",
  "sub": "google-oauth2|105248599389785182313",
  ...
}
```

### Step 6: Check Backend Logs

After login, check your backend logs:

✅ **Success** (should see this):
```
🔐 Auth0 authenticated user: meerapraveen07@gmail.com (google-oauth2|105248599389785182313)
✅ Access GRANTED for meerapraveen07@gmail.com - Auth0 Role: Production Tech, Database Role: Production Tech (using DB role)
```

❌ **Still failing** (if you see this):
```
🔐 Auth0 authenticated user: meerapraveen07@gmail.com (google-oauth2|105248599389785182313)
🚫 Access DENIED for meerapraveen07@gmail.com - No role in Auth0 token
```

## Common Mistakes

### Mistake 1: Action Not Deployed
**Symptom:** Code looks correct but doesn't run
**Fix:** Click the **Deploy** button (top right when editing action)
**Verify:** Should see green checkmark and "Last deployed: X ago"

### Mistake 2: Action Not in Flow
**Symptom:** Action is deployed but not executing
**Fix:** Go to Actions → Flows → Login, drag action between Start and Complete
**Verify:** Should see action in the flow diagram

### Mistake 3: Action Not Applied
**Symptom:** Action is in flow but changes not live
**Fix:** After adding action to flow, click **Apply** button
**Verify:** Should see "Changes applied successfully"

### Mistake 4: Syntax Error in Action
**Symptom:** Action fails silently
**Fix:** Check Auth0 Logs for error messages
**Verify:** Look for "Failed Action" or error logs

### Mistake 5: Wrong Event Hook
**Symptom:** Action doesn't run at login
**Fix:** Make sure it's in **Login** flow (not Post-Login, Pre-Registration, etc.)
**Verify:** Actions → Flows → **Login** specifically

## If Still Not Working

### Nuclear Option: Create Brand New Action

1. Go to Actions → Library
2. Click **+ Create Action**
3. Choose **Login / Post Login**
4. Name: `Add Role To Token`
5. Paste the code from Step 1 above
6. Click **Deploy**
7. Go to Actions → Flows → Login
8. **Remove** any old actions
9. **Drag** the new "Add Role To Token" action into the flow
10. Click **Apply**
11. User must logout and login again

### Check Auth0 Action Execution Limit

1. Go to Auth0 Dashboard → **Monitoring** → **Logs**
2. Filter by "Failed Action"
3. Look for quota/limit errors
4. Free tier: 1,000 executions/month
5. If over limit, actions won't run

### Verify Auth0 Action Runtime

1. Actions must use **Node.js 18** runtime
2. Check in action settings
3. If wrong runtime, recreate action

## Final Verification Checklist

Before user logs in again, verify ALL of these:

- [ ] Auth0 Action code is correct (copy-paste from above)
- [ ] Action is **Deployed** (green checkmark in Library)
- [ ] Action is **in the Login flow** (between Start and Complete)
- [ ] Flow changes are **Applied** (not just saved)
- [ ] Action shows as **Active** (not draft)
- [ ] User's `app_metadata.role` exists in Auth0 (run: `node scripts/check-auth0-user.js email`)
- [ ] User has **logged out completely** from app
- [ ] Browser cache cleared OR using incognito
- [ ] User logs in **fresh** after all above steps

## Expected Result

After fixing and fresh login:

1. Backend logs: `✅ Access GRANTED for meerapraveen07@gmail.com - Auth0 Role: Production Tech`
2. Auth0 Logs: "Success Login" with action executed
3. Token contains: `"app_role": "Production Tech"`
4. UI shows role correctly (not "Loading")

## Still Stuck?

If after ALL the above steps it still doesn't work, there might be a configuration issue with your Auth0 tenant. Contact Auth0 support or share your Auth0 Action logs here for debugging.

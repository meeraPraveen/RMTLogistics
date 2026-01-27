# Auth0 Setup Guide: Block Unauthorized Users at Login

This guide explains how to configure Auth0 to block users who are not in your application database **before** they can access your application.

## Overview

Instead of allowing any Auth0 user to authenticate and then blocking them in your app, this setup blocks unauthorized users **at the Auth0 level** during the login process.

### How It Works

1. User attempts to log in via Auth0
2. Auth0 Action triggers **during login**
3. Action calls your API: `GET /api/users/check-authorization?email={email}`
4. Your API checks PostgreSQL database:
   - ✅ **User exists** → Auth0 allows login
   - ❌ **User not found** → Auth0 blocks login with error message
5. User either enters your app or sees "Access Denied" from Auth0

---

## Step 1: Configure Your API Endpoint

The API endpoint is already created at:

```
GET http://localhost:3001/api/users/check-authorization?email=user@example.com
```

**Response if user exists (200):**
```json
{
  "success": true,
  "authorized": true,
  "email": "user@example.com",
  "role": "SuperAdmin"
}
```

**Response if user not found (404):**
```json
{
  "success": false,
  "authorized": false,
  "message": "User not found in application database"
}
```

### For Production:
- Deploy your API to a public URL (e.g., Heroku, AWS, Railway)
- The endpoint must be publicly accessible (no auth required)
- Consider adding IP whitelisting or API key authentication for extra security

---

## Step 2: Create Auth0 Action

1. **Go to Auth0 Dashboard**
   - Navigate to: https://manage.auth0.com/dashboard/
   - Select your tenant: `dev-ybc7o1rzmlt6fu4c.ca.auth0.com`

2. **Navigate to Actions**
   - Click **Actions** in the left sidebar
   - Click **Flows**
   - Select **Login** flow

3. **Create Custom Action**
   - On the right side, click the **Custom** tab
   - Click **+ Create Action** button
   - Name: `Block Unauthorized Users`
   - Trigger: `Login / Post Login`
   - Runtime: `Node 18` (or latest)

4. **Copy the Action Code**
   - Open the file: `auth0-action-block-unauthorized-users.js`
   - Copy all the code
   - Paste it into the Auth0 code editor

5. **Add Secret for API URL**
   - In the left sidebar of the action editor, click the **Secrets** icon (🔒)
   - Click **+ Add Secret**
   - Key: `API_URL`
   - Value:
     - Development: `http://localhost:3001`
     - Production: `https://your-production-api.com`
   - Click **Create**

6. **Deploy the Action**
   - Click **Deploy** button (top right)
   - Wait for deployment to complete

7. **Add Action to Login Flow**
   - Go back to **Actions > Flows > Login**
   - You should see your action in the **Custom** tab on the right
   - **Drag and drop** the "Block Unauthorized Users" action into the flow
   - Place it after "Start" and before "Complete"
   - Click **Apply** to save the flow

---

## Step 3: Test the Blocking

### Test 1: Block Unauthorized User

1. Make sure you have at least one user in your database:
   ```sql
   SELECT * FROM users;
   ```

2. Try to log in with a Google account that is **NOT** in your database
3. You should see an Auth0 error page:
   > **Access Denied**
   >
   > Your account is not authorized to access this application. Please contact your administrator to request access.

### Test 2: Allow Authorized User

1. Add a test user to your database:
   ```sql
   INSERT INTO users (auth0_user_id, email, role)
   VALUES ('google-oauth2|123456', 'yourtest@gmail.com', 'Artist');
   ```

2. Log in with that email
3. You should be able to access the application successfully

### View Auth0 Logs

To debug issues:
1. Go to **Monitoring > Logs** in Auth0 Dashboard
2. Look for login attempts
3. Click on any log entry to see details
4. Check the action execution logs for any errors

---

## Step 4: Production Deployment

### For Development (localhost)

Auth0 **cannot** call `http://localhost:3001` from their servers. You have two options:

#### Option A: Use ngrok (Temporary Testing)
```bash
# Install ngrok: https://ngrok.com/download
ngrok http 3001

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Update Auth0 Action secret API_URL to use this URL
```

#### Option B: Deploy to Production
Deploy your API to a cloud provider:
- **Heroku**: Free tier available
- **Railway**: Easy deployment
- **AWS/Azure**: More control
- **Vercel/Netlify**: Good for serverless

Update the Auth0 Action secret `API_URL` to your production URL.

---

## Security Considerations

### 1. Endpoint Security
The `/api/users/check-authorization` endpoint is **publicly accessible** (no auth required). This is necessary because Auth0 needs to call it before the user is authenticated.

**Recommended Security Measures:**
- Add IP whitelisting (only allow Auth0's IP addresses)
- Add API key authentication
- Rate limiting to prevent abuse

### 2. Error Handling
The action is configured to **"fail closed"** - if your API is down or returns an error, login is **blocked**.

To change to "fail open" (allow login on error), uncomment the code in the action:
```javascript
// Uncomment to allow login when API is down (less secure)
// console.log('WARNING: Allowing login despite authorization check failure');
// return;
```

### 3. Performance
The action adds a ~100-500ms delay to the login process (API call time). This is acceptable for most applications.

---

## Troubleshooting

### Users getting blocked even though they're in the database

1. Check Auth0 logs: **Monitoring > Logs**
2. Verify the API URL in Action secrets
3. Test the endpoint manually:
   ```bash
   curl "http://localhost:3001/api/users/check-authorization?email=test@example.com"
   ```
4. Check server logs for errors

### Action not triggering

1. Verify the action is deployed
2. Check that it's added to the Login flow
3. Make sure you clicked "Apply" after adding it
4. Clear your browser cache and try again

### localhost URL not working

Auth0 servers cannot reach localhost. Use ngrok or deploy to production.

---

## Alternative: Auth0 Organizations (Paid Feature)

If you have a paid Auth0 plan, you can use **Organizations** which provide built-in user management without needing custom actions.

---

## Summary

You now have:
- ✅ Public API endpoint for Auth0 to check authorization
- ✅ Auth0 Action that blocks unauthorized users during login
- ✅ Users not in your database are blocked **before** entering your app

**Next Steps:**
1. Configure the Auth0 Action in your dashboard
2. Test with authorized and unauthorized users
3. Deploy your API to production before going live

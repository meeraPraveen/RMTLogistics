# 🚀 Quick Start Guide - Get Running in 15 Minutes

## Prerequisites Checklist

- [ ] Node.js 16+ installed
- [ ] PostgreSQL 12+ installed
- [ ] Auth0 account created (free tier is fine)

---

## Step 1: Install PostgreSQL

### Windows
1. Download from [postgresql.org/download/windows](https://www.postgresql.org/download/windows/)
2. Run installer
3. **Remember your postgres password!**
4. Default port: 5432 ✅

### Mac
```bash
brew install postgresql@15
brew services start postgresql@15
```

### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

---

## Step 2: Install Dependencies

```bash
# Backend dependencies
npm install

# Frontend dependencies
cd client
npm install
cd ..
```

---

## Step 3: Setup Database

```bash
# Option A: Automatic setup (easiest)
npm run db:setup

# Option B: Manual setup
# 1. Create database
psql -U postgres
CREATE DATABASE auth0_rbac;
\q

# 2. Run migrations
psql -U postgres -d auth0_rbac -f database/schema.sql
psql -U postgres -d auth0_rbac -f database/seed.sql
```

**Expected output:**
```
✅ Database 'auth0_rbac' created
✅ Tables created successfully
✅ Seed data inserted successfully
```

---

## Step 4: Configure Auth0

### A. Create Auth0 Application

1. Go to [Auth0 Dashboard](https://manage.auth0.com/)
2. Click **Applications** → **Create Application**
3. Name: `RBAC System` (or any name)
4. Type: **Single Page Web Applications**
5. Click **Create**

### B. Configure Application Settings

In the application settings:

**Application URIs:**
- **Allowed Callback URLs**: `http://localhost:3000`
- **Allowed Logout URLs**: `http://localhost:3000`
- **Allowed Web Origins**: `http://localhost:3000`

Click **Save Changes**

### C. Copy Credentials

Note these values:
- **Domain**: `your-tenant.auth0.com`
- **Client ID**: `abc123...`

---

## Step 5: Configure Environment Variables

### Backend Configuration

```bash
# Copy example file
cp .env.example .env
```

Edit `.env`:
```env
# Auth0
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your-client-id

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=auth0_rbac
DB_USER=postgres
DB_PASSWORD=YOUR_POSTGRES_PASSWORD

# Server
PORT=3001
NODE_ENV=development
```

### Frontend Configuration

```bash
cd client
cp .env.example .env
```

Edit `client/.env`:
```env
VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=your-client-id
VITE_API_URL=http://localhost:3001
```

---

## Step 6: Create Your First User

### A. Create User in Auth0

1. Auth0 Dashboard → **User Management** → **Users**
2. Click **Create User**
3. Fill in:
   - **Email**: your-email@example.com
   - **Password**: Set a strong password
   - **Connection**: Username-Password-Authentication
4. Click **Create**
5. **Copy the User ID** (looks like `auth0|63f8d7b3a1b2c3d4e5f6g7h8`)

### B. Add User to Database

```bash
# Connect to database
psql -U postgres -d auth0_rbac
```

```sql
-- Replace with your actual Auth0 User ID and email
INSERT INTO users (auth0_user_id, email, role)
VALUES ('auth0|YOUR_ACTUAL_USER_ID', 'your-email@example.com', 'SuperAdmin');

-- Verify
SELECT * FROM users;

-- Exit
\q
```

---

## Step 7: Start the Application

### Option 1: Run Both Servers Together (Recommended)

```bash
npm run dev:all
```

### Option 2: Run Separately

**Terminal 1 - Backend:**
```bash
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd client
npm run dev
```

**Expected Output:**
```
🚀 Server running on http://localhost:3001
📚 API Documentation: http://localhost:3001/api
🔐 Auth Mode: Mock (Development)
✅ Connected to PostgreSQL database
```

---

## Step 8: Access the Application

1. Open browser: **http://localhost:3000**
2. Click **Sign In with Auth0**
3. Enter your email and password
4. You should be redirected to the dashboard
5. You'll see all 5 modules (as SuperAdmin)

---

## 🎉 You're Running!

### What to Do Next:

- **Add more users**: See [ADMIN_GUIDE.md](ADMIN_GUIDE.md)
- **Manage permissions**: Go to User Management module
- **Understand security**: Read [SECURITY_MODEL.md](SECURITY_MODEL.md)

---

## ❌ Troubleshooting

### Database Connection Error

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Fix:**
- Check PostgreSQL is running: `pg_ctl status` (Windows) or `brew services list` (Mac)
- Start PostgreSQL: `pg_ctl start` or `brew services start postgresql@15`

### Auth0 Login Fails

```
Error: redirect_uri mismatch
```

**Fix:**
- Check Auth0 Dashboard → Application Settings
- Verify Callback URLs include `http://localhost:3000`
- Save changes and try again

### User Gets "Access Denied"

**Cause:** User not in database

**Fix:**
```sql
psql -U postgres -d auth0_rbac

-- Check if user exists
SELECT * FROM users WHERE email = 'your-email@example.com';

-- If not found, add them
INSERT INTO users (auth0_user_id, email, role)
VALUES ('auth0|USER_ID', 'your-email@example.com', 'SuperAdmin');
```

### Wrong PostgreSQL Password

```
Error: password authentication failed
```

**Fix:**
- Update `.env` with correct password
- Or reset postgres password:
```bash
psql -U postgres
ALTER USER postgres PASSWORD 'newpassword';
```

### Port Already in Use

```
Error: Port 3001 already in use
```

**Fix:**
```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <process_id> /F

# Mac/Linux
lsof -i :3001
kill -9 <process_id>
```

---

## 📋 Verification Checklist

After starting, verify everything works:

- [ ] Backend running on http://localhost:3001
- [ ] Frontend running on http://localhost:3000
- [ ] Can access login page
- [ ] Can login with Auth0
- [ ] Dashboard shows your email and role
- [ ] Can see all modules (if SuperAdmin)
- [ ] Can navigate to User Management
- [ ] Database has your user record

---

## 🎓 Next Steps

### 1. Add Team Members

```sql
-- Add each team member
INSERT INTO users (auth0_user_id, email, role) VALUES
  ('auth0|USER_ID_1', 'admin@company.com', 'Admin'),
  ('auth0|USER_ID_2', 'artist@company.com', 'Lead Artist'),
  ('auth0|USER_ID_3', 'tech@company.com', 'Production Tech');
```

### 2. Customize Permissions

1. Login as SuperAdmin
2. Go to **User Management** module
3. Select a role
4. Toggle modules and permissions
5. Click **Save Changes**

### 3. Test Different Roles

- Logout
- Login as different user
- Verify they only see their allowed modules

### 4. Enable Production Mode

When ready for production:

1. Update `.env`: `NODE_ENV=production`
2. Get SSL certificate
3. Update Auth0 URLs to production domain
4. Use strong database password
5. Enable Auth0 MFA

---

## 📚 Documentation

- **[README.md](README.md)** - Full documentation
- **[ADMIN_GUIDE.md](ADMIN_GUIDE.md)** - User management guide
- **[DATABASE_SETUP.md](DATABASE_SETUP.md)** - Detailed database setup
- **[SECURITY_MODEL.md](SECURITY_MODEL.md)** - Security architecture
- **[QUICK_START.md](QUICK_START.md)** - 10-minute overview

---

## 🆘 Still Having Issues?

1. Check server console for error messages
2. Check browser console (F12) for errors
3. Verify all environment variables are set
4. Ensure Auth0 and database credentials are correct
5. Review the troubleshooting section above

---

## 🎯 Success Criteria

You know it's working when:

✅ You can login with Auth0
✅ Dashboard shows your correct role
✅ You can access modules based on your role
✅ User Management shows all permissions
✅ No errors in server or browser console

**Congratulations! Your Auth0 RBAC system is running!** 🎉

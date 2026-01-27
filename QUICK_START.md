# Quick Start Guide

Get your Auth0 RBAC application running in 10 minutes!

## ✅ What You Need

- Node.js 16+
- PostgreSQL 12+
- Auth0 account (free)

## 🚀 Step-by-Step Setup

### Step 1: Install PostgreSQL

**Windows:** Download from [postgresql.org](https://www.postgresql.org/download/windows/)
**Mac:** `brew install postgresql@15`
**Linux:** `sudo apt install postgresql`

### Step 2: Create Database

```bash
psql -U postgres
CREATE DATABASE auth0_rbac;
\q
```

### Step 3: Clone & Install

```bash
cd Auth0_NoAPI
npm install
cd client && npm install && cd ..
```

### Step 4: Setup Database

```bash
npm run db:setup  # Create tables
npm run db:seed   # Insert default data
```

### Step 5: Configure Auth0

1. Go to [Auth0 Dashboard](https://manage.auth0.com/)
2. Create **Single Page Application**
3. Copy **Domain** and **Client ID**
4. Set these URLs:
   - Callback: `http://localhost:3000`
   - Logout: `http://localhost:3000`
   - Web Origins: `http://localhost:3000`

### Step 6: Configure Environment

```bash
# Backend
cp .env.example .env
```

Edit `.env`:
```env
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your-client-id

DB_HOST=localhost
DB_PORT=5432
DB_NAME=auth0_rbac
DB_USER=postgres
DB_PASSWORD=your_postgres_password
```

```bash
# Frontend
cd client
cp .env.example .env
```

Edit `client/.env`:
```env
VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=your-client-id
VITE_API_URL=http://localhost:3001
```

### Step 7: Add Your User

After logging in with Auth0 once:

1. Get your User ID from Auth0 Dashboard → Users
2. Add to database:

```sql
psql -U postgres -d auth0_rbac

INSERT INTO users (auth0_user_id, email, role)
VALUES ('auth0|YOUR_ID_HERE', 'your-email@example.com', 'SuperAdmin');

\q
```

### Step 8: Run the App

```bash
npm run dev:all
```

Visit: http://localhost:3000

## 🎉 You're Done!

- Login with Auth0
- You should see all 5 modules (as SuperAdmin)
- Go to User Management to modify permissions

## 🔧 Common Issues

**Database connection error?**
- Check PostgreSQL is running
- Verify `.env` credentials

**Auth0 login fails?**
- Check callback URLs in Auth0 dashboard
- Verify `.env` has correct domain and client ID

**Access denied after login?**
- Make sure you added your user to the database
- Check the Auth0 user ID matches exactly

## 📚 Next Steps

- [Full README](README.md) - Complete documentation
- [Database Guide](DATABASE_SETUP.md) - Detailed database setup
- Add more users to the database
- Customize permissions via User Management module

## 🆘 Help

Issues? Check:
1. Server console for errors
2. Browser console for Auth0 errors
3. PostgreSQL logs: `tail -f /var/log/postgresql/postgresql-*.log`

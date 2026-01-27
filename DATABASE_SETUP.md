# PostgreSQL Database Setup Guide

This guide will help you set up PostgreSQL for the Auth0 RBAC application.

## Prerequisites

- PostgreSQL 12 or higher installed
- Access to create databases and tables

## Installation

### Windows

1. **Download PostgreSQL:**
   - Visit [PostgreSQL Downloads](https://www.postgresql.org/download/windows/)
   - Download the installer for Windows
   - Run the installer

2. **During Installation:**
   - Set a password for the `postgres` user (remember this!)
   - Default port: `5432`
   - Install pgAdmin (optional but recommended GUI tool)

3. **Verify Installation:**
   ```cmd
   psql --version
   ```

### macOS

Using Homebrew:
```bash
brew install postgresql@15
brew services start postgresql@15
```

### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

## Database Setup

### Step 1: Create Database

Using command line:

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE auth0_rbac;

# Connect to the new database
\c auth0_rbac

# Exit
\q
```

Or using pgAdmin:
1. Open pgAdmin
2. Right-click "Databases" → "Create" → "Database"
3. Name: `auth0_rbac`
4. Click "Save"

### Step 2: Run Schema Migration

From the project root directory:

```bash
# Option 1: Using npm script
npm run db:setup

# Option 2: Using psql directly
psql -U postgres -d auth0_rbac -f database/schema.sql
```

This creates three tables:
- `users` - Maps Auth0 users to roles
- `role_permissions` - Stores role-permission mappings
- `audit_log` - Tracks permission changes

### Step 3: Seed Initial Data

```bash
# Option 1: Using npm script
npm run db:seed

# Option 2: Using psql directly
psql -U postgres -d auth0_rbac -f database/seed.sql
```

This populates:
- Default role permissions (SuperAdmin, Admin, Lead Artist, etc.)
- Sample users (you'll need to update these)

### Step 4: Configure Environment Variables

1. Copy the example file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your PostgreSQL credentials:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=auth0_rbac
   DB_USER=postgres
   DB_PASSWORD=your_password_here
   ```

### Step 5: Update Sample Users

You need to replace the Auth0 user IDs in the `users` table with real IDs:

1. Log into your Auth0 Dashboard
2. Go to **User Management** → **Users**
3. Click on a user
4. Copy their **User ID** (e.g., `auth0|63f8d7b3a1b2c3d4e5f6g7h8`)

5. Update the database:

```sql
-- Connect to database
psql -U postgres -d auth0_rbac

-- Update user with real Auth0 ID
UPDATE users
SET auth0_user_id = 'auth0|YOUR_REAL_ID_HERE'
WHERE email = 'admin@example.com';

-- Verify
SELECT * FROM users;
```

Or add a new user:

```sql
INSERT INTO users (auth0_user_id, email, role)
VALUES ('auth0|YOUR_REAL_ID', 'your-email@example.com', 'SuperAdmin');
```

## Verify Setup

### Check Tables

```sql
psql -U postgres -d auth0_rbac

-- List all tables
\dt

-- Check users
SELECT * FROM users;

-- Check permissions
SELECT * FROM role_permissions;

-- Exit
\q
```

### Test Connection

Start your server:
```bash
npm run dev
```

You should see:
```
✅ Connected to PostgreSQL database
🚀 Server running on http://localhost:3001
```

## Database Schema

### Users Table

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| auth0_user_id | VARCHAR(255) | Auth0 user ID (unique) |
| email | VARCHAR(255) | User email |
| role | VARCHAR(50) | User role |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Last update time |

### Role Permissions Table

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| role | VARCHAR(50) | Role name |
| module | VARCHAR(50) | Module name |
| permissions | JSONB | Array of permissions |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Last update time |

### Audit Log Table

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| user_id | INTEGER | User ID (FK to users) |
| action | VARCHAR(100) | Action performed |
| details | JSONB | Additional details |
| created_at | TIMESTAMP | Action timestamp |

## Common Operations

### Add a New User

```sql
INSERT INTO users (auth0_user_id, email, role)
VALUES ('auth0|NEW_USER_ID', 'user@example.com', 'Admin');
```

### Change User Role

```sql
UPDATE users
SET role = 'SuperAdmin'
WHERE email = 'user@example.com';
```

### View All Permissions for a Role

```sql
SELECT * FROM role_permissions WHERE role = 'Admin';
```

### Reset Permissions to Default

Use the API endpoint:
```bash
curl -X POST http://localhost:3001/api/permissions/reset \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Troubleshooting

### Connection Refused

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:**
- Ensure PostgreSQL is running: `sudo systemctl status postgresql` (Linux) or check Services (Windows)
- Check if port 5432 is in use: `netstat -an | grep 5432`

### Authentication Failed

```
Error: password authentication failed for user "postgres"
```

**Solution:**
- Verify password in `.env` file
- Reset postgres password if needed:
  ```bash
  sudo -u postgres psql
  ALTER USER postgres PASSWORD 'new_password';
  ```

### Database Does Not Exist

```
Error: database "auth0_rbac" does not exist
```

**Solution:**
```bash
psql -U postgres
CREATE DATABASE auth0_rbac;
\q
```

### Permission Denied

```
Error: permission denied for table users
```

**Solution:**
Grant permissions to your user:
```sql
GRANT ALL PRIVILEGES ON DATABASE auth0_rbac TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
```

## Backup and Restore

### Backup

```bash
pg_dump -U postgres auth0_rbac > backup.sql
```

### Restore

```bash
psql -U postgres auth0_rbac < backup.sql
```

## Production Considerations

1. **Use Environment Variables** - Never hardcode credentials
2. **Connection Pooling** - Already configured in `database.js`
3. **SSL/TLS** - Enable for production connections
4. **Regular Backups** - Automate database backups
5. **Monitoring** - Set up query performance monitoring
6. **Indices** - Already created for frequent lookups
7. **Row-Level Security** - Consider implementing for multi-tenant setups

## Next Steps

After database setup:
1. ✅ Install dependencies: `npm install`
2. ✅ Configure Auth0 (see main README)
3. ✅ Start the server: `npm run dev`
4. ✅ Test login and verify roles work
5. ✅ Access User Management module to modify permissions

## Support

If you encounter issues:
1. Check PostgreSQL logs
2. Verify `.env` configuration
3. Test database connection manually
4. Review server console for errors

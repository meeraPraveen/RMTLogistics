# Auth0 RBAC Application - RMT Logistics

A comprehensive Role-Based Access Control (RBAC) system with Auth0 authentication, featuring user management, order tracking, and fine-grained permissions.

## 🔐 Security Architecture: Database as Source of Truth

**PostgreSQL is the single source of truth** - All roles and permissions are managed in your database.
**Auth0 provides authentication** - Handles login, session management, and security.
**Application UI manages everything** - Create users, assign roles, update permissions - all through the web interface.

### How It Works:

```
┌─────────────────────────────────────────────────────────────┐
│  1. Admin creates user in UI → Stored in PostgreSQL         │
│  2. System syncs user to Auth0 → User can now login         │
│  3. User logs in → Auth0 authenticates                       │
│  4. Auth0 Action reads role from app_metadata → Adds to token│
│  5. Backend validates token → Checks permissions from DB     │
└─────────────────────────────────────────────────────────────┘
```

**Key Principle:** PostgreSQL database controls WHO can access WHAT. Auth0 only handles authentication.

## Features

### Core Modules
- **User Management** - Create users, assign roles, manage permissions
- **Order Management** - Track and manage customer orders with status workflow
- **Company Management** - Manage client companies and contacts
- **Role Permissions** - Configure granular permissions per role and module
- **Dashboard** - Overview of orders, stats, and quick actions

### Roles & Default Permissions

| Role | User Management | Order Management | Company Management | Inventory | Printing | System Config |
|------|----------------|------------------|--------------------|-----------|----------|--------------|
| **SuperAdmin** | Full Access | Full Access | Full Access | Full Access | Full Access | Full Access |
| **Admin** | Create/Edit Users | Full Access | Full Access | Full Access | Full Access | - |
| **Lead Artist** | - | Read, Write, Update | Read | - | - | - |
| **Artist** | - | Read | Read | - | - | - |
| **Production Tech** | - | Read | Read | - | Read, Write, Update | - |

### Permission Types
- **Read** - View data
- **Write** - Create new records
- **Update** - Modify existing records
- **Delete** - Remove records

## Architecture

### Tech Stack
- **Backend**: Node.js + Express
- **Frontend**: React + Vite
- **Database**: PostgreSQL
- **Authentication**: Auth0 (OAuth 2.0 / OpenID Connect)
- **Authorization**: Custom RBAC with database-driven permissions

### Database-Driven Authorization Flow

```
User Management UI
       ↓
  PostgreSQL (Source of Truth)
       ↓
  Auth0 app_metadata (Sync)
       ↓
  ID Token (Custom Claim)
       ↓
  Backend Middleware (Validation)
       ↓
  Module Access (Granted/Denied)
```

### Backend Structure
```
server/
├── config/
│   ├── database.js              # PostgreSQL connection
│   └── rbac.config.js           # Role-permission mappings
├── middleware/
│   ├── auth.middleware.js       # Auth0 ID token validation
│   └── rbac.middleware.js       # Permission checking
├── services/
│   ├── user.service.js          # User CRUD + Auth0 sync
│   ├── auth0.service.js         # Auth0 Management API
│   ├── permissions.service.js   # Permission queries
│   └── order.service.js         # Order management
├── routes/
│   ├── users.routes.js          # User management API
│   ├── permissions.routes.js    # Permission management API
│   ├── orders.routes.js         # Order management API
│   └── companies.routes.js      # Company management API
└── index.js                     # Express server
```

### Frontend Structure
```
client/src/
├── components/
│   ├── Layout.jsx               # Main layout with sidebar
│   ├── ProtectedRoute.jsx       # Route protection
│   ├── UserModal.jsx            # User create/edit modal
│   └── RoleMismatchAlert.jsx    # Detects DB/Auth0 role sync issues
├── hooks/
│   └── usePermissions.js        # Permission checking hook
├── pages/
│   ├── Dashboard.jsx            # Overview with stats
│   ├── UserManagement.jsx       # User CRUD + role assignment
│   ├── RolePermissions.jsx      # Configure role permissions
│   ├── OrderManagement.jsx      # Order tracking
│   └── CompanyManagement.jsx    # Client management
└── utils/
    └── api.js                   # API client with Auth0 integration
```

## Setup Instructions

### Prerequisites
- Node.js (v18 or higher)
- PostgreSQL (v15 or higher)
- Auth0 account (free tier works)
- npm or yarn

### 1. Clone and Install

```bash
git clone https://github.com/meeraPraveen/RMTLogistics.git
cd RMTLogistics

# Install backend dependencies
npm install

# Install frontend dependencies
cd client
npm install
cd ..
```

### 2. PostgreSQL Database Setup

**User roles and permissions are stored in PostgreSQL.**

See detailed instructions in [DATABASE_SETUP.md](DATABASE_SETUP.md)

Quick setup:
```bash
# 1. Create database
psql -U postgres
CREATE DATABASE auth_rbac_db;
\q

# 2. Run migrations
npm run db:setup  # Creates tables
npm run db:seed   # Inserts default permissions

# 3. Configure environment
cp .env.example .env
# Edit .env with your database credentials
```

**Database Schema:**
- `users` - User accounts with roles (source of truth)
- `role_permissions` - Permission mappings per role and module
- `orders` - Order management data
- `companies` - Client companies
- `audit_log` - Tracks all user actions

### 3. Auth0 Configuration

**Two-part setup required:**

#### Part 1: Create Auth0 Application

1. Go to [Auth0 Dashboard](https://manage.auth0.com/)
2. Create a new **Single Page Application**
3. Note your **Domain** and **Client ID**
4. In **Settings** > **Application URIs**:
   - **Allowed Callback URLs**: `http://localhost:3000`
   - **Allowed Logout URLs**: `http://localhost:3000`
   - **Allowed Web Origins**: `http://localhost:3000`

#### Part 2: Create Auth0 Management API Application

For user sync to work, you need Management API credentials:

1. Go to **Applications** > **Applications**
2. Create new **Machine to Machine Application**
3. Name: "RMT Logistics Management"
4. Authorize for **Auth0 Management API**
5. Grant permissions:
   - `read:users`
   - `update:users`
   - `create:users`
   - `delete:users`
   - `update:users_app_metadata`
   - `create:user_tickets`
6. Note the **Client ID** and **Client Secret**

#### Part 3: Create Auth0 Action (Required)

This Action adds the user's role from `app_metadata` to the ID token:

1. Go to **Actions** > **Library**
2. Click **+ Create Action**
3. Choose **Login / Post Login**
4. Name: `Add Role To Token`
5. Copy the code from [`auth0-action-add-role-to-token.js`](auth0-action-add-role-to-token.js)
6. Click **Deploy** (top right)
7. Go to **Actions** > **Flows** > **Login**
8. Drag "Add Role To Token" from Custom tab to the flow (between Start and Complete)
9. Click **Apply**

**What this Action does:**
- Reads `user.app_metadata.role` (synced from PostgreSQL)
- Adds role as custom claim `app_role` to ID and access tokens
- No blocking - all authorization handled by your backend

### 4. Environment Setup

#### Backend Configuration
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=auth_rbac_db
DB_USER=postgres
DB_PASSWORD=your_password

# Auth0 SPA (for token validation)
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your-spa-client-id
AUTH0_AUDIENCE=https://your-tenant.auth0.com/api/v2/

# Auth0 Management API (for user sync)
AUTH0_MGMT_DOMAIN=your-tenant.auth0.com
AUTH0_MGMT_CLIENT_ID=your-m2m-client-id
AUTH0_MGMT_CLIENT_SECRET=your-m2m-client-secret

# Server
PORT=3001
NODE_ENV=development
```

#### Frontend Configuration
```bash
cd client
cp .env.example .env
```

Edit `client/.env`:
```env
VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=your-spa-client-id
VITE_AUTH0_AUDIENCE=https://your-tenant.auth0.com/api/v2/
VITE_API_URL=http://localhost:3001
```

### 5. Create Your First User

After database setup, create your SuperAdmin account:

```bash
# Option 1: Via script
node scripts/add-user.js your-email@example.com "Your Name" SuperAdmin

# Option 2: Via SQL
psql -U postgres -d auth_rbac_db
INSERT INTO users (email, name, role, is_active, auth0_user_id)
VALUES ('your-email@example.com', 'Your Name', 'SuperAdmin', true, 'pending_your-email@example.com');
```

The user will be synced to Auth0 when you first run the application.

### 6. Running the Application

#### Option 1: Run Both Servers Concurrently (Recommended)
```bash
npm run dev:all
```

#### Option 2: Run Separately
Terminal 1 - Backend:
```bash
npm run dev
```

Terminal 2 - Frontend:
```bash
cd client
npm run dev
```

### 7. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **API Documentation**: http://localhost:3001/api

**First Login:**
1. Go to http://localhost:3000
2. Click "Login"
3. Sign up with the email you added to the database
4. You'll be logged in as SuperAdmin

## User Management Workflow

### Creating a New User (via UI)

1. Login as Admin or SuperAdmin
2. Navigate to **User Management**
3. Click **+ Add User**
4. Fill in details:
   - Email (required)
   - Name (required)
   - Role (required)
   - Status (Active/Inactive)
5. Click **Save**

**What happens behind the scenes:**
1. User created in PostgreSQL with role
2. User automatically synced to Auth0
3. Auth0 sends invitation email
4. User can login immediately
5. Role is available in their token

### Updating User Roles (via UI)

1. Navigate to **User Management**
2. Click **Edit** on any user
3. Change the role from dropdown
4. Click **Save**

**What happens behind the scenes:**
1. Role updated in PostgreSQL (source of truth)
2. Role synced to Auth0 `app_metadata.role`
3. Next login, new role is in token
4. User sees updated permissions immediately

### Role Mismatch Detection

The UI automatically detects when PostgreSQL and Auth0 roles are out of sync:
- **Yellow badge** appears if roles don't match
- **Sync button** to manually fix discrepancies
- **Auto-sync** happens on every role update

## Managing Permissions

### Via UI (Recommended)

1. Login as SuperAdmin
2. Navigate to **User Management** > **Role Permissions** tab
3. Select a role from dropdown
4. Toggle modules on/off
5. Select specific permissions (Read/Write/Update/Delete)
6. Click **Save Changes**

Changes take effect immediately - no restart needed.

### Via Database

```sql
-- View current permissions
SELECT * FROM role_permissions WHERE role = 'Artist';

-- Update permissions
UPDATE role_permissions
SET permissions = '["read", "write"]'::jsonb
WHERE role = 'Artist' AND module = 'order_management';
```

## API Endpoints

### User Management
- `GET /api/users` - List all users (Admin+)
- `POST /api/users` - Create user (Admin+)
- `PUT /api/users/:id` - Update user (Admin+)
- `DELETE /api/users/:id` - Delete user (SuperAdmin only)

### Permission Management
- `GET /api/permissions` - Get all role permissions
- `GET /api/permissions/:role` - Get specific role permissions
- `PUT /api/permissions/:role` - Update role permissions (SuperAdmin only)
- `GET /api/permissions/user/me` - Get current user permissions

### Order Management
- `GET /api/orders` - List orders
- `POST /api/orders` - Create order
- `PUT /api/orders/:id` - Update order
- `DELETE /api/orders/:id` - Delete order
- `POST /api/orders/:id/upload` - Upload artwork files

### Company Management
- `GET /api/companies` - List companies
- `POST /api/companies` - Create company
- `PUT /api/companies/:id` - Update company
- `DELETE /api/companies/:id` - Delete company

## Key Features

### 1. Database as Source of Truth
- All user roles stored in PostgreSQL
- Auth0 syncs from database (not the other way around)
- Changes via UI immediately update both DB and Auth0

### 2. Automatic Auth0 Sync
- Creating user → Syncs to Auth0 automatically
- Updating role → Syncs to Auth0 app_metadata
- Deleting user → Blocks in Auth0 (preserves audit trail)

### 3. Role Mismatch Detection
- Compares DB role vs Auth0 role
- Alerts admin if out of sync
- One-click manual sync available

### 4. Granular Permissions
- Per-module permission control
- Per-role permission configuration
- CRUD-level permission granularity

### 5. Order Status Workflow
```
Pending → Processing → Ready to Print → In Progress → Completed → Shipped
```

## Troubleshooting

### Role Shows "Loading" in UI

**Cause:** Token doesn't have `app_role` claim - usually due to Auth0 stripping non-namespaced custom claims

**Solution:**
1. Update Auth0 Action to use **namespaced claims** (`https://dev-ybc7o1rzmlt6fu4c.ca.auth0.com/app_role`)
2. Deploy the updated Action
3. User must logout completely and login again
4. Check Auth0 logs for Action execution

See:
- [TROUBLESHOOTING_TOKEN_CLAIMS.md](TROUBLESHOOTING_TOKEN_CLAIMS.md) - **Token/claims issues** ⭐ Start here
- [TROUBLESHOOTING_LOADING_ROLE.md](TROUBLESHOOTING_LOADING_ROLE.md) - General loading issues

### Role Not Syncing to Auth0

**Cause:** Role updated directly in database, bypassing API

**Solution:**
```bash
# Force sync role from DB to Auth0
node scripts/force-sync-role.js user@example.com
```

### User Can't Login - "Not Authorized"

**Cause:** Auth0 Action is blocking user (old configuration)

**Solution:** Auth0 Action should NOT block users. Update to the minimal version in `auth0-action-add-role-to-token.js`

### "Access Denied" / "Forbidden" Errors

**Cause:** User role doesn't have permission for that module

**Solution:**
1. Go to User Management > Role Permissions
2. Select the user's role
3. Enable the module
4. Grant required permissions (Read/Write/Update/Delete)
5. Save changes

## Testing & Verification

### Verify Role Sync
```bash
# Check user in database
node scripts/check-db-user.js user@example.com

# Check user in Auth0
node scripts/check-auth0-user.js user@example.com

# Test role update sync
node scripts/test-role-sync.js user@example.com
```

### Manual Sync (if needed)
```bash
# Force sync a single user
node scripts/force-sync-role.js user@example.com

# Sync all users
node scripts/sync-all-users.js
```

## Production Deployment

1. **Environment Variables**
   - Set `NODE_ENV=production`
   - Use production Auth0 tenant
   - Configure production database

2. **Auth0 Configuration**
   - Update Allowed URLs to production domain
   - Enable MFA (Multi-Factor Authentication)
   - Configure proper logout redirect

3. **Database**
   - Enable SSL connections
   - Set up backups
   - Configure connection pooling

4. **Security**
   - Enable HTTPS
   - Set secure cookie settings
   - Configure CORS properly
   - Enable rate limiting

5. **Monitoring**
   - Set up error logging
   - Monitor Auth0 logs
   - Track API performance

## Documentation

- [START_HERE.md](START_HERE.md) - Quick start guide
- [DATABASE_SETUP.md](DATABASE_SETUP.md) - Database configuration
- [AUTH0_SETUP_GUIDE.md](AUTH0_SETUP_GUIDE.md) - Auth0 configuration details
- [SECURITY_MODEL.md](SECURITY_MODEL.md) - Security architecture
- [PERMISSION_SYNC_GUIDE.md](PERMISSION_SYNC_GUIDE.md) - **Permission sync to Auth0** 🆕
- [CHANGELOG.md](CHANGELOG.md) - Change history

### Troubleshooting Guides
- [TROUBLESHOOTING_TOKEN_CLAIMS.md](TROUBLESHOOTING_TOKEN_CLAIMS.md) - **Role not in token / "Loading" issue** ⭐
- [TROUBLESHOOTING_LOADING_ROLE.md](TROUBLESHOOTING_LOADING_ROLE.md) - General role loading issues
- [HOW_TO_FIX_AUTH0_ACTION.md](HOW_TO_FIX_AUTH0_ACTION.md) - Auth0 Action setup & debugging

## Scripts

```bash
# Database
npm run db:setup      # Create tables
npm run db:seed       # Insert default permissions
npm run db:reset      # Drop and recreate all tables

# Development
npm run dev           # Start backend only
npm run client        # Start frontend only
npm run dev:all       # Start both concurrently

# Testing
npm run test          # Run tests
npm run test:auth     # Test Auth0 connection
npm run test:db       # Test database connection

# User Management
node scripts/add-user.js <email> <name> <role>
node scripts/check-db-user.js <email>
node scripts/check-auth0-user.js <email>
node scripts/force-sync-role.js <email>
```

## License

MIT

## Support

For issues and questions:
- Create an issue: https://github.com/meeraPraveen/RMTLogistics/issues
- Check documentation in the `/docs` folder
- Review troubleshooting guides

---

**Built with:** Node.js • React • PostgreSQL • Auth0
**Architecture:** Database-driven RBAC with Auth0 authentication

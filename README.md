# Auth0 RBAC Application (Auth0 as Gatekeeper)

A comprehensive Role-Based Access Control (RBAC) system with Auth0 authentication, featuring multiple modules with fine-grained permissions.

## 🔐 Security Model: Auth0 as Gatekeeper

**Auth0 blocks unauthorized users** - Only users you create in Auth0 can login (no API needed).
**PostgreSQL stores roles** - Your database controls what users can do after they login.

### How It Works:
1. **Admin creates user in Auth0** → User can login
2. **Admin creates user in PostgreSQL** → User gets role and permissions
3. **User logs in** → Auth0 authenticates, your app checks permissions
4. **Unauthorized users** → Blocked by Auth0 before reaching your app

**No Auth0 API, no external calls during login, full control over permissions.**

## Features

### Modules
- **User Management** - Manage roles and permissions (SuperAdmin only)
- **Order Management** - Track and manage customer orders
- **Inventory Management** - Monitor stock levels and inventory
- **Printing Software** - Manage print jobs and printer queue
- **System Configuration** - Application settings and integrations

### Roles & Default Permissions

| Role | User Management | Order Management | Inventory | Printing | System Config |
|------|----------------|-----------------|-----------|----------|--------------|
| **SuperAdmin** | Full Access | Full Access | Full Access | Full Access | Full Access |
| **Admin** | - | Full Access | Full Access | Full Access | - |
| **Lead Artist** | - | Read, Write, Update | - | - | - |
| **Artist** | - | - | - | - | - |
| **Production Tech** | - | - | - | Read, Write, Update | - |

### Permission Types
- **Read** - View data
- **Write** - Create new records
- **Update** - Modify existing records
- **Delete** - Remove records

## Architecture

### Backend (Node.js + Express)
```
server/
├── config/
│   └── rbac.config.js         # Role-permission mappings
├── middleware/
│   ├── auth.middleware.js     # Auth0 ID token validation
│   └── rbac.middleware.js     # Permission checking
├── routes/
│   ├── permissions.routes.js  # Permission management API
│   └── modules.routes.js      # Module-specific routes
└── index.js                   # Express server
```

### Frontend (React + Auth0)
```
client/src/
├── components/
│   ├── Layout.jsx             # Main layout with sidebar
│   └── ProtectedRoute.jsx     # Route protection
├── hooks/
│   └── usePermissions.js      # Permission checking hook
├── pages/
│   ├── Dashboard.jsx          # Overview of accessible modules
│   ├── UserManagement.jsx     # Edit role permissions
│   ├── OrderManagement.jsx    # Orders module
│   ├── InventoryManagement.jsx# Inventory module
│   ├── PrintingSoftware.jsx   # Printing module
│   └── SystemConfig.jsx       # Configuration module
└── utils/
    └── api.js                 # API client
```

## Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- Auth0 account (free tier works)
- npm or yarn

### 1. PostgreSQL Database Setup

**User roles are stored in PostgreSQL, not Auth0.**

See detailed instructions in [DATABASE_SETUP.md](DATABASE_SETUP.md)

Quick setup:
```bash
# 1. Install PostgreSQL (if not already installed)
# Windows: Download from postgresql.org
# Mac: brew install postgresql@15
# Linux: sudo apt install postgresql

# 2. Create database
psql -U postgres
CREATE DATABASE auth0_rbac;
\q

# 3. Run migrations
npm install
npm run db:setup  # Creates tables
npm run db:seed   # Inserts default permissions

# 4. Configure environment
cp .env.example .env
# Edit .env with your database credentials
```

### 2. Auth0 Configuration

**Simple setup - No Actions or custom claims needed!**

1. Go to [Auth0 Dashboard](https://manage.auth0.com/)
2. Create a new **Single Page Application**
3. Note your **Domain** and **Client ID**
4. In **Settings** > **Application URIs**:
   - **Allowed Callback URLs**: `http://localhost:3000`
   - **Allowed Logout URLs**: `http://localhost:3000`
   - **Allowed Web Origins**: `http://localhost:3000`

**That's it for Auth0!** No Actions, no metadata, no custom claims.

### 3. Add Your User to Database

After you create your Auth0 account and log in for the first time:

1. **Get your Auth0 User ID:**
   - Log into [Auth0 Dashboard](https://manage.auth0.com/)
   - Go to **User Management** > **Users**
   - Click on your user
   - Copy the **User ID** (e.g., `auth0|63f8d7b3a1b2c3d4e5f6g7h8`)

2. **Add yourself to the database:**
```sql
-- Connect to database
psql -U postgres -d auth0_rbac

-- Insert your user with SuperAdmin role
INSERT INTO users (auth0_user_id, email, role)
VALUES ('auth0|YOUR_ACTUAL_ID_HERE', 'your-email@example.com', 'SuperAdmin');

-- Verify
SELECT * FROM users;
\q
```

### 4. Environment Setup

#### Backend Configuration
1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your Auth0 credentials:
   ```env
   AUTH0_DOMAIN=your-tenant.auth0.com
   AUTH0_CLIENT_ID=your-client-id
   PORT=3001
   NODE_ENV=development
   ```

#### Frontend Configuration
1. Copy the environment template:
   ```bash
   cd client
   cp .env.example .env
   ```

2. Edit `client/.env` with your Auth0 credentials:
   ```env
   VITE_AUTH0_DOMAIN=your-tenant.auth0.com
   VITE_AUTH0_CLIENT_ID=your-client-id
   VITE_API_URL=http://localhost:3001
   ```

### 3. Installation

#### Install Backend Dependencies
```bash
npm install
```

#### Install Frontend Dependencies
```bash
cd client
npm install
```

### 4. Running the Application

#### Option 1: Run Both Servers Concurrently
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

### 5. Access the Application
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- API Documentation: http://localhost:3001/api

## Development Mode

For testing without Auth0 configured, the backend uses mock authentication in development mode. This creates a mock SuperAdmin user automatically.

To disable mock auth and use real Auth0:
1. Configure Auth0 properly (see Auth0 Configuration above)
2. Ensure `.env` files are properly configured
3. The app will automatically use Auth0 when you login

## API Endpoints

### Permission Management
- `GET /api/permissions` - Get all role permissions
- `GET /api/permissions/:role` - Get specific role permissions
- `PUT /api/permissions/:role` - Update role permissions
- `POST /api/permissions/reset` - Reset to default permissions
- `GET /api/permissions/user/me` - Get current user permissions

### Module Routes
All module routes follow this pattern: `/api/modules/{module-name}`

Example:
- `GET /api/modules/order-management/orders`
- `POST /api/modules/order-management/orders`
- `PUT /api/modules/order-management/orders/:id`
- `DELETE /api/modules/order-management/orders/:id`

## User Management Features

The User Management module allows SuperAdmin to:
1. View all role-permission mappings
2. Edit permissions for each role
3. Toggle module access for roles
4. Fine-tune CRUD permissions per module
5. Reset all permissions to defaults

### How to Use:
1. Login with SuperAdmin credentials
2. Navigate to User Management
3. Select a role from the role selector
4. Toggle modules on/off
5. Select specific permissions (read, write, update, delete)
6. Click "Save Changes"

## Customization

### Adding New Modules
1. Add module constant in `server/config/rbac.config.js`
2. Create routes in `server/routes/modules.routes.js`
3. Create frontend page component
4. Add route in `client/src/App.jsx`
5. Add navigation link in `client/src/components/Layout.jsx`

### Adding New Roles
1. Add role constant in `server/config/rbac.config.js`
2. Add default permissions for the role
3. Update Auth0 user metadata to assign the role to users

### Modifying Default Permissions
Edit the `rolePermissions` object in `server/config/rbac.config.js`

## Database Integration

Currently, permissions are stored in-memory. To persist to a database:

1. Create a database schema:
```sql
CREATE TABLE role_permissions (
  id SERIAL PRIMARY KEY,
  role VARCHAR(50) NOT NULL,
  module VARCHAR(50) NOT NULL,
  permissions JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

2. Update `server/config/rbac.config.js`:
   - Replace in-memory storage with database queries
   - Implement `getRolePermissions()` to fetch from DB
   - Implement `updateRolePermissions()` to save to DB

## Key Differences from Auth0 API Approach

This implementation **does not use Auth0 APIs**:

✅ **What we use:**
- Auth0 SPA authentication (login/logout)
- ID tokens with custom claims (user role)
- Your own backend for RBAC logic

❌ **What we don't use:**
- Auth0 Management API
- Auth0 Authorization Extension
- Access tokens with audience
- Auth0-managed permissions

**Benefits:**
- Simpler setup - no API configuration needed
- Full control over permissions in your backend
- Easier to customize and extend
- No additional Auth0 costs for API usage

## Security Considerations

1. **ID Token Validation**: Backend validates Auth0 ID tokens
2. **RBAC Middleware**: Every module route checks permissions
3. **Principle of Least Privilege**: Roles have minimal required permissions
4. **SuperAdmin Protection**: Critical operations require SuperAdmin role
5. **HTTPS**: Use HTTPS in production
6. **Environment Variables**: Never commit `.env` files

## Troubleshooting

### "Unauthorized" errors
- Check Auth0 configuration matches `.env` files
- Verify ID token is being sent with requests
- Check browser console for Auth0 errors
- Ensure Auth0 Action is deployed and added to Login flow

### "Forbidden" / "Access Denied"
- User role doesn't have permission for that module
- Use User Management to grant permissions
- Check role is correctly set in Auth0 user metadata
- Verify Auth0 Action is adding role to ID token

### Mock authentication not working
- Ensure `NODE_ENV=development` in `.env`
- Check console logs for "Using mock authentication" message

### Role not showing in token
- Verify Auth0 Action is deployed
- Check Action is in the Login flow
- Ensure user has `app_metadata.role` set
- Check namespace in Action matches backend code

## Production Deployment

1. Set `NODE_ENV=production`
2. Configure real Auth0 credentials
3. Use environment variables for sensitive data
4. Enable HTTPS
5. Use a production database for permissions
6. Set up proper logging and monitoring
7. Configure Auth0 for production domains

## License

MIT

## Support

For issues and questions, please create an issue in the repository.

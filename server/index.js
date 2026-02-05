import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkJwt, extractUserInfo, mockAuth } from './middleware/auth.middleware.js';
import permissionsRouter from './routes/permissions.routes.js';
import modulesRouter from './routes/modules.routes.js';
import usersRouter from './routes/users.routes.js';
import ordersRouter from './routes/orders.routes.js';
import companiesRouter from './routes/companies.routes.js';
import inventoryRouter from './routes/inventory.routes.js';
import adminRouter from './routes/admin.routes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Auth0 RBAC API Server is running',
    timestamp: new Date().toISOString()
  });
});

// Auth0 JWT validation middleware
// checkJwt processes Bearer tokens, mockAuth provides fallback for requests without tokens
app.use(checkJwt);
app.use(extractUserInfo);

// In development mode, use mock auth as fallback when no token is present
if (process.env.NODE_ENV === 'development') {
  app.use(mockAuth);
}

// Serve uploaded files (protected - requires authentication)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/permissions', permissionsRouter);
app.use('/api/users', usersRouter);
app.use('/api/modules', modulesRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/companies', companiesRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/admin', adminRouter);

// Welcome endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'Auth0 RBAC API',
    version: '1.0.0',
    user: req.user ? {
      email: req.user.email,
      role: req.user.role
    } : null,
    endpoints: {
      permissions: '/api/permissions',
      users: '/api/users',
      admin: '/api/admin',
      userManagement: '/api/modules/user-management',
      orderManagement: '/api/modules/order-management',
      inventoryManagement: '/api/modules/inventory-management',
      printingSoftware: '/api/modules/printing-software',
      systemConfig: '/api/modules/system-config'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing authentication token'
    });
  }

  res.status(err.status || 500).json({
    error: err.name || 'Internal Server Error',
    message: err.message || 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api`);
  console.log(`🔐 Auth Mode: ${process.env.NODE_ENV === 'development' ? 'Mock (Development)' : 'Auth0 JWT'}\n`);
});

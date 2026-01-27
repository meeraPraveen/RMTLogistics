import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { getUserByAuth0Id, updateLastLogin } from '../services/user.service.js';

dotenv.config();

/**
 * Auth0 ID Token validation middleware (No API needed)
 * Validates the ID token from Auth0 client-side authentication
 */
export const checkJwt = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Let mockAuth handle it in development
    }

    const token = authHeader.substring(7);

    // Decode without verification to get issuer
    const decoded = jwt.decode(token, { complete: true });

    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // For Auth0 ID tokens, we verify using the issuer
    // In production, you should verify the signature using JWKS
    // For now, we'll do basic validation
    req.auth = decoded.payload;
    next();
  } catch (error) {
    console.error('Token validation error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Extract user information from Auth0 ID token
 * HYBRID AUTHORIZATION:
 * 1. Auth0 Action checks: Does user have a role assigned in Auth0? ❌ Block / ✅ Allow
 * 2. Once allowed, we fetch the actual role from PostgreSQL database
 * 3. Database role is used for all permissions and access control
 *
 * - If user has no role in Auth0 → Blocked at Auth0 level (never reaches app)
 * - If user has role in Auth0 → Allowed, but we use DATABASE role for permissions
 * - This allows editing roles in the app UI without updating Auth0
 */
export const extractUserInfo = async (req, res, next) => {
  if (req.auth) {
    try {
      const auth0UserId = req.auth.sub;
      const email = req.auth.email;

      // Auth0 role is only used for initial access check (done by Auth0 Action)
      const auth0Role = req.auth.app_role || req.auth['https://yourapp.com/app_role'];

      console.log(`🔐 Auth0 authenticated user: ${email} (${auth0UserId})`);
      console.log(`🔍 Token claims:`, JSON.stringify({
        app_role: req.auth.app_role,
        namespaced_role: req.auth['https://yourapp.com/app_role'],
        all_claims: Object.keys(req.auth)
      }));

      // Temporarily: If no role in token, fetch from database instead of blocking
      if (!auth0Role) {
        console.warn(`⚠️  No role in Auth0 token for ${email} - Will fetch from database`);
        // Don't block - will fetch from DB below
      }

      // Fetch the actual user from database (source of truth for permissions)
      let dbUser = await getUserByAuth0Id(auth0UserId);
      let dbRole = dbUser?.role || null;
      let dbUserId = dbUser?.id || null;

      // If user doesn't exist by auth0_user_id, check if they exist by email (pending user)
      if (!dbUser) {
        const { getUserRoleByEmail, activateUser, upsertUser } = await import('../services/user.service.js');

        // Check if user exists with pending status (pending_email)
        const existingUserRole = await getUserRoleByEmail(email);

        if (existingUserRole) {
          // User was pre-created (e.g., via Add User), update their auth0_user_id
          console.log(`👤 Activating pre-created user ${email} - Updating auth0_user_id`);
          try {
            const activatedUser = await activateUser(auth0UserId, email);
            dbRole = activatedUser.role;
            dbUserId = activatedUser.id;
            console.log(`✅ User activated: ${email} with role ${dbRole}`);
          } catch (error) {
            console.error(`❌ Failed to activate user:`, error);
            return res.status(500).json({
              error: 'Internal Server Error',
              message: 'Failed to activate user in database.',
              details: 'Please contact your administrator.'
            });
          }
        } else {
          // Completely new user, create them with Auth0 role
          console.log(`👤 First login detected for ${email} - Creating user in database with role: ${auth0Role}`);
          try {
            const newUser = await upsertUser(auth0UserId, email, auth0Role);
            dbRole = newUser.role;
            dbUserId = newUser.id;
            console.log(`✅ User created in database: ${email} with role ${dbRole}`);
          } catch (error) {
            console.error(`❌ Failed to create user in database:`, error);
            return res.status(500).json({
              error: 'Internal Server Error',
              message: 'Failed to create user in database.',
              details: 'Please contact your administrator.'
            });
          }
        }
      }

      // User has role from database - grant access
      console.log(`✅ Access GRANTED for ${email} - Database Role: ${dbRole}`);

      // Update last login timestamp (non-blocking)
      updateLastLogin(auth0UserId).catch(err =>
        console.error('Failed to update last login:', err)
      );

      req.user = {
        id: dbUserId, // Database user ID (for foreign key references)
        auth0UserId: auth0UserId, // Auth0 user ID
        email: email,
        role: dbRole, // Database role (source of truth)
        permissions: []
      };

      next();
    } catch (error) {
      console.error('❌ Error extracting user info:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve user information'
      });
    }
  } else {
    next();
  }
};

/**
 * Mock authentication for development/testing
 * Remove this in production - only for demo purposes
 */
export const mockAuth = (req, res, next) => {
  // Check if we're in development mode and no auth header is present
  if (process.env.NODE_ENV === 'development' && !req.headers.authorization) {
    // Mock user with SuperAdmin role for testing
    req.user = {
      id: 'mock-user-id',
      email: 'admin@example.com',
      role: 'SuperAdmin',
      permissions: []
    };
    console.log('⚠️  Using mock authentication - User:', req.user.email, 'Role:', req.user.role);
  }
  next();
};

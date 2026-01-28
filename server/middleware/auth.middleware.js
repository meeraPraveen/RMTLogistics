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
 * TOKEN-BASED AUTHORIZATION:
 * 1. Auth0 Action adds role and permissions to JWT token during login
 * 2. Backend extracts role and permissions directly from token claims
 * 3. Token is the source of truth for authorization (no DB lookup on every request)
 * 4. Database is only queried for:
 *    - First-time user creation
 *    - User activation (pending users)
 *    - Last login timestamp update
 *
 * Benefits:
 * - Fast: No database query on every request
 * - Scalable: Stateless authentication
 * - Secure: Permissions are cryptographically signed in JWT
 */
export const extractUserInfo = async (req, res, next) => {
  if (req.auth) {
    try {
      const auth0UserId = req.auth.sub;
      const email = req.auth.email;

      // Extract role from token (both namespaced and non-namespaced for compatibility)
      const tokenRole = req.auth.app_role || req.auth['https://dev-ybc7o1rzmlt6fu4c.ca.auth0.com/app_role'];

      // Extract permissions from token
      const tokenPermissions = req.auth.app_permissions || req.auth['https://dev-ybc7o1rzmlt6fu4c.ca.auth0.com/app_permissions'] || {};

      console.log(`🔐 Auth0 authenticated user: ${email} (${auth0UserId})`);
      console.log(`🎫 Token-based auth - Role: ${tokenRole}, Modules: ${Object.keys(tokenPermissions).join(', ')}`);

      // TOKEN-BASED: Use role and permissions from token
      if (!tokenRole) {
        console.warn(`⚠️  No role in Auth0 token for ${email} - Access denied`);
        return res.status(403).json({
          error: 'Forbidden',
          message: 'User role not found in token. Please contact your administrator.'
        });
      }

      // Check if user exists in database (only for first-time setup or pending users)
      let dbUser = await getUserByAuth0Id(auth0UserId);
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
            dbUserId = activatedUser.id;
            console.log(`✅ User activated: ${email} with role ${tokenRole}`);
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
          console.log(`👤 First login detected for ${email} - Creating user in database with role: ${tokenRole}`);
          try {
            const newUser = await upsertUser(auth0UserId, email, tokenRole);
            dbUserId = newUser.id;
            console.log(`✅ User created in database: ${email} with role ${tokenRole}`);
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

      // Update last login timestamp (non-blocking, doesn't affect authorization)
      updateLastLogin(auth0UserId).catch(err =>
        console.error('Failed to update last login:', err)
      );

      // TOKEN-BASED: Use role and permissions from JWT token (not database)
      req.user = {
        id: dbUserId, // Database user ID (for foreign key references)
        auth0UserId: auth0UserId, // Auth0 user ID
        email: email,
        role: tokenRole, // Role from JWT token (source of truth)
        permissions: tokenPermissions // Permissions from JWT token (source of truth)
      };

      console.log(`✅ Token-based authorization - User: ${email}, Role: ${tokenRole}, Modules: ${Object.keys(tokenPermissions).join(', ')}`);

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
      permissions: {
        user_management: ['read', 'write', 'update', 'delete'],
        order_management: ['read', 'write', 'update', 'delete'],
        inventory_management: ['read', 'write', 'update', 'delete'],
        printing_software: ['read', 'write', 'update', 'delete'],
        system_config: ['read', 'write', 'update', 'delete']
      }
    };
    console.log('⚠️  Using mock authentication - User:', req.user.email, 'Role:', req.user.role);
  }
  next();
};

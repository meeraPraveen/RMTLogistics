import { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { permissionsApi, setAuthToken } from '../utils/api';

export const usePermissions = () => {
  const { getIdTokenClaims, isAuthenticated } = useAuth0();
  const [permissions, setPermissions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState(null);

  useEffect(() => {
    const fetchPermissions = async () => {
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }

      try {
        // Get ID token instead of access token (no API needed)
        const idToken = await getIdTokenClaims();
        const token = idToken.__raw;
        setAuthToken(token);

        // Extract role and permissions immediately from token claims so the UI
        // doesn't show "Loading..." and access isn't denied while waiting for API
        const tokenRole = idToken.app_role ||
          idToken['https://dev-ybc7o1rzmlt6fu4c.ca.auth0.com/app_role'];
        const tokenPermissions = idToken.app_permissions ||
          idToken['https://dev-ybc7o1rzmlt6fu4c.ca.auth0.com/app_permissions'] || {};

        if (tokenRole) {
          setPermissions({
            role: tokenRole,
            permissions: tokenPermissions,
            accessibleModules: Object.keys(tokenPermissions)
          });
        }

        const response = await permissionsApi.getCurrentUser();
        setPermissions(response.data.data);
        setError(null);
        setAccessDenied(false);
      } catch (err) {
        console.error('Failed to fetch permissions:', err);
        setError(err.message);

        // Check for 403 Forbidden - user has no role assigned in Auth0
        if (err.response?.status === 403) {
          setAccessDenied(true);
          setAccessDeniedMessage(err.response?.data?.message || 'Access denied. Your account has not been assigned a role.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [isAuthenticated, getIdTokenClaims]);

  const hasModuleAccess = (module) => {
    if (!permissions) return false;
    return permissions.accessibleModules?.includes(module) || false;
  };

  const hasPermission = (module, permission) => {
    if (!permissions?.permissions) return false;
    return permissions.permissions[module]?.includes(permission) || false;
  };

  const isSuperAdmin = () => {
    return permissions?.role === 'SuperAdmin';
  };

  return {
    permissions,
    loading,
    error,
    accessDenied,
    accessDeniedMessage,
    hasModuleAccess,
    hasPermission,
    isSuperAdmin
  };
};

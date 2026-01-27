import { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { permissionsApi, setAuthToken } from '../utils/api';

export const usePermissions = () => {
  const { getIdTokenClaims, isAuthenticated } = useAuth0();
  const [permissions, setPermissions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

        const response = await permissionsApi.getCurrentUser();
        setPermissions(response.data.data);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch permissions:', err);
        setError(err.message);
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
    hasModuleAccess,
    hasPermission,
    isSuperAdmin
  };
};

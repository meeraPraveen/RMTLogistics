import React, { useState, useEffect } from 'react';
import { permissionsApi, setAuthToken } from '../utils/api';
import { useAuth0 } from '@auth0/auth0-react';
import './RolePermissions.css';

const ROLES = ['SuperAdmin', 'Admin', 'Lead Artist', 'Artist', 'Production Tech'];

const MODULES = [
  { id: 'user-management', name: 'User Management' },
  { id: 'order-management', name: 'Order Management' },
  { id: 'inventory-management', name: 'Inventory Management' },
  { id: 'printing-software', name: 'Printing Software' },
  { id: 'system-config', name: 'System Configuration' }
];

const AVAILABLE_PERMISSIONS = ['read', 'create', 'update', 'delete', 'manage'];

const RolePermissions = () => {
  const { getIdTokenClaims } = useAuth0();
  const [selectedRole, setSelectedRole] = useState('Artist');
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadPermissions();
  }, [selectedRole]);

  const loadPermissions = async () => {
    try {
      const idToken = await getIdTokenClaims();
      setAuthToken(idToken.__raw);

      const response = await permissionsApi.getByRole(selectedRole);

      // Backend returns { role, permissions: { module: [perms] } }
      const permissionsData = response.data.data?.permissions || response.data.permissions || {};

      // Normalize: convert underscores to hyphens and map 'write' to 'create'
      const normalizedPermissions = {};
      Object.keys(permissionsData).forEach(module => {
        const normalizedModule = module.replace(/_/g, '-');
        const perms = permissionsData[module];
        normalizedPermissions[normalizedModule] = perms.map(p => p === 'write' ? 'create' : p);
      });

      setPermissions(normalizedPermissions);
      setLoading(false);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to load permissions:', error);
      setMessage({ type: 'error', text: 'Failed to load permissions' });
      setLoading(false);
    }
  };

  const togglePermission = (moduleId, permission) => {
    setPermissions(prev => {
      const modulePerms = prev[moduleId] || [];
      const hasPermission = modulePerms.includes(permission);

      return {
        ...prev,
        [moduleId]: hasPermission
          ? modulePerms.filter(p => p !== permission)
          : [...modulePerms, permission]
      };
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      const idToken = await getIdTokenClaims();
      setAuthToken(idToken.__raw);

      // Denormalize: convert hyphens to underscores and 'create' to 'write' for backend
      const backendPermissions = {};
      Object.keys(permissions).forEach(module => {
        const backendModule = module.replace(/-/g, '_');
        const perms = permissions[module];
        backendPermissions[backendModule] = perms.map(p => p === 'create' ? 'write' : p);
      });

      await permissionsApi.updateRole(selectedRole, backendPermissions);
      setMessage({ type: 'success', text: 'Permissions updated successfully!' });
      setHasChanges(false);

      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Failed to update permissions:', error);
      setMessage({ type: 'error', text: 'Failed to update permissions' });
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Are you sure you want to reset all permissions to default?')) {
      return;
    }

    try {
      const idToken = await getIdTokenClaims();
      setAuthToken(idToken.__raw);

      await permissionsApi.reset();
      setMessage({ type: 'success', text: 'Permissions reset to defaults!' });
      loadPermissions();

      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Failed to reset permissions:', error);
      setMessage({ type: 'error', text: 'Failed to reset permissions' });
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading permissions...</p>
      </div>
    );
  }

  return (
    <div className="role-permissions">
      <div className="page-header">
        <div>
          <h1>Role Permissions</h1>
          <p>Configure permissions for each role</p>
        </div>
        <div className="header-actions">
          <button
            className="reset-btn"
            onClick={handleReset}
          >
            Reset to Defaults
          </button>
          {hasChanges && (
            <button
              className="save-btn"
              onClick={handleSave}
            >
              Save Changes
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="role-selector">
        <label>Select Role:</label>
        <select
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
        >
          {ROLES.map(role => (
            <option key={role} value={role}>{role}</option>
          ))}
        </select>
      </div>

      <div className="permissions-grid">
        <table className="permissions-table">
          <thead>
            <tr>
              <th>Module</th>
              {AVAILABLE_PERMISSIONS.map(perm => (
                <th key={perm}>{perm.charAt(0).toUpperCase() + perm.slice(1)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULES.map(module => {
              const modulePerms = permissions[module.id] || [];
              return (
                <tr key={module.id}>
                  <td className="module-name">{module.name}</td>
                  {AVAILABLE_PERMISSIONS.map(perm => (
                    <td key={perm} className="permission-cell">
                      <input
                        type="checkbox"
                        checked={modulePerms.includes(perm)}
                        onChange={() => togglePermission(module.id, perm)}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RolePermissions;

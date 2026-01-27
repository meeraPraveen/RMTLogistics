import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { usePermissions } from '../hooks/usePermissions';
import './Dashboard.css';

const Dashboard = () => {
  const { user } = useAuth0();
  const { permissions, hasModuleAccess } = usePermissions();

  const modules = [
    { name: 'User Management', module: 'user_management', icon: '👥', color: '#6366f1' },
    { name: 'Order Management', module: 'order_management', icon: '📦', color: '#8b5cf6' },
    { name: 'Inventory Management', module: 'inventory_management', icon: '📊', color: '#ec4899' },
    { name: 'Printing Software', module: 'printing_software', icon: '🖨️', color: '#f59e0b' },
    { name: 'System Config', module: 'system_config', icon: '⚙️', color: '#10b981' }
  ];

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <p>Welcome back, {user?.email}</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#eef2ff', color: '#6366f1' }}>👤</div>
          <div className="stat-content">
            <p className="stat-label">Your Role</p>
            <p className="stat-value">{permissions?.role || 'Loading...'}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#f0fdf4', color: '#10b981' }}>✓</div>
          <div className="stat-content">
            <p className="stat-label">Accessible Modules</p>
            <p className="stat-value">{permissions?.accessibleModules?.length || 0}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fef3c7', color: '#f59e0b' }}>🔒</div>
          <div className="stat-content">
            <p className="stat-label">Access Level</p>
            <p className="stat-value">{permissions?.role === 'SuperAdmin' ? 'Full' : 'Limited'}</p>
          </div>
        </div>
      </div>

      <div className="modules-section">
        <h2>Your Modules</h2>
        <div className="modules-grid">
          {modules.map((module) => {
            const hasAccess = hasModuleAccess(module.module);
            return (
              <div
                key={module.module}
                className={`module-card ${hasAccess ? '' : 'locked'}`}
              >
                <div className="module-icon" style={{ background: hasAccess ? module.color : '#d1d5db' }}>
                  {module.icon}
                </div>
                <h3>{module.name}</h3>
                <p className="module-status">
                  {hasAccess ? (
                    <span className="status-badge granted">Access Granted</span>
                  ) : (
                    <span className="status-badge denied">No Access</span>
                  )}
                </p>
                {hasAccess && permissions?.permissions?.[module.module] && (
                  <div className="module-permissions">
                    {permissions.permissions[module.module].map((perm) => (
                      <span key={perm} className="permission-tag">{perm}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

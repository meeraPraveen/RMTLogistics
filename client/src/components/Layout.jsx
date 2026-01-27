import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { usePermissions } from '../hooks/usePermissions';
import './Layout.css';

const Layout = () => {
  const { user, logout, isAuthenticated } = useAuth0();
  const { permissions, hasModuleAccess, loading } = usePermissions();
  const navigate = useNavigate();

  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }

  // Auth0 Action now handles blocking users without roles
  // No need to check isAccessDenied here

  const modules = [
    { path: '/user-management', name: 'User Management', module: 'user_management' },
    { path: '/order-management', name: 'Order Management', module: 'order_management' },
    { path: '/inventory-management', name: 'Inventory', module: 'inventory_management' },
    { path: '/printing-software', name: 'Printing', module: 'printing_software' },
    { path: '/system-config', name: 'System Config', module: 'system_config' }
  ];

  const accessibleModules = modules.filter(m => hasModuleAccess(m.module));

  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="sidebar-header">
          <h2>RBAC System</h2>
        </div>

        <div className="sidebar-user">
          <div className="user-avatar">{user?.email?.[0]?.toUpperCase() || 'U'}</div>
          <div className="user-info">
            <p className="user-email">{user?.email}</p>
            <p className="user-role">{permissions?.role || 'Loading...'}</p>
          </div>
        </div>

        <div className="nav-links">
          <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Dashboard
          </NavLink>

          {accessibleModules.map((module) => (
            <NavLink
              key={module.path}
              to={module.path}
              className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
            >
              {module.name}
            </NavLink>
          ))}
        </div>

        <div className="sidebar-footer">
          <button
            onClick={() => logout({ returnTo: window.location.origin })}
            className="logout-btn"
          >
            Logout
          </button>
        </div>
      </nav>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;

import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { Navigate } from 'react-router-dom';
import './Login.css';

const Login = () => {
  const { loginWithRedirect, isAuthenticated, isLoading } = useAuth0();

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>Auth0 RBAC System</h1>
          <p>Role-Based Access Control Application</p>
        </div>

        <div className="login-content">
          <p className="login-description">
            Secure access to multiple modules with fine-grained permissions
          </p>

          <button onClick={() => loginWithRedirect()} className="login-button">
            Sign In with Auth0
          </button>

          <div className="features">
            <h3>System Modules</h3>
            <ul>
              <li>User Management</li>
              <li>Order Management</li>
              <li>Inventory Management</li>
              <li>Printing Software</li>
              <li>System Configuration</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

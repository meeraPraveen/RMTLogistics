import React from 'react';
import './RoleMismatchAlert.css';

const RoleMismatchAlert = ({ auth0Role, dbRole }) => {
  return (
    <div className="role-mismatch-alert">
      <div className="alert-icon">⚠️</div>
      <div className="alert-content">
        <strong>Role Discrepancy Detected</strong>
        <p>
          Your Auth0 role (<strong>{auth0Role}</strong>) differs from your application role (<strong>{dbRole}</strong>).
          The application is using your database role for permissions.
        </p>
      </div>
    </div>
  );
};

export default RoleMismatchAlert;

import { useNavigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import './Unauthorized.css';

const Unauthorized = () => {
  const navigate = useNavigate();
  const { logout } = useAuth0();

  const handleTryAgain = () => {
    // Clear Auth0 cache by logging out completely
    // This forces a fresh login attempt
    logout({
      logoutParams: {
        returnTo: window.location.origin + '/login'
      }
    });
  };

  // This page is shown when user tries to access a module they don't have permissions for
  return (
    <div className="unauthorized-container">
      <div className="unauthorized-card">
        <div className="icon-wrapper">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h1>Access Denied</h1>
        <p>You don't have permission to access this application.</p>
        <p className="help-text">
          If you believe you should have access, contact your administrator to assign you a role,
          then try logging in again.
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button onClick={handleTryAgain} className="back-button">
            Try Login Again
          </button>
          <button onClick={() => navigate('/dashboard')} className="back-button" style={{ background: '#6c757d' }}>
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default Unauthorized;

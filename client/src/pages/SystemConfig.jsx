import React, { useState, useEffect } from 'react';
import { modulesApi, setAuthToken } from '../utils/api';
import { useAuth0 } from '@auth0/auth0-react';
import { usePermissions } from '../hooks/usePermissions';
import './ModulePage.css';

const SystemConfig = () => {
  const { getIdTokenClaims } = useAuth0();
  const { hasPermission } = usePermissions();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const idToken = await getIdTokenClaims();
      setAuthToken(idToken.__raw);

      const response = await modulesApi.systemConfig.getSettings();
      setSettings(response.data.data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load settings:', error);
      setLoading(false);
    }
  };

  const canUpdate = hasPermission('system_config', 'update');

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading system configuration...</p>
      </div>
    );
  }

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>⚙️ System Configuration</h1>
          <p>Configure application settings and integrations</p>
        </div>
        {canUpdate && (
          <button className="primary-btn">Save Changes</button>
        )}
      </div>

      <div className="permissions-info">
        <p>Your permissions:</p>
        <div className="permission-badges">
          <span className="badge">Read</span>
          {canUpdate && <span className="badge">Update</span>}
        </div>
      </div>

      {settings && (
        <div className="settings-grid">
          <div className="settings-card">
            <h3>Application Settings</h3>
            <div className="setting-row">
              <span>App Name:</span>
              <strong>{settings.appName}</strong>
            </div>
            <div className="setting-row">
              <span>Version:</span>
              <strong>{settings.version}</strong>
            </div>
            <div className="setting-row">
              <span>Timezone:</span>
              <strong>{settings.timezone}</strong>
            </div>
            <div className="setting-row">
              <span>Currency:</span>
              <strong>{settings.currency}</strong>
            </div>
          </div>

          <div className="settings-card">
            <h3>Notifications</h3>
            <div className="setting-row">
              <span>Email Notifications:</span>
              <span className={`badge ${settings.notifications.email ? 'success' : ''}`}>
                {settings.notifications.email ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="setting-row">
              <span>SMS Notifications:</span>
              <span className={`badge ${settings.notifications.sms ? 'success' : ''}`}>
                {settings.notifications.sms ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>

          <div className="settings-card">
            <h3>Integrations</h3>
            <div className="setting-row">
              <span>Auth0:</span>
              <span className="badge success">
                {settings.integrations.auth0.enabled ? `Enabled (${settings.integrations.auth0.domain})` : 'Disabled'}
              </span>
            </div>
            <div className="setting-row">
              <span>Stripe:</span>
              <span className={`badge ${settings.integrations.stripe.enabled ? 'success' : ''}`}>
                {settings.integrations.stripe.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="setting-row">
              <span>ShipStation:</span>
              <span className={`badge ${settings.integrations.shipStation.enabled ? 'success' : ''}`}>
                {settings.integrations.shipStation.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>
      )}

      {!canUpdate && (
        <div className="info-message">
          You have read-only access to system configuration. Contact your administrator to request update permissions.
        </div>
      )}
    </div>
  );
};

export default SystemConfig;

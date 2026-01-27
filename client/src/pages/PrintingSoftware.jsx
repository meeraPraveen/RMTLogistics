import React, { useState, useEffect } from 'react';
import { modulesApi, setAuthToken } from '../utils/api';
import { useAuth0 } from '@auth0/auth0-react';
import { usePermissions } from '../hooks/usePermissions';
import './ModulePage.css';

const PrintingSoftware = () => {
  const { getIdTokenClaims } = useAuth0();
  const { hasPermission } = usePermissions();
  const [queue, setQueue] = useState([]);
  const [printers, setPrinters] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const idToken = await getIdTokenClaims();
      setAuthToken(idToken.__raw);

      const [queueRes, printersRes] = await Promise.all([
        modulesApi.printingSoftware.getQueue(),
        modulesApi.printingSoftware.getPrinters()
      ]);

      setQueue(queueRes.data.data);
      setPrinters(printersRes.data.data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load printing data:', error);
      setLoading(false);
    }
  };

  const canWrite = hasPermission('printing_software', 'write');

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading printing software...</p>
      </div>
    );
  }

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <h1>🖨️ Printing Software</h1>
          <p>Manage print jobs and monitor printer status</p>
        </div>
        {canWrite && (
          <button className="primary-btn">Add Print Job</button>
        )}
      </div>

      <div className="permissions-info">
        <p>Your permissions:</p>
        <div className="permission-badges">
          <span className="badge">Read</span>
          {canWrite && <span className="badge">Write</span>}
          {hasPermission('printing_software', 'update') && <span className="badge">Update</span>}
        </div>
      </div>

      <div className="section">
        <h2>Active Printers</h2>
        <div className="printer-grid">
          {printers.map((printer) => (
            <div key={printer.id} className="printer-card">
              <div className="printer-header">
                <h3>{printer.name}</h3>
                <span className={`status-dot ${printer.status}`}></span>
              </div>
              <p className="printer-status">{printer.status}</p>
              {printer.currentJob && (
                <p className="current-job">Current: {printer.currentJob}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <h2>Print Queue</h2>
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Job Name</th>
                <th>Printer</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((job) => (
                <tr key={job.id}>
                  <td><strong>{job.jobName}</strong></td>
                  <td>{job.printer}</td>
                  <td>
                    <span className={`status-badge ${job.status}`}>
                      {job.status}
                    </span>
                  </td>
                  <td>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${job.progress}%` }}></div>
                      <span className="progress-text">{job.progress}%</span>
                    </div>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn-small">View</button>
                      {job.status === 'queued' && canWrite && (
                        <button className="btn-small danger">Cancel</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PrintingSoftware;
